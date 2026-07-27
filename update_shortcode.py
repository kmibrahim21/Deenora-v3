import sys

with open('src/services/ShortcodeService.ts', 'r') as f:
    content = f.read()

target = """    const shortcodes: Record<string, any> = {
      '{student_name}': data.student_name || '-',
      '{father_name}': data.guardian_name || '-',"""

replacement = """    const shortcodes: Record<string, any> = {
      '{student_name}': data.student_name || '-',
      '{teacher_name}': data.teacher_name || data.name || data.student_name || '-',
      '{father_name}': data.guardian_name || '-',"""

with open('src/services/ShortcodeService.ts', 'w') as f:
    f.write(content.replace(target, replacement))

