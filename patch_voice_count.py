import sys

with open('src/pages/VoiceBroadcast.tsx', 'r') as f:
    content = f.read()

target = """    } else if (isTargetingAllStudents) {
      const { count: c } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', madrasah.id);
      count = c || 0;
    } else {
      const { count: c } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', selectedClassId);
      count = c || 0;
    }"""

replacement = """    } else if (targetType === 'teachers') {
      count = teachers.length;
    } else if (isTargetingAllStudents) {
      const { count: c } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('institution_id', madrasah.id);
      count = c || 0;
    } else {
      const { count: c } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', selectedClassId);
      count = c || 0;
    }"""

if target in content:
    content = content.replace(target, replacement)
    print("Replaced count logic")
else:
    print("count logic not found")

with open('src/pages/VoiceBroadcast.tsx', 'w') as f:
    f.write(content)

