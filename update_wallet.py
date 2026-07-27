import sys

with open('src/pages/WalletSMS.tsx', 'r') as f:
    content = f.read()

target = """  const availableShortcodes = [
    { code: '{student_name}', label: lang === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name' },
    { code: '{father_name}', label: lang === 'bn' ? 'পিতার নাম' : 'Father Name' },"""

replacement = """  const availableShortcodes = [
    { code: '{student_name}', label: lang === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name' },
    { code: '{teacher_name}', label: lang === 'bn' ? 'শিক্ষকের নাম' : 'Teacher Name' },
    { code: '{father_name}', label: lang === 'bn' ? 'পিতার নাম' : 'Father Name' },"""

if target in content:
    with open('src/pages/WalletSMS.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Replaced in WalletSMS.tsx")
else:
    print("Not found in WalletSMS.tsx")

