const fs = require('fs');
const file = 'src/pages/ParentPortal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /await generateResultPDF\(student, examInfo, marks, madrasah, lang === 'bn' \? 'bn' : 'en'\);/g,
  `
                        const totalDays = attendance.length;
                        const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
                        const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100).toString() : 'N/A';
                        
                        const studentWithAttendance = {
                          ...student,
                          attendance: attendancePercentage
                        };
                        
                        await generateResultPDF(studentWithAttendance, examInfo, marks, madrasah, lang === 'bn' ? 'bn' : 'en');`
);

fs.writeFileSync(file, content);
