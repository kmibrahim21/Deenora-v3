import sys

with open('src/pages/Attendance.tsx', 'r') as f:
    content = f.read()

target = """  const availableShortcodes = [
    { code: '{student_name}', label: lang === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name' },
    { code: '{institution_name}', label: lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name' },"""

replacement = """  const availableShortcodes = [
    { code: '{student_name}', label: lang === 'bn' ? 'শিক্ষার্থীর নাম' : 'Student Name' },
    { code: '{teacher_name}', label: lang === 'bn' ? 'শিক্ষকের নাম' : 'Teacher Name' },
    { code: '{institution_name}', label: lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name' },"""

if target in content:
    with open('src/pages/Attendance.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Replaced in Attendance.tsx")
else:
    print("Not found in Attendance.tsx")

