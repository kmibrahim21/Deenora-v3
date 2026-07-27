import sys

with open('src/pages/VoiceBroadcast.tsx', 'r') as f:
    content = f.read()

target1 = """      let targetClassName = null;
      if (!isTargetingInstitutions && !isPreSelected) {
        if (isTargetingAllStudents) {
          targetClassName = lang === 'bn' ? 'সকল শিক্ষার্থী' : 'All Students';
        } else {
          const cls = classes.find(c => c.id === selectedClassId);
          if (cls) targetClassName = cls.class_name;
        }
      }"""

replacement1 = """      let targetClassName = null;
      if (!isTargetingInstitutions && !isPreSelected) {
        if (targetType === 'teachers') {
          targetClassName = lang === 'bn' ? 'সকল শিক্ষক' : 'All Teachers';
        } else if (isTargetingAllStudents) {
          targetClassName = lang === 'bn' ? 'সকল শিক্ষার্থী' : 'All Students';
        } else {
          const cls = classes.find(c => c.id === selectedClassId);
          if (cls) targetClassName = cls.class_name;
        }
      }"""

target2 = """      // Get phone numbers
      let phoneNumbers: string[] = [];
      if (isTargetingInstitutions) {
        if (targetType === 'all_institutions') {
          phoneNumbers = allInstitutions.map(inst => inst.phone);
        } else {
          phoneNumbers = allInstitutions.filter(inst => selectedInstitutionIds.includes(inst.id)).map(inst => inst.phone);
        }
      } else {
        let students: any[] = [];"""

replacement2 = """      // Get phone numbers
      let phoneNumbers: string[] = [];
      if (isTargetingInstitutions) {
        if (targetType === 'all_institutions') {
          phoneNumbers = allInstitutions.map(inst => inst.phone);
        } else {
          phoneNumbers = allInstitutions.filter(inst => selectedInstitutionIds.includes(inst.id)).map(inst => inst.phone);
        }
      } else if (targetType === 'teachers') {
        phoneNumbers = teachers.map(t => t.phone).filter(p => !!p);
      } else {
        let students: any[] = [];"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Replaced targetClassName logic")
else:
    print("targetClassName logic not found")

if target2 in content:
    content = content.replace(target2, replacement2)
    print("Replaced phoneNumbers logic")
else:
    print("phoneNumbers logic not found")

with open('src/pages/VoiceBroadcast.tsx', 'w') as f:
    f.write(content)

