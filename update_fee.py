import sys

with open('src/components/SmartFeeAnalytics.tsx', 'r') as f:
    content = f.read()

target = """const availableShortcodes = [
  { code: '{student_name}', label: 'Student Name' },
  { code: '{month}', label: 'Fee Month' },"""

replacement = """const availableShortcodes = [
  { code: '{student_name}', label: 'Student Name' },
  { code: '{teacher_name}', label: 'Teacher Name' },
  { code: '{month}', label: 'Fee Month' },"""

if target in content:
    with open('src/components/SmartFeeAnalytics.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Replaced in SmartFeeAnalytics.tsx")
else:
    print("Not found in SmartFeeAnalytics.tsx")

