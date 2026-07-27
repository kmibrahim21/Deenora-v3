import sys

def patch_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    target = """      const { data } = await supabase.from('teachers').select('*').eq('institution_id', madrasah.id).eq('is_active', true);
      if (data) setTeachers(data);"""

    replacement = """      const { data } = await supabase.from('teachers').select('*').eq('institution_id', madrasah.id).eq('is_active', true);
      if (data) {
        const today = new Date().toISOString().split('T')[0];
        const activeTeachers = data.filter(t => !t.leave_date || t.leave_date > today);
        setTeachers(activeTeachers);
      }"""

    if target in content:
        content = content.replace(target, replacement)
        print(f"Patched {filepath}")
        with open(filepath, 'w') as f:
            f.write(content)
    else:
        print(f"Target not found in {filepath}")

patch_file('src/pages/VoiceBroadcast.tsx')
patch_file('src/pages/WalletSMS.tsx')

