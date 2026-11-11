import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabaseAdmin();
  const body = req.body || {};
  const query = req.query || {};
  const action = body.action || query.action || 'list';

  try {
    if (action === 'list' || req.method === 'GET') {
      const institutionId = (query.institution_id || query.institutionId || body.institution_id || body.institutionId) as string;
      if (!institutionId) {
        return res.status(400).json({ error: 'institution_id is required' });
      }

      const { data, error } = await supabase
        .from('classes')
        .select('*')
        .eq('institution_id', institutionId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return res.status(200).json({ success: true, classes: data || [] });
    }

    if (action === 'create' && req.method === 'POST') {
      const { class_name, institution_id, sort_order } = body;
      if (!class_name || !institution_id) {
        return res.status(400).json({ error: 'class_name and institution_id are required' });
      }

      const { data, error } = await supabase
        .from('classes')
        .insert({
          class_name: String(class_name).trim(),
          institution_id: String(institution_id).trim(),
          sort_order: sort_order != null ? Number(sort_order) : null
        })
        .select()
        .single();

      if (error) throw error;
      return res.status(201).json({ success: true, class: data });
    }

    if (action === 'update' && req.method === 'POST') {
      const { id, class_name, sort_order } = body;
      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }

      const updateData: any = {};
      if (class_name !== undefined) updateData.class_name = String(class_name).trim();
      if (sort_order !== undefined) updateData.sort_order = sort_order != null ? Number(sort_order) : null;

      const { data, error } = await supabase
        .from('classes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, class: data });
    }

    if (action === 'delete' && req.method === 'POST') {
      const { id } = body;
      if (!id) {
        return res.status(400).json({ error: 'id is required' });
      }

      // Unlink students and sections first to prevent FK constraint failures
      await supabase.from('students').update({ class_id: null }).eq('class_id', id);
      await supabase.from('sections').delete().eq('class_id', id);

      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    console.error('[API Classes Error]:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
