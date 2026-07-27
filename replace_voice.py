import sys

with open('src/pages/VoiceBroadcast.tsx', 'r') as f:
    content = f.read()

content = content.replace(
    "const [classes, setClasses] = useState<Class[]>([]);",
    "const [classes, setClasses] = useState<Class[]>([]);\n  const [teachers, setTeachers] = useState<any[]>([]);"
)

content = content.replace(
    "const [targetType, setTargetType] = useState<'all' | 'class' | 'all_institutions' | 'specific_institution'>(isSuperAdmin ? 'all_institutions' : 'class');",
    "const [targetType, setTargetType] = useState<'all' | 'class' | 'teachers' | 'all_institutions' | 'specific_institution'>(isSuperAdmin ? 'all_institutions' : 'class');"
)

# Insert fetchTeachers and call it
fetch_teachers_code = """
  const fetchTeachers = async () => {
    if (!madrasah) return;
    try {
      const { data } = await supabase.from('teachers').select('*').eq('institution_id', madrasah.id).eq('is_active', true);
      if (data) setTeachers(data);
    } catch (e) {
      console.error('Error fetching teachers in VoiceBroadcast:', e);
    }
  };
"""

content = content.replace(
    "const fetchClasses = async () => {",
    fetch_teachers_code + "\n  const fetchClasses = async () => {"
)

content = content.replace(
    "useEffect(() => {\n    fetchClasses();",
    "useEffect(() => {\n    fetchClasses();\n    fetchTeachers();"
)

# Handle Broadcast button disabled state
content = content.replace(
    "(!selectedClassId && !isPreSelected && !isTargetingInstitutions && !isTargetingAllStudents)",
    "(!selectedClassId && targetType === 'class' && !isPreSelected && !isTargetingInstitutions && !isTargetingAllStudents) || (targetType === 'teachers' && teachers.length === 0)"
)

# Handle count
content = content.replace(
    "if (targetType === 'all') {\n        count = allStudents.length;",
    "if (targetType === 'all') {\n        count = allStudents.length;\n      } else if (targetType === 'teachers') {\n        count = teachers.length;"
)

# Target name logic
content = content.replace(
    "} else if (isTargetingAllStudents) {\n        targetClassName = 'All Students';",
    "} else if (targetType === 'teachers') {\n        targetClassName = 'Teachers';\n      } else if (isTargetingAllStudents) {\n        targetClassName = 'All Students';"
)

# Phone numbers logic
content = content.replace(
    "} else if (isTargetingAllStudents) {\n        phoneNumbers = allStudents.map(student => student.guardian_phone || student.phone).filter(p => !!p);",
    "} else if (targetType === 'teachers') {\n        phoneNumbers = teachers.map(t => t.phone).filter(p => !!p);\n      } else if (isTargetingAllStudents) {\n        phoneNumbers = allStudents.map(student => student.guardian_phone || student.phone).filter(p => !!p);"
)

# Update disabled state of button
content = content.replace(
    "disabled={!selectedVoiceId || (!selectedClassId && !isPreSelected && !isTargetingInstitutions) || (targetType === 'specific_institution' && selectedInstitutionIds.length === 0) || !selectedSenderId || isBroadcasting}",
    "disabled={!selectedVoiceId || (targetType === 'class' && !selectedClassId && !isPreSelected && !isTargetingInstitutions) || (targetType === 'teachers' && teachers.length === 0) || (targetType === 'specific_institution' && selectedInstitutionIds.length === 0) || !selectedSenderId || isBroadcasting}"
)

# Update UI for specific targeting
target_ui = """                    {!isPreSelected && !isInstPreSelected ? (
                      <div className="relative">
                        {!isSuperAdmin ? (
                          <>
                            {targetType === 'class' ? (
                              <>
                                <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                                  <span className="text-base font-black font-noto text-[#1E3A8A]">{getSelectedClassName()}</span>
                                  <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                                </button>
                                
                                {showClassDropdown && (
                                  <div className="absolute top-full left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                                    <button onClick={() => { setTargetType('all'); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${targetType === 'all' ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                                      <span className="font-black font-noto">সকল শিক্ষার্থী (সম্পূর্ণ প্রতিষ্ঠান)</span>
                                    </button>
                                    {classes.map(cls => (
                                      <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setTargetType('class'); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedClassId === cls.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                                        <span className="font-black font-noto">{cls.class_name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (targetType === 'specific_institution' && isSuperAdmin) ? ("""

replacement_ui = """                    {!isPreSelected && !isInstPreSelected ? (
                      <div className="relative">
                        {!isSuperAdmin ? (
                          <>
                            <div className="flex bg-slate-100 p-1 rounded-[1.5rem] mb-4">
                              <button
                                onClick={() => setTargetType('class')}
                                className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-[1.2rem] transition-all ${targetType === 'class' || targetType === 'all' ? 'bg-white shadow-sm text-[#1E3A8A]' : 'text-slate-400'}`}
                              >
                                {lang === 'bn' ? 'শিক্ষার্থী' : 'Students'}
                              </button>
                              <button
                                onClick={() => { setTargetType('teachers'); setSelectedClassId(''); }}
                                className={`flex-1 py-2 text-[11px] font-black uppercase tracking-widest rounded-[1.2rem] transition-all ${targetType === 'teachers' ? 'bg-white shadow-sm text-[#1E3A8A]' : 'text-slate-400'}`}
                              >
                                {lang === 'bn' ? 'শিক্ষক' : 'Teachers'}
                              </button>
                            </div>

                            {targetType === 'class' || targetType === 'all' ? (
                              <>
                                <button onClick={() => setShowClassDropdown(!showClassDropdown)} className="w-full h-[60px] px-6 rounded-[1.5rem] border-2 bg-slate-50 border-slate-100 flex items-center justify-between">
                                  <span className="text-base font-black font-noto text-[#1E3A8A]">{getSelectedClassName()}</span>
                                  <ChevronDown className={`text-slate-300 transition-all ${showClassDropdown ? 'rotate-180' : ''}`} size={20} />
                                </button>
                                
                                {showClassDropdown && (
                                  <div className="absolute top-[120px] left-0 right-0 mt-3 bg-white rounded-[2rem] shadow-bubble border border-slate-100 z-[100] p-2 max-h-60 overflow-y-auto">
                                    <button onClick={() => { setTargetType('all'); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${targetType === 'all' ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                                      <span className="font-black font-noto">সকল শিক্ষার্থী (সম্পূর্ণ প্রতিষ্ঠান)</span>
                                    </button>
                                    {classes.map(cls => (
                                      <button key={cls.id} onClick={() => { setSelectedClassId(cls.id); setTargetType('class'); setShowClassDropdown(false); }} className={`w-full text-left px-5 py-3.5 rounded-xl mb-1 ${selectedClassId === cls.id ? 'bg-[#2563EB] text-white' : 'hover:bg-slate-50 text-[#1E3A8A]'}`}>
                                        <span className="font-black font-noto">{cls.class_name}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : targetType === 'teachers' ? (
                              <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                                <Users size={16} className="text-indigo-600" />
                                <p className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">
                                  {lang === 'bn' ? 'মোট শিক্ষক' : 'Total Teachers'}: {teachers.length}
                                </p>
                              </div>
                            ) : null}
                            
                            {(targetType === 'specific_institution' && isSuperAdmin) ? ("""

content = content.replace(target_ui, replacement_ui)

with open('src/pages/VoiceBroadcast.tsx', 'w') as f:
    f.write(content)

print("Replaced VoiceBroadcast.tsx successfully")
