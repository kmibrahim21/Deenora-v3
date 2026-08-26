const fs = require('fs');
const file = 'src/components/admission_form/AdmissionFormPage.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add selectedStudent state
content = content.replace(
  "const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);",
  "const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);\n  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);"
);

// 2. Add a helper function to map student to form data
const mapHelper = `
  const getMappedFormData = (student: Student | null): AdmissionFormData => {
    if (!student) return sampleFormData;
    return {
      formNumber: student.admission_number || \`ADM-\${new Date().getFullYear()}-\${student.roll || '001'}\`,
      admissionDate: student.created_at ? student.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      academicYear: new Date().getFullYear().toString(),
      session: '',
      studentName: student.student_name || '',
      studentNameEn: student.name_en || '',
      date_of_birth: student.date_of_birth || '',
      gender: (student as any).gender || '', 
      blood_group: student.blood_group || '',
      fatherName: (student as any).father_name || student.guardian_name || '',
      fatherOccupation: (student as any).father_occupation || '',
      motherName: student.mother_name || '',
      motherOccupation: (student as any).mother_occupation || '',
      guardian_name: student.guardian_name || '',
      guardianRelation: (student as any).guardian_relation || '',
      guardian_phone: student.guardian_phone || '',
      presentAddress: student.address || '',
      permanentAddress: (student as any).permanent_address || student.address || '',
      admissionClass: (student as any).classes?.class_name || student.class_id || '',
      previousInstitution: (student as any).previous_institution || '',
      previousClass: (student as any).previous_class || '',
      photoUrl: student.photo_url || '',
      admission_number: student.admission_number || '',
      roll: student.roll,
      nationality: (student as any).nationality || '',
      religion: (student as any).religion || '',
      documentsChecked: [],
    };
  };
`;

content = content.replace("const t = ADMISSION_T[lang];", mapHelper + "\n  const t = ADMISSION_T[lang];");

// 3. Update handleDownloadStudent to use getMappedFormData
content = content.replace(
  /const mappedData: AdmissionFormData = \{[\s\S]*?\};\n    setHeadlessDownloadData\(mappedData\);/m,
  "const mappedData = getMappedFormData(student);\n    setHeadlessDownloadData(mappedData);"
);

// 4. Update the preview render to use selectedStudent mapped data
content = content.replace(
  /<AdmissionFormPreview\s+data=\{sampleFormData\}\s+config=\{config\}\s+lang=\{lang\}\s+\/>/,
  "<AdmissionFormPreview\n                  data={getMappedFormData(selectedStudent)}\n                  config={config}\n                  lang={lang}\n                />"
);

// 5. Update the student list rendering to allow selection
content = content.replace(
  /<div\n\s*key=\{student\.id\}\n\s*className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50\/60 dark:hover:bg-blue-900\/20 transition-all text-left group"\n\s*>/g,
  `<div
                            key={student.id}
                            onClick={() => setSelectedStudent(student)}
                            className={\`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left group cursor-pointer \${selectedStudent?.id === student.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500' : 'border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/60 dark:hover:bg-blue-900/20'}\`}
                          >`
);

content = content.replace(
  /onClick=\{\(\) => handleDownloadStudent\(student\)\}\n\s*disabled=\{isGenerating !== null\}\n\s*className="px-3\.5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600\/20 disabled:opacity-50 cursor-pointer flex items-center gap-1\.5 text-xs font-bold shrink-0"/g,
  `onClick={(e) => { e.stopPropagation(); handleDownloadStudent(student); }}
                              disabled={isGenerating !== null}
                              className="px-3.5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-xs font-bold shrink-0"`
);

// 6. Make preview show blank lines instead of falling back to default values for undefined/empty fields
// Wait, I should edit AdmissionFormPreview.tsx for that.
fs.writeFileSync(file, content);
console.log('AdmissionFormPage patched');
