import React from 'react';

interface ResultSheetProps {
  student: any;
  exam: any;
  marks: any[];
  madrasah: { name: string; logo_url?: string; address?: string };
  lang: 'en' | 'bn';
}

export const ResultSheetTemplate: React.FC<ResultSheetProps> = ({ student, exam, marks, madrasah, lang }) => {
  const isBangla = lang === 'bn';
  const t = {
    marksheet: isBangla ? 'মার্কশীট' : 'MARKSHEET',
    name: isBangla ? 'শিক্ষার্থীর নাম' : 'Student Name',
    roll: isBangla ? 'রোল নম্বর' : 'Roll No',
    class: isBangla ? 'শ্রেণি' : 'Class',
    section: isBangla ? 'শাখা' : 'Section',
    sno: isBangla ? 'ক্রমিক' : 'S.NO',
    subject: isBangla ? 'বিষয়' : 'SUBJECT',
    creditHour: isBangla ? 'পূর্ণমান' : 'FULL MARKS',
    gradeObtained: isBangla ? 'অর্জিত গ্রেড' : 'GRADE OBTAINED',
    gradePoint: isBangla ? 'গ্রেড পয়েন্ট' : 'GRADE POINT',
    remarks: isBangla ? 'মন্তব্য' : 'REMARKS',
    attendance: isBangla ? 'উপস্থিতি' : 'ATTENDANCE',
    gpa: isBangla ? 'জিপিএ' : 'GPA',
    issueDate: isBangla ? 'ইস্যু তারিখ' : 'ISSUE ON',
    teacherSign: isBangla ? 'শিক্ষকের স্বাক্ষর' : 'Teacher Sign',
    parentSign: isBangla ? 'পিতা/মাতার স্বাক্ষর' : 'Parents Sign',
    principalSign: isBangla ? 'অধ্যক্ষের স্বাক্ষর' : 'Principal Sign',
    meritPosition: isBangla ? 'মেধাস্থান' : 'MERIT POSITION',
  };

  const totalMarks = marks.reduce((sum, m) => sum + Number(m.marks_obtained || 0), 0);
  const averageGpa = student.gpa || (marks.length > 0 ? (marks.reduce((sum, m) => sum + Number(m.grade_point || 0), 0) / marks.length).toFixed(2) : '0.00');
  const finalGrade = student.grade || (averageGpa === '5.00' ? 'A+' : averageGpa >= '4.00' ? 'A' : averageGpa >= '3.50' ? 'A-' : averageGpa >= '3.00' ? 'B' : averageGpa >= '2.00' ? 'C' : averageGpa >= '1.00' ? 'D' : 'F');

  return (
    <div className={`w-[794px] h-[1123px] p-6 bg-white ${isBangla ? 'font-noto' : 'font-hind'} text-slate-900 relative overflow-hidden`} style={{ boxSizing: 'border-box' }}>
      {/* Outer borders */}
      <div className="absolute inset-4 border-[2px] border-[#1E3A8A] pointer-events-none"></div>
      <div className="absolute inset-5 border-[1px] border-[#1E3A8A] pointer-events-none"></div>

      {/* Main Container */}
      <div className="p-4 h-full flex flex-col relative z-10">
        
        {/* Header Section */}
        <div className="flex justify-between items-start mb-8">
          {/* Logo */}
          <div className="w-28 h-28 flex items-center justify-center shrink-0">
            {madrasah.logo_url ? (
               <img src={madrasah.logo_url} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-sm" crossOrigin="anonymous" />
            ) : (
               <div className="w-24 h-24 border-2 border-[#1E3A8A] rounded-full flex items-center justify-center bg-blue-50/50 shadow-inner">
                   <span className="text-4xl font-black text-[#1E3A8A]">{madrasah.name.charAt(0)}</span>
               </div>
            )}
          </div>

          {/* School Info */}
          <div className="flex-1 text-center flex flex-col items-center justify-center px-4">
            <h1 className={`text-4xl font-black text-[#1E3A8A] uppercase tracking-tight leading-tight drop-shadow-sm ${isBangla ? 'font-serif-bn' : 'font-tiro'}`}>
                {madrasah.name}
            </h1>
            
            {madrasah.address ? (
              <p className={`text-sm font-bold text-slate-700 uppercase mt-1.5 ${isBangla ? 'font-noto' : ''}`}>{madrasah.address}</p>
            ) : (
              <p className={`text-sm font-bold text-slate-700 uppercase mt-1.5 ${isBangla ? 'font-noto' : ''}`}>
                  {isBangla ? 'ঠিকানা দেওয়া হয়নি' : 'Address Not Provided'}
              </p>
            )}
            
            <p className={`text-[17px] font-bold text-blue-800 uppercase mt-1.5 ${isBangla ? 'font-noto' : ''}`}>
              {exam.exam_name} - {new Date(exam.exam_date).getFullYear()}
            </p>
            
            <div className="mt-4 w-72 text-center py-2 bg-[#1E3A8A] rounded-lg shadow-sm border-[3px] border-[#1E3A8A] relative overflow-hidden group">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className={`text-[21px] font-black text-white uppercase tracking-[0.2em] relative z-10 ${isBangla ? 'font-serif-bn' : ''}`}>
                  {t.marksheet}
              </span>
            </div>
          </div>

          {/* Photo Box */}
          <div className="w-28 h-32 border-[2px] border-[#1E3A8A] shrink-0 relative bg-slate-50 flex flex-col items-center justify-center overflow-hidden">
             {student.photo_url ? (
                <img src={student.photo_url} alt="Student" className="w-full h-full object-cover" crossOrigin="anonymous" />
             ) : (
                <div className="text-center p-2 opacity-40">
                    <div className="w-10 h-10 border-2 border-slate-400 rounded-full mx-auto mb-2"></div>
                    <div className="w-14 h-4 bg-slate-400 rounded-t-lg mx-auto"></div>
                </div>
             )}
          </div>
        </div>

        {/* Student Info */}
        <div className="mb-6 space-y-3 font-semibold text-base mt-2">
          <div className="flex items-end">
            <span className="mr-2 whitespace-nowrap">{t.name}:</span>
            <span className="flex-1 border-b border-black font-bold text-lg font-tiro leading-none pb-0.5">{student.student_name}</span>
          </div>
          <div className="flex items-end gap-4">
            <div className="flex flex-1 items-end">
              <span className="mr-2 whitespace-nowrap">{t.class}:</span>
              <span className="flex-1 border-b border-black font-bold leading-none pb-0.5">{student.classes?.class_name || ''}</span>
            </div>
            <div className="flex flex-1 items-end">
              <span className="mr-2 whitespace-nowrap">{t.roll}:</span>
              <span className="flex-1 border-b border-black text-center font-bold leading-none pb-0.5">{student.roll}</span>
            </div>
            <div className="flex flex-1 items-end">
              <span className="mr-2 whitespace-nowrap">{t.section}:</span>
              <span className="flex-1 border-b border-black text-center font-bold leading-none pb-0.5">{student.section || ''}</span>
            </div>
          </div>
        </div>

        {/* Table Area Container with Watermark */}
        <div className="relative flex-1 mb-6">
           <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none z-0">
              {madrasah.logo_url ? (
                 <img src={madrasah.logo_url} alt="Watermark" className="max-w-[80%] max-h-[80%] object-contain" crossOrigin="anonymous" />
              ) : (
                 <h1 className="text-8xl font-black uppercase text-center transform -rotate-45 text-slate-800">{madrasah.name}</h1>
              )}
           </div>

           {/* Marks Table */}
           <table className="w-full border-collapse border border-black relative z-10 bg-white/90">
             <thead>
               <tr className="bg-slate-200">
                 <th className="border border-black p-2 text-center text-xs font-bold uppercase w-12">{t.sno}</th>
                 <th className="border border-black p-2 text-left text-xs font-bold uppercase">{t.subject}</th>
                 <th className="border border-black p-2 text-center text-xs font-bold uppercase w-24">{t.creditHour}</th>
                 <th className="border border-black p-2 text-center text-xs font-bold uppercase w-24">{t.gradeObtained}</th>
                 <th className="border border-black p-2 text-center text-xs font-bold uppercase w-24">{t.gradePoint}</th>
                 <th className="border border-black p-2 text-center text-xs font-bold uppercase w-32">{t.remarks}</th>
               </tr>
             </thead>
             <tbody>
               {marks.map((m, i) => {
                 let remark = '';
                 if (m.grade === 'A+') remark = isBangla ? 'চমৎকার' : 'Excellent';
                 else if (m.grade === 'A' || m.grade === 'A-') remark = isBangla ? 'খুব ভালো' : 'Very Good';
                 else if (m.grade === 'B' || m.grade === 'C') remark = isBangla ? 'ভালো' : 'Good';
                 else if (m.grade === 'D') remark = isBangla ? 'উন্নতি প্রয়োজন' : 'Needs Work';
                 else if (m.grade === 'F') remark = isBangla ? 'অকৃতকার্য' : 'Fail';
                 
                 return (
                   <tr key={i}>
                     <td className="border border-black p-2 text-center font-bold text-[16px]">{i + 1}</td>
                     <td className="border border-black p-2 font-bold font-tiro text-[15px]">{m.subject_name} {m.is_optional ? `(${isBangla ? 'ঐচ্ছিক' : 'Optional'})` : ''}</td>
                     <td className="border border-black p-2 text-center font-bold text-[16px]">{m.full_marks || '100'}</td>
                     <td className="border border-black p-2 text-center font-bold text-[16px]">{m.grade || '-'}</td>
                     <td className="border border-black p-2 text-center font-bold text-[16px]">{m.grade_point || '-'}</td>
                     <td className="border border-black p-2 text-center text-sm">{m.remarks || remark}</td>
                   </tr>
                 );
               })}
               {/* Pad empty rows if marks are less than 7 for better visuals */}
               {Array.from({ length: Math.max(0, 7 - marks.length) }).map((_, i) => (
                 <tr key={`empty-${i}`}>
                   <td className="border border-black p-3 text-center">&nbsp;</td>
                   <td className="border border-black p-3">&nbsp;</td>
                   <td className="border border-black p-3">&nbsp;</td>
                   <td className="border border-black p-3">&nbsp;</td>
                   <td className="border border-black p-3">&nbsp;</td>
                   <td className="border border-black p-3">&nbsp;</td>
                 </tr>
               ))}
             </tbody>
           </table>

           {/* Summary Info */}
           <table className="w-full border-collapse border border-black relative z-10 mt-2 bg-white/90">
              <thead>
                <tr className="bg-slate-200">
                   <th className="border border-black p-2 text-center text-sm font-bold w-1/3">{t.attendance}</th>
                   <th className="border border-black p-2 text-center text-sm font-bold w-1/3">{t.gpa}</th>
                   <th className="border border-black p-2 text-center text-sm font-bold w-1/3">{t.meritPosition}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                   <td className="border border-black p-3 text-center font-bold text-lg">{student.attendance ? `${student.attendance} %` : 'N/A'}</td>
                   <td className="border border-black p-3 text-center font-bold text-lg">{averageGpa}</td>
                   <td className="border border-black p-3 text-center font-bold text-lg">{student.merit_position ? student.merit_position : 'N/A'}</td>
                </tr>
              </tbody>
           </table>

           {/* Remarks Area */}
           <div className="flex mt-3 items-start relative z-10">
              <span className="font-bold text-[#1E3A8A] text-lg mr-2 uppercase">{t.remarks}:</span>
              <div className="flex-1 border border-black min-h-[50px] bg-white"></div>
           </div>
        </div>

        {/* Footer / Signatures */}
        <div className="mt-4 mb-4 container shrink-0">
           <div className="flex justify-between items-end">
              <div className="font-bold text-sm">
                 {t.issueDate} {new Date().toLocaleDateString('en-GB')}
              </div>
              <div className="text-center w-32">
                 <div className="border-b border-black mb-1 h-6"></div>
                 <div className="font-bold text-xs uppercase">{t.teacherSign}</div>
              </div>
              <div className="text-center w-32">
                 <div className="border-b border-black mb-1 h-6"></div>
                 <div className="font-bold text-xs uppercase">{t.parentSign}</div>
              </div>
              <div className="text-center w-32">
                 <div className="border-b border-black mb-1 h-6"></div>
                 <div className="font-bold text-xs uppercase">{t.principalSign}</div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};
