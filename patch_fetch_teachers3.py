import sys

def patch_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    target = """  const fetchTeachers = async () => {
    if (!madrasah) return;
    try {
      const { data } = await supabase.from('teachers').select('*').eq('institution_id', madrasah.id).eq('is_active', true);
      if (data) {
        const today = new Date().toISOString().split('T')[0];
        const activeTeachers = data.filter(t => {
          if (!t.leave_date) return true;
          const ld = t.leave_date.trim();
          if (ld === '') return true;
          return ld > today;
        });
        setTeachers(activeTeachers);
      }
    } catch (e) {"""

    replacement = """  const fetchTeachers = async () => {
    if (!madrasah) return;
    try {
      const { data } = await supabase.from('teachers').select('*').eq('institution_id', madrasah.id).eq('is_active', true);
      if (data) {
        const today = new Date().toISOString().split('T')[0];
        const formattedTeachers = data.map(t => {
          let parsedPermissions: any = {};
          if (typeof t.permissions === 'string') {
            try { parsedPermissions = JSON.parse(t.permissions); } catch(e) {}
          } else {
            parsedPermissions = t.permissions || {};
          }
          return {
            ...t,
            name: t.teacher_name,
            phone: t.mobile,
            leave_date: parsedPermissions.leave_date
          };
        });
        
        const activeTeachers = formattedTeachers.filter(t => {
          if (!t.leave_date) return true;
          const ld = String(t.leave_date).trim();
          if (ld === '') return true;
          return ld > today;
        });
        setTeachers(activeTeachers);
      }
    } catch (e) {"""

    if target in content:
        content = content.replace(target, replacement)
        print(f"Patched {filepath}")
        with open(filepath, 'w') as f:
            f.write(content)
    else:
        print(f"Target not found in {filepath}")

patch_file('src/pages/VoiceBroadcast.tsx')
patch_file('src/pages/WalletSMS.tsx')

