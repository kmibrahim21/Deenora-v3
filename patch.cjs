const fs = require('fs');
const file = 'src/components/results/engines/school/SchoolResultEngine.tsx';
let content = fs.readFileSync(file, 'utf8');

const fetchAttendanceCode = `
  const fetchClassAttendanceStats = async (classId: string) => {
    if (!madrasah || !activeYear) return {};
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('institution_id', madrasah.id)
        .eq('class_id', classId)
        .gte('date', activeYear.start_date || '')
        .lte('date', activeYear.end_date || '');
      
      if (error) throw error;
      
      const stats = {};
      data?.forEach((record) => {
        if (!stats[record.student_id]) {
          stats[record.student_id] = { present: 0, total: 0 };
        }
        stats[record.student_id].total += 1;
        if (record.status === 'present' || record.status === 'late') {
          stats[record.student_id].present += 1;
        }
      });
      
      const percentages = {};
      for (const [studentId, stat] of Object.entries(stats)) {
        if (stat.total > 0) {
          percentages[studentId] = Math.round((stat.present / stat.total) * 100).toString();
        } else {
          percentages[studentId] = 'N/A';
        }
      }
      return percentages;
    } catch (err) {
      console.error('Error fetching attendance stats:', err);
      return {};
    }
  };
`;

content = content.replace('  const [userZoom, setUserZoom] = useState<number>(1);', '  const [userZoom, setUserZoom] = useState<number>(1);\n' + fetchAttendanceCode);

content = content.replace(
  /const handleDownloadMassMarksheets = async \(downloadLang: 'en' \| 'bn' = lang\) => \{([\s\S]*?)const preppedStudents = validStudents\.map\(\(item: any\) => \{/g,
  (match, p1) => {
    return `const handleDownloadMassMarksheets = async (downloadLang: 'en' | 'bn' = lang) => {${p1}const attStats = await fetchClassAttendanceStats(selectedExam.class_id);\n    const preppedStudents = validStudents.map((item: any) => {`;
  }
);

content = content.replace(
  /attendance: '95', \/\/ You can replace with real attendance computation if needed/g,
  `attendance: attStats[item.student_id] || 'N/A',`
);

content = content.replace(
  /const studentObj = students\.find\(st => st\.id === item\.student_id\);\s*const resultInfo = calculateStudentResult\(item\.student_id, subjects\);\s*generateResultPDF\(/g,
  `const studentObj = students.find(st => st.id === item.student_id);
                                                const resultInfo = calculateStudentResult(item.student_id, subjects);
                                                fetchClassAttendanceStats(selectedExam.class_id).then(attStats => {
                                                  generateResultPDF(`
);

// We need to fix the second hardcoded 95 (in individual download button).
// Wait, the regex for individual button might need to replace the attendance: '95' there too.
content = content.replace(
  /photo_url: studentObj\?\.photo_url, \n(\s*)attendance: '95',/g,
  `photo_url: studentObj?.photo_url, \n$1attendance: attStats[item.student_id] || 'N/A',`
);

content = content.replace(
  /merit_position: item\.rank, \n(\s*)gpa: resultInfo\.gpa,\n(\s*)grade: resultInfo\.grade\n(\s*)\},\n(\s*)selectedExam,\n(\s*)madrasah,\n(\s*)lang === 'bn' \? 'bn' : 'en'\n(\s*)\);/g,
  `merit_position: item.rank, 
$1gpa: resultInfo.gpa,
$2grade: resultInfo.grade
$3},
$4selectedExam,
$5madrasah,
$6lang === 'bn' ? 'bn' : 'en'
$7);
                                                });`
);

fs.writeFileSync(file, content);
