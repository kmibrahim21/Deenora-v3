import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: Request, res: Response) {
  const SN = req.query.SN as string;
  const path = req.path;

  // 1. ADMS Handshake / Get requests
  if (path.includes('/cdata') && req.method === 'GET') {
    return res.status(200).send('OK');
  }

  if (path.includes('/getrequest') && req.method === 'GET') {
    return res.status(200).send('OK');
  }

  // 2. Receive ADMS Attendance push data
  if (path.includes('/cdata') && req.method === 'POST') {
    let rawData = req.body;
    
    // ZKTeco sends text/plain, but Express might not parse it correctly if no content-type is matched
    // Sometimes it comes as an object if body-parser misidentifies it.
    if (typeof rawData === 'object' && Object.keys(rawData).length > 0) {
      // If it parsed as urlencoded, the keys might contain the actual data
      rawData = Object.keys(rawData)[0] || '';
    } else if (Buffer.isBuffer(rawData)) {
      rawData = rawData.toString('utf-8');
    }
    
    if (!rawData || typeof rawData !== 'string') {
      return res.status(200).send('OK');
    }

    try {
      const lines = rawData.split('\n').filter(line => line.trim().length > 0);
      
      // Find the institution matching this Serial Number (SN)
      const { data: institutions } = await supabase
        .from('institutions')
        .select('id, config_json');
      
      let matchedInstitutionId = null;
      if (institutions) {
        for (const inst of institutions) {
          const devices = (inst.config_json as any)?.biometric_devices || [];
          if (devices.some((d: any) => d.sn === SN)) {
            matchedInstitutionId = inst.id;
            break;
          }
        }
      }

      if (!matchedInstitutionId) {
        console.warn('ADMS Push: Unknown device SN ->', SN);
        return res.status(200).send('OK');
      }

      for (const line of lines) {
        // ZKTeco Format: USERID\tCheckTime\tCheckType\tVerifyCode
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const userId = parts[0].trim();
          const checkTime = parts[1].trim(); 
          
          if (!userId || !checkTime) continue;
          const date = checkTime.substring(0, 10);
          
          // Look up student by biometric_id (checking direct field, notes tag, roll, or registration number)
          let student: any = null;

          // 1. Try finding by notes containing biometric_id or registration number
          const { data: studentsList } = await supabase
            .from('students')
            .select('id, class_id, notes, registration_number, roll')
            .eq('institution_id', matchedInstitutionId);

          if (studentsList && studentsList.length > 0) {
            student = studentsList.find((s: any) => {
              if (s.notes && s.notes.includes(`"biometric_id":"${userId}"`)) return true;
              if (s.registration_number && s.registration_number.toString().trim() === userId) return true;
              if (s.roll && s.roll.toString().trim() === userId) return true;
              return false;
            });
          }

          if (student) {
            const { data: existing } = await supabase
               .from('attendance')
               .select('id')
               .eq('institution_id', matchedInstitutionId)
               .eq('student_id', student.id)
               .eq('event_date', date)
               .maybeSingle();
            
            if (!existing) {
              await supabase.from('attendance').insert({
                institution_id: matchedInstitutionId,
                student_id: student.id,
                class_id: student.class_id,
                event_date: date,
                status: 'present',
                event_type: 'daily'
              });
            }
          } else {
             // Look up teacher if not found in students
             const { data: teachersList } = await supabase
               .from('teachers')
               .select('id, permissions, teacher_name')
               .eq('institution_id', matchedInstitutionId);

             const teacher = teachersList?.find((t: any) => {
               const perms = t.permissions || {};
               const bioId = typeof perms === 'object' ? perms.biometric_id : '';
               const teachId = typeof perms === 'object' ? perms.teacher_id_number : '';
               return (bioId && bioId.toString().trim() === userId) || (teachId && teachId.toString().trim() === userId);
             });

             if (teacher) {
                const { data: existingT } = await supabase
                   .from('teacher_attendance')
                   .select('id')
                   .eq('institution_id', matchedInstitutionId)
                   .eq('teacher_id', teacher.id)
                   .eq('date', date)
                   .maybeSingle();

                if (!existingT) {
                  await supabase.from('teacher_attendance').insert({
                    institution_id: matchedInstitutionId,
                    teacher_id: teacher.id,
                    date: date,
                    status: 'present'
                  });
                }
             }
          }
        }
      }
    } catch (e) {
      console.error('Error processing ADMS data:', e);
    }
    // Always return OK so the device knows data was received
    return res.status(200).send('OK');
  }

  res.status(404).send('Not Found');
}
