import sys

def patch_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    target = """        const activeTeachers = data.filter(t => !t.leave_date || t.leave_date > today);"""

    replacement = """        const activeTeachers = data.filter(t => {
          if (!t.leave_date) return true;
          const ld = t.leave_date.trim();
          if (ld === '') return true;
          return ld > today;
        });"""

    if target in content:
        content = content.replace(target, replacement)
        print(f"Patched {filepath}")
        with open(filepath, 'w') as f:
            f.write(content)
    else:
        print(f"Target not found in {filepath}")

patch_file('src/pages/VoiceBroadcast.tsx')
patch_file('src/pages/WalletSMS.tsx')

