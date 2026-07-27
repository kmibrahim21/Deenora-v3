import sys

with open('src/components/SMSModal.tsx', 'r') as f:
    content = f.read()

target = """  const availableShortcodes = [
    { code: '{student_name}', label: 'Student Name' },
    { code: '{father_name}', label: 'Father Name' },"""

replacement = """  const availableShortcodes = [
    { code: '{student_name}', label: 'Student Name' },
    { code: '{teacher_name}', label: 'Teacher Name' },
    { code: '{father_name}', label: 'Father Name' },"""

if target in content:
    with open('src/components/SMSModal.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Replaced in SMSModal.tsx")
else:
    print("Not found in SMSModal.tsx")

