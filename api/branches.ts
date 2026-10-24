import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS & headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabaseAdmin();
  const { action } = req.body || req.query || {};

  try {
    // 1. GET ALL BRANCHES FOR AN INSTITUTION
    if (action === 'get-branches' || req.method === 'GET') {
      const institutionId = (req.body?.institutionId || req.query?.institutionId) as string;
      if (!institutionId) {
        return res.status(400).json({ error: 'institutionId is required' });
      }

      // Check current institution to determine root
      const { data: currentInst, error: currErr } = await supabase
        .from('institutions')
        .select('id, name, address, phone, contact_email, logo_url, institution_type, theme, status, is_active, config_json, created_at, sms_balance, balance')
        .eq('id', institutionId)
        .single();

      if (currErr || !currentInst) {
        return res.status(404).json({ error: 'Institution not found' });
      }

      const rootId = (currentInst.config_json as any)?.parent_institution_id || currentInst.id;

      // Fetch Root Institution
      const { data: rootInst } = await supabase
        .from('institutions')
        .select('id, name, address, phone, contact_email, logo_url, institution_type, theme, status, is_active, config_json, created_at, sms_balance, balance')
        .eq('id', rootId)
        .single();

      if (!rootInst) {
        return res.status(404).json({ error: 'Parent institution not found' });
      }

      // Fetch Child Branches
      const { data: childBranches } = await supabase
        .from('institutions')
        .select('id, name, address, phone, contact_email, logo_url, institution_type, theme, status, is_active, config_json, created_at, sms_balance, balance')
        .filter('config_json->>parent_institution_id', 'eq', rootId);

      const allBranchRecords = [
        { ...rootInst, isMain: true },
        ...(childBranches || []).map(b => ({ ...b, isMain: false }))
      ];

      const allIds = allBranchRecords.map(b => b.id);

      // Fetch student counts
      const { data: students } = await supabase
        .from('students')
        .select('institution_id')
        .in('institution_id', allIds)
        .neq('is_active', false);

      // Fetch teacher counts
      const { data: teachers } = await supabase
        .from('teachers')
        .select('institution_id')
        .in('institution_id', allIds)
        .eq('status', 'active');

      const studentCountMap: Record<string, number> = {};
      const teacherCountMap: Record<string, number> = {};

      (students || []).forEach(s => {
        studentCountMap[s.institution_id] = (studentCountMap[s.institution_id] || 0) + 1;
      });

      (teachers || []).forEach(t => {
        teacherCountMap[t.institution_id] = (teacherCountMap[t.institution_id] || 0) + 1;
      });

      const totalStudentsAllBranches = (students || []).length;
      const totalTeachersAllBranches = (teachers || []).length;

      const formattedBranches = allBranchRecords.map(b => ({
        id: b.id,
        name: b.name,
        isMain: b.isMain,
        address: b.address || '',
        phone: b.phone || '',
        contact_email: b.contact_email || '',
        logo_url: b.logo_url || null,
        institution_type: b.institution_type || 'madrasah',
        theme: b.theme || 'default',
        status: b.status || 'active',
        is_active: b.is_active,
        config_json: b.config_json || {},
        studentCount: studentCountMap[b.id] || 0,
        teacherCount: teacherCountMap[b.id] || 0,
        directStudentCount: studentCountMap[b.id] || 0,
        directTeacherCount: teacherCountMap[b.id] || 0,
        sms_balance: b.sms_balance || 0,
        balance: b.balance || 0,
        voice_sender_id: (b as any).voice_sender_id || '',
        voice_rate: (b as any).voice_rate || null,
        created_at: b.created_at
      }));

      const branchLimit = Number((rootInst.config_json as any)?.branch_limit ?? 0);

      return res.status(200).json({
        success: true,
        rootId,
        sharedSmsBalance: rootInst.sms_balance || 0,
        sharedVoiceBalance: rootInst.balance || 0,
        totalStudentsAllBranches,
        totalTeachersAllBranches,
        branchLimit,
        branches: formattedBranches
      });
    }

    // UPDATE INSTITUTION SETTINGS (Branch or Main)
    if (action === 'update-settings') {
      const { institutionId, name, address, phone, contact_email, voice_sender_id, logo_url, config_json } = req.body;
      if (!institutionId) {
        return res.status(400).json({ error: 'institutionId is required' });
      }

      const updatePayload: any = {};
      if (name !== undefined) updatePayload.name = String(name).trim();
      if (address !== undefined) updatePayload.address = address ? String(address).trim() : null;
      if (phone !== undefined) updatePayload.phone = String(phone).trim();
      if (contact_email !== undefined) updatePayload.contact_email = contact_email ? String(contact_email).trim() : null;
      if (voice_sender_id !== undefined) updatePayload.voice_sender_id = voice_sender_id ? String(voice_sender_id).trim() : null;
      if (logo_url !== undefined) updatePayload.logo_url = logo_url;
      if (config_json !== undefined) updatePayload.config_json = config_json;

      const { data, error } = await supabase
        .from('institutions')
        .update(updatePayload)
        .eq('id', institutionId)
        .select()
        .single();

      if (error) {
        console.error('Error updating institution settings via API:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, institution: data });
    }

    // UPDATE INSTITUTION THEME (Branch or Main)
    if (action === 'update-theme') {
      const { institutionId, theme } = req.body;
      if (!institutionId || !theme) {
        return res.status(400).json({ error: 'institutionId and theme are required' });
      }

      const { data, error } = await supabase
        .from('institutions')
        .update({ theme })
        .eq('id', institutionId)
        .select('id, theme')
        .single();

      if (error) {
        console.error('Error updating institution theme via admin API:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, theme: data.theme });
    }

    // 2. CREATE A NEW BRANCH
    if (action === 'create-branch') {
      const { parent_institution_id, name, institution_type, address, phone, email } = req.body;

      if (!parent_institution_id) {
        return res.status(400).json({ error: 'parent_institution_id is required' });
      }
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'শাখার নাম আবশ্যক' });
      }

      // 1. Fetch parent institution
      const { data: parentInst, error: pError } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', parent_institution_id)
        .single();

      if (pError || !parentInst) {
        return res.status(404).json({ error: 'মূল প্রতিষ্ঠান খুঁজে পাওয়া যায়নি' });
      }

      // If the provided ID is already a child branch, link to its root
      const rootId = (parentInst.config_json as any)?.parent_institution_id || parentInst.id;
      const effectiveParent = rootId === parentInst.id ? parentInst : (await supabase.from('institutions').select('*').eq('id', rootId).single()).data || parentInst;

      // Check Super Admin configured branch limit
      const branchLimit = Number((effectiveParent.config_json as any)?.branch_limit ?? 0);

      // 2. Count existing branches
      const { data: existingChildren } = await supabase
        .from('institutions')
        .select('id')
        .filter('config_json->>parent_institution_id', 'eq', effectiveParent.id);

      const currentBranchCount = existingChildren?.length || 0;

      if (branchLimit <= 0) {
        return res.status(403).json({
          error: 'এই অ্যাকাউন্টে শাখা যুক্ত করার অনুমতি নেই। শাখা অপশন চালু করতে সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।'
        });
      }

      if (currentBranchCount >= branchLimit) {
        return res.status(403).json({
          error: `আপনার অ্যাকাউন্টে সর্বোচ্চ ${branchLimit} টি শাখা তৈরির সীমা নির্ধারিত রয়েছে। অতিরিক্ত শাখা যুক্ত করতে সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।`
        });
      }

      const branchIndex = currentBranchCount + 1;
      const newBranchId = crypto.randomUUID();
      const codeBase = effectiveParent.institute_code || 'DNRA';
      const newInstituteCode = `${codeBase}-B${branchIndex}`;

      const currentYear = new Date().getFullYear().toString();
      const academicYearId = crypto.randomUUID();

      const newConfigJson = {
        ...(effectiveParent.config_json || {}),
        parent_institution_id: effectiveParent.id,
        is_branch: true,
        branch_name: name.trim(),
        shared_sms: true,
        active_academic_year_id: academicYearId,
        branches: []
      };

      // 3. Insert new branch institution
      const { data: createdBranch, error: insertError } = await supabase
        .from('institutions')
        .insert({
          id: newBranchId,
          name: name.trim(),
          address: (address || '').trim() || effectiveParent.address || '',
          phone: (phone || '').trim() || effectiveParent.phone || '',
          contact_email: (email || '').trim() || effectiveParent.contact_email || '',
          institution_type: institution_type || effectiveParent.institution_type || 'madrasah',
          logo_url: effectiveParent.logo_url || null,
          theme: effectiveParent.theme || 'default',
          status: effectiveParent.status || 'active',
          is_active: true,
          is_super_admin: false,
          balance: 0,
          sms_balance: 0,
          subscription_end: effectiveParent.subscription_end || null,
          institute_code: newInstituteCode,
          reve_api_key: effectiveParent.reve_api_key || null,
          reve_secret_key: effectiveParent.reve_secret_key || null,
          reve_caller_id: effectiveParent.reve_caller_id || null,
          reve_client_id: effectiveParent.reve_client_id || null,
          voice_sender_id: effectiveParent.voice_sender_id || null,
          automas_api_key: effectiveParent.automas_api_key || null,
          automas_masking_sender_id: effectiveParent.automas_masking_sender_id || null,
          automas_non_masking_sender_id: effectiveParent.automas_non_masking_sender_id || null,
          sms_rate: effectiveParent.sms_rate || null,
          voice_rate: effectiveParent.voice_rate || null,
          config_json: newConfigJson
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting branch institution:', insertError);
        return res.status(500).json({ error: `শাখা তৈরি করতে সমস্যা হয়েছে: ${insertError.message}` });
      }

      // 4. Create active academic year for new branch
      await supabase.from('academic_years').insert({
        id: academicYearId,
        institution_id: newBranchId,
        year_name: currentYear,
        start_date: `${currentYear}-01-01`,
        end_date: `${currentYear}-12-31`,
        status: 'active'
      });

      // 5. Update parent institution's branches list in config_json
      const parentBranches = (effectiveParent.config_json as any)?.branches || [];
      parentBranches.push({
        id: newBranchId,
        name: name.trim(),
        address: (address || '').trim(),
        phone: (phone || '').trim(),
        institution_type: institution_type || effectiveParent.institution_type,
        created_at: new Date().toISOString()
      });

      await supabase.from('institutions').update({
        config_json: {
          ...(effectiveParent.config_json || {}),
          branches: parentBranches
        }
      }).eq('id', effectiveParent.id);

      return res.status(200).json({
        success: true,
        message: 'নতুন শাখা সফলভাবে তৈরি করা হয়েছে!',
        branch: {
          id: newBranchId,
          name: name.trim(),
          isMain: false,
          address: (address || '').trim(),
          phone: (phone || '').trim(),
          institution_type: institution_type || effectiveParent.institution_type,
          studentCount: 0,
          teacherCount: 0,
          created_at: createdBranch.created_at
        }
      });
    }

    // 3. DELETE / REMOVE A BRANCH
    if (action === 'delete-branch') {
      const { branch_id, parent_institution_id } = req.body;
      if (!branch_id) {
        return res.status(400).json({ error: 'branch_id is required' });
      }

      // Fetch branch to verify it is a child branch and not root
      const { data: branchInst, error: bError } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', branch_id)
        .single();

      if (bError || !branchInst) {
        return res.status(404).json({ error: 'শাখা খুঁজে পাওয়া যায়নি' });
      }

      const rootId = (branchInst.config_json as any)?.parent_institution_id;
      if (!rootId) {
        return res.status(400).json({ error: 'প্রধান প্রতিষ্ঠান/ক্যাম্পাস মুছে ফেলা যাবে না' });
      }

      // Check parent matches
      if (parent_institution_id && parent_institution_id !== rootId && parent_institution_id !== branch_id) {
        return res.status(403).json({ error: 'এই শাখাটি মুছে ফেলার অনুমতি নেই' });
      }

      // Fetch parent institution to update config_json branches
      const { data: parentInst } = await supabase
        .from('institutions')
        .select('*')
        .eq('id', rootId)
        .single();

      if (parentInst) {
        const parentBranches = ((parentInst.config_json as any)?.branches || []).filter(
          (b: any) => b.id !== branch_id
        );
        await supabase.from('institutions').update({
          config_json: {
            ...(parentInst.config_json || {}),
            branches: parentBranches
          }
        }).eq('id', rootId);
      }

      // Delete from institutions table
      const { error: delError } = await supabase
        .from('institutions')
        .delete()
        .eq('id', branch_id);

      if (delError) {
        console.error('Error deleting branch institution:', delError);
        return res.status(500).json({ error: `শাখা মুছতে সমস্যা হয়েছে: ${delError.message}` });
      }

      return res.status(200).json({
        success: true,
        message: 'শাখাটি সফলভাবে মুছে ফেলা হয়েছে!'
      });
    }

    // 4. ALLOCATE / TRANSFER SMS & VOICE BALANCE TO BRANCH
    if (action === 'allocate-balance') {
      const { parent_institution_id, branch_id, sms_amount, voice_amount } = req.body;

      if (!parent_institution_id || !branch_id) {
        return res.status(400).json({ error: 'parent_institution_id and branch_id are required' });
      }

      const numSms = Math.floor(Number(sms_amount) || 0);
      const numVoice = Number(Number(voice_amount || 0).toFixed(2));

      if (numSms === 0 && numVoice === 0) {
        return res.status(400).json({ error: 'অনুগ্রহ করে সঠিক SMS বা ভয়েস কল ব্যালেন্স পরিমাণ দিন' });
      }

      // Fetch parent institution
      const { data: parentInst, error: pErr } = await supabase
        .from('institutions')
        .select('id, name, sms_balance, balance, config_json')
        .eq('id', parent_institution_id)
        .single();

      if (pErr || !parentInst) {
        return res.status(404).json({ error: 'প্রধান প্রতিষ্ঠান খুঁজে পাওয়া যায়নি' });
      }

      // Fetch branch institution
      const { data: branchInst, error: bErr } = await supabase
        .from('institutions')
        .select('id, name, sms_balance, balance, config_json')
        .eq('id', branch_id)
        .single();

      if (bErr || !branchInst) {
        return res.status(404).json({ error: 'শাখা প্রতিষ্ঠান খুঁজে পাওয়া যায়নি' });
      }

      const parentSms = Number(parentInst.sms_balance || 0);
      const parentVoice = Number(parentInst.balance || 0);
      const branchSms = Number(branchInst.sms_balance || 0);
      const branchVoice = Number(branchInst.balance || 0);

      // Validate SMS transfer
      if (numSms > 0 && parentSms < numSms) {
        return res.status(400).json({
          error: `প্রধান প্রতিষ্ঠানে পর্যাপ্ত SMS ব্যালেন্স নেই। আপনার বর্তমান SMS ব্যালেন্স: ${parentSms} SMS, কিন্তু আপনি বরাদ্দ করতে চেয়েছেন: ${numSms} SMS`
        });
      }
      if (numSms < 0 && branchSms < Math.abs(numSms)) {
        return res.status(400).json({
          error: `শাখা অ্যাকাউন্টে পর্যাপ্ত SMS ব্যালেন্স নেই। শাখার বর্তমান SMS ব্যালেন্স: ${branchSms} SMS`
        });
      }

      // Validate Voice transfer
      if (numVoice > 0 && parentVoice < numVoice) {
        return res.status(400).json({
          error: `প্রধান প্রতিষ্ঠানে পর্যাপ্ত ভয়েস কল ব্যালেন্স নেই। আপনার বর্তমান ভয়েস ব্যালেন্স: ৳ ${parentVoice.toFixed(2)}, কিন্তু আপনি বরাদ্দ করতে চেয়েছেন: ৳ ${numVoice.toFixed(2)}`
        });
      }
      if (numVoice < 0 && branchVoice < Math.abs(numVoice)) {
        return res.status(400).json({
          error: `শাখা অ্যাকাউন্টে পর্যাপ্ত ভয়েস কল ব্যালেন্স নেই। শাখার বর্তমান ভয়েস ব্যালেন্স: ৳ ${branchVoice.toFixed(2)}`
        });
      }

      // Accurate arithmetic
      const newParentSms = Math.max(0, parentSms - numSms);
      const newBranchSms = Math.max(0, branchSms + numSms);

      const newParentVoice = Number(Math.max(0, parentVoice - numVoice).toFixed(2));
      const newBranchVoice = Number(Math.max(0, branchVoice + numVoice).toFixed(2));

      // Update Parent Institution
      const { error: parentUpdateErr } = await supabase
        .from('institutions')
        .update({
          sms_balance: newParentSms,
          balance: newParentVoice
        })
        .eq('id', parentInst.id);

      if (parentUpdateErr) {
        console.error('Error updating parent balance:', parentUpdateErr);
        return res.status(500).json({ error: 'প্রধান প্রতিষ্ঠানের ব্যালেন্স আপডেট করতে সমস্যা হয়েছে' });
      }

      // Update Branch Institution
      const { error: branchUpdateErr } = await supabase
        .from('institutions')
        .update({
          sms_balance: newBranchSms,
          balance: newBranchVoice
        })
        .eq('id', branchInst.id);

      if (branchUpdateErr) {
        console.error('Error updating branch balance:', branchUpdateErr);
        // Rollback parent balance if branch update fails
        await supabase
          .from('institutions')
          .update({ sms_balance: parentSms, balance: parentVoice })
          .eq('id', parentInst.id);
        return res.status(500).json({ error: 'শাখা প্রতিষ্ঠানের ব্যালেন্স আপডেট করতে সমস্যা হয়েছে' });
      }

      return res.status(200).json({
        success: true,
        message: 'শাখার ব্যালেন্স সফলভাবে আপডেট করা হয়েছে!',
        parentSms: newParentSms,
        parentVoice: newParentVoice,
        branchSms: newBranchSms,
        branchVoice: newBranchVoice
      });
    }

    // 5. ASSIGN VOICE CALL SENDER ID / RATE TO BRANCH
    if (action === 'assign-voice') {
      const { parent_institution_id, branch_id, voice_sender_id, voice_rate } = req.body;

      if (!parent_institution_id || !branch_id) {
        return res.status(400).json({ error: 'parent_institution_id and branch_id are required' });
      }

      const { data: branchInst, error: bErr } = await supabase
        .from('institutions')
        .select('id, name')
        .eq('id', branch_id)
        .single();

      if (bErr || !branchInst) {
        return res.status(404).json({ error: 'শাখা প্রতিষ্ঠান খুঁজে পাওয়া যায়নি' });
      }

      const updatePayload: any = {};
      if (voice_sender_id !== undefined) updatePayload.voice_sender_id = String(voice_sender_id).trim() || null;
      if (voice_rate !== undefined && voice_rate !== '') updatePayload.voice_rate = Number(voice_rate) || null;

      const { error: updateErr } = await supabase
        .from('institutions')
        .update(updatePayload)
        .eq('id', branch_id);

      if (updateErr) {
        console.error('Error assigning voice to branch:', updateErr);
        return res.status(500).json({ error: 'ভয়েস সেটিংস আপডেট করতে সমস্যা হয়েছে' });
      }

      return res.status(200).json({
        success: true,
        message: 'শাখার ভয়েস সেটিংস সফলভাবে আপডেট করা হয়েছে!',
        voice_sender_id: updatePayload.voice_sender_id,
        voice_rate: updatePayload.voice_rate
      });
    }

    // 6. ASSIGN VOICE TEMPLATE TO BRANCHES
    if (action === 'assign-voice-template') {
      const { parent_institution_id, voice_template_id, target_branch_ids } = req.body;

      if (!parent_institution_id || !voice_template_id || !Array.isArray(target_branch_ids) || target_branch_ids.length === 0) {
        return res.status(400).json({ error: 'parent_institution_id, voice_template_id and target_branch_ids array are required' });
      }

      const supabase = getSupabaseAdmin();

      // Fetch original voice template
      const { data: originalVoice, error: vErr } = await supabase
        .from('voice_templates')
        .select('*')
        .eq('id', voice_template_id)
        .single();

      if (vErr || !originalVoice) {
        return res.status(404).json({ error: 'ভয়েস টেমপ্লেট খুঁজে পাওয়া যায়নি' });
      }

      const insertedRecords = [];

      for (const branchId of target_branch_ids) {
        // Check if template already exists for this branch
        let query = supabase
          .from('voice_templates')
          .select('id')
          .eq('institution_id', branchId);

        if (originalVoice.provider_voice_name) {
          query = query.eq('provider_voice_name', originalVoice.provider_voice_name);
        } else if (originalVoice.file_url) {
          query = query.eq('file_url', originalVoice.file_url);
        } else {
          query = query.eq('title', originalVoice.title);
        }

        const { data: existing } = await query.maybeSingle();

        if (existing) {
          // Update existing
          const { data: updated } = await supabase
            .from('voice_templates')
            .update({
              title: originalVoice.title,
              file_url: originalVoice.file_url,
              duration: originalVoice.duration,
              status: 'approved',
              admin_status: 'approved',
              provider_status: 'approved',
              provider_voice_id: originalVoice.provider_voice_id,
              provider_voice_name: originalVoice.provider_voice_name
            })
            .eq('id', existing.id)
            .select()
            .single();
          if (updated) insertedRecords.push(updated);
        } else {
          // Insert new
          const newId = crypto.randomUUID();
          const { data: inserted } = await supabase
            .from('voice_templates')
            .insert({
              id: newId,
              institution_id: branchId,
              title: originalVoice.title,
              file_url: originalVoice.file_url,
              duration: originalVoice.duration,
              status: 'approved',
              admin_status: 'approved',
              provider_status: 'approved',
              provider_voice_id: originalVoice.provider_voice_id,
              provider_voice_name: originalVoice.provider_voice_name
            })
            .select()
            .single();
          if (inserted) insertedRecords.push(inserted);
        }
      }

      return res.status(200).json({
        success: true,
        message: 'ভয়েস টেমপ্লেটটি নির্বাচিত শাখায় সফলভাবে এসাইন করা হয়েছে!',
        assignedCount: insertedRecords.length
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err: any) {
    console.error('Branches API error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
