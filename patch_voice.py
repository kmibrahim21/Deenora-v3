import sys

with open('src/pages/VoiceBroadcast.tsx', 'r') as f:
    content = f.read()

target1 = """  const [isBroadcasting, setIsBroadcasting] = useState(false);"""

replacement1 = """  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [classStudents, setClassStudents] = useState<any[]>([]);

  useEffect(() => {
    if (selectedClassId) fetchClassStudents(selectedClassId); else setClassStudents([]);
  }, [selectedClassId]);

  const fetchClassStudents = async (cid: string) => {
    const { data } = await supabase.from('students').select('id, guardian_phone, guardian_phone_2').eq('class_id', cid);
    if (data) setClassStudents(data);
  };"""

target2 = """    if (activeTab === 'broadcast') { 
      if (madrasah && isValidUUID(madrasah.id)) fetchClasses();"""

replacement2 = """    if (activeTab === 'broadcast') { 
      if (madrasah && isValidUUID(madrasah.id)) {
        fetchClasses();
        fetchTeachers();
      }"""

target3 = """                            {selectedClassId && targetType === 'class' && !isPreSelected && (
                              <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                                <Users size={16} className="text-[#2563EB]" />
                                <p className="text-[11px] font-black text-[#2563EB] uppercase tracking-wider">
                                  {lang === 'bn' ? 'নির্বাচিত শ্রেণি' : 'Selected Class'}: {getSelectedClassName()}
                                </p>
                              </div>
                            )}"""

replacement3 = """                            {selectedClassId && targetType === 'class' && !isPreSelected && (
                              <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-top-2">
                                <Users size={16} className="text-[#2563EB]" />
                                <p className="text-[11px] font-black text-[#2563EB] uppercase tracking-wider">
                                  {lang === 'bn' ? 'মোট শিক্ষার্থী' : 'Total Students'}: {classStudents.length}
                                </p>
                              </div>
                            )}"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Replaced 1")
if target2 in content:
    content = content.replace(target2, replacement2)
    print("Replaced 2")
if target3 in content:
    content = content.replace(target3, replacement3)
    print("Replaced 3")

with open('src/pages/VoiceBroadcast.tsx', 'w') as f:
    f.write(content)

