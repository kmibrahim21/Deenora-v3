import React from 'react';
import { Institution, Student } from '../../types';

interface ExtendedStudent extends Student {
  className?: string;
  name_en?: string;
}

interface CertificateTemplateProps {
  madrasah: Institution | null;
  student: ExtendedStudent;
  type: string;
  issueDate?: string;
  certLang?: 'bn' | 'en';
}

export const CertificateTemplate: React.FC<CertificateTemplateProps> = ({ madrasah, student, type, issueDate, certLang = 'bn' }) => {
  const isBn = certLang === 'bn';

  let title = isBn ? 'সনদপত্র' : 'Certificate';
  if (type === 'tc') title = isBn ? 'ছাড়পত্র (TC)' : 'Transfer Certificate';
  if (type === 'testimonial') title = isBn ? 'প্রশংসাপত্র' : 'Testimonial';
  if (type === 'certificate') title = isBn ? 'সনদপত্র' : 'Certificate';
  if (type === 'character') title = isBn ? 'চারিত্রিক সনদপত্র' : 'Character Certificate';

  const dateStr = issueDate ? issueDate : new Date().toLocaleDateString('en-GB');

  const enToBnNumber = (numStr: string) => {
    const bnNumbers = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return numStr.replace(/\d/g, (d) => bnNumbers[parseInt(d)]);
  };

  const currentYearSuffix = dateStr.slice(-2);
  const bnYearSuffix = enToBnNumber(currentYearSuffix);

  const addressParts = (student.address || '').split(',').map(s => s.trim());
  const villageOrArea = addressParts[0] || '';
  const postOffice = addressParts[1] || '';
  const upazila = addressParts[2] || '';
  const district = addressParts[3] || '';

  const Field = ({ value, minWidth = '150px', stretch = false }: { value: string; minWidth?: string; stretch?: boolean }) => (
    <span className={`inline-block mx-2 -translate-y-1 ${stretch ? 'flex-1' : ''}`}>
      <span 
        className={`border-b-[1.5px] border-dashed border-slate-400 px-3 text-center font-bold text-[#0f2c59] whitespace-nowrap ${stretch ? 'block w-full' : 'inline-block'}`}
        style={{ minWidth: stretch ? undefined : minWidth, lineHeight: '1', fontFamily: isBn ? "'Tiro Bangla', serif" : "'Playfair Display', serif", fontSize: '22px' }}
      >
        {value || ''}
      </span>
    </span>
  );


  return (
    <div className="w-[1122px] h-[793px] bg-white relative flex flex-col overflow-hidden box-border" style={{ fontFamily: isBn ? "'Noto Sans Bengali', sans-serif" : "'Inter', sans-serif" }}>
      
      {/* --- Premium Classic Borders --- */}
      {/* Outer Thin Border */}
      <div className="absolute inset-0 border-[2px] border-[#0f2c59] m-4 shadow-sm" />
      {/* Main Heavy Decorative Border */}
      <div className="absolute inset-0 border-[8px] border-[#0f2c59] m-[22px]" />
      {/* Inner Elegant Gold Border */}
      <div className="absolute inset-0 border-[2px] border-[#d4af37] m-[34px]" />
      <div className="absolute inset-0 border border-[#d4af37] m-[38px]" />

      {/* --- Watermarks --- */}
      {/* Subtle Pattern */}
      <div className="absolute inset-[39px] z-0 opacity-[0.03]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="islamic-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M40 0 L80 40 L40 80 L0 40 Z" fill="none" stroke="#0f2c59" strokeWidth="0.5"/>
              <path d="M20 20 L60 20 L60 60 L20 60 Z" fill="none" stroke="#0f2c59" strokeWidth="0.2"/>
            </pattern>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#islamic-pattern)"></rect>
        </svg>
      </div>
      
      {/* Centered Institution Logo Watermark */}
      {madrasah?.logo_url && (
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] z-0 pointer-events-none">
          <img src={madrasah.logo_url} className="w-[450px] h-[450px] object-contain grayscale mix-blend-multiply" alt="watermark" />
        </div>
      )}

      {/* --- Corner Ornaments --- */}
      {[
        { className: "top-[38px] left-[38px]" },
        { className: "top-[38px] right-[38px] rotate-90" },
        { className: "bottom-[38px] right-[38px] rotate-180" },
        { className: "bottom-[38px] left-[38px] -rotate-90" }
      ].map((corner, i) => (
        <div key={i} className={`absolute w-12 h-12 ${corner.className} z-10 pointer-events-none`}>
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <path d="M0 0 H100 V15 H15 V100 H0 V0 Z" fill="#d4af37"/>
            <path d="M25 25 H65 V30 H30 V65 H25 V25 Z" fill="#0f2c59"/>
          </svg>
        </div>
      ))}

      {/* --- Main Content --- */}
      <div className="relative z-20 flex flex-col h-full px-20 pt-[45px] pb-[100px] justify-between">
        
        {/* Absolute Header Layer: Serial */}
        <div className="absolute top-[50px] left-[65px] z-30">
          <div className="text-slate-600 font-semibold text-[13px] tracking-wider uppercase flex items-end">
             <span className="w-20">{isBn ? 'ক্রমিক নং :' : 'Serial No:'}</span>
             <span className="text-[#a41717] font-bold border-b border-dotted border-slate-300 w-28 text-center pb-[2px]">1001</span>
          </div>
        </div>

        {/* Absolute Header Layer: Date */}
        <div className="absolute top-[50px] right-[65px] z-30">
          <div className="text-slate-600 font-semibold text-[13px] tracking-wider uppercase flex items-end">
             <span className="w-16">{isBn ? 'তারিখ :' : 'Date:'}</span>
             <span className="text-[#a41717] font-bold border-b border-dotted border-slate-300 w-28 text-center pb-[2px]">{dateStr}</span>
          </div>
        </div>

        {/* Institution Info */}
        <div className="flex flex-col items-center mb-4 relative z-30">
          {madrasah?.logo_url && (
            <img src={madrasah.logo_url} className="w-[85px] h-[85px] object-contain drop-shadow-sm pb-2 mix-blend-multiply" alt="Logo" />
          )}
          <h1 className="text-[44px] font-bold text-[#0f2c59] tracking-tight drop-shadow-sm text-center leading-tight whitespace-nowrap mt-1" style={{ fontFamily: isBn ? "'Tiro Bangla', serif" : "'Playfair Display', serif" }}>
            {isBn ? (madrasah?.name || 'প্রতিষ্ঠানের নাম') : (madrasah?.config_json as any)?.name_english || madrasah?.name || 'Institution Name'}
          </h1>
          <h2 className="text-[16px] font-semibold text-[#8b1414] tracking-widest uppercase mt-1 text-center max-w-3xl">
            {madrasah?.address || (isBn ? 'ঠিকানা' : 'Address')}
          </h2>
          <div className="w-2/3 h-[1px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent mt-3 opacity-70"></div>
        </div>

        {/* Certificate Title Area */}
        <div className="flex flex-col items-center justify-center mb-4 relative z-30">
           <div className="border border-[#0f2c59] p-1 shadow-sm bg-white">
             <div className="bg-[#0f2c59] text-white px-12 py-2">
               <h3 
                  className="text-[32px] font-black tracking-[0.15em] leading-none uppercase"
                  style={{ fontFamily: isBn ? "'Tiro Bangla', serif" : "'Playfair Display', serif" }}
               >
                 {title}
               </h3>
             </div>
           </div>
        </div>

        {/* Body Text */}
        <div className="flex-1 px-8 text-[19px] text-[#1e293b] font-medium relative z-30 flex flex-col justify-center pb-2">
           
           {type === 'testimonial' && (
             <div className="font-medium w-full text-justify" style={{ lineHeight: '1.9' }}>
               {isBn ? (
                 <div className="flex flex-col gap-y-1 w-full text-justify">
                   <div className="flex w-full items-baseline pb-1">
                     <span className="mr-2">এই মর্মে প্রশংসাপত্র প্রদান করা যাচ্ছে যে,</span>
                     <Field value={student.student_name} minWidth="320px" stretch />
                   </div>
                   <div className="flex w-full items-baseline pb-1">
                     <span>পিতা:</span>
                     <Field value={student.guardian_name || ''} minWidth="260px" stretch />
                     <span>, মাতা:</span>
                     <Field value={student.mother_name || ''} minWidth="260px" stretch />
                   </div>
                   <p className="text-justify mt-2" style={{ lineHeight: '1.9' }}>
                     <span>গ্রাম/এলাকা:</span>
                   <Field value={villageOrArea} minWidth="220px" />
                   <span>, ডাকঘর:</span>
                   <Field value={postOffice} minWidth="160px" />
                   <span>, উপজেলা:</span>
                   <Field value={upazila} minWidth="160px" />
                   <span>, জেলা:</span>
                   <Field value={district} minWidth="160px" />
                   <span>। রোল নং:</span>
                   <Field value={String(student.roll || '')} minWidth="90px" />
                   <span>। সে অত্র প্রতিষ্ঠান হতে ২০</span>
                   <Field value={bnYearSuffix} minWidth="60px" />
                   <span>সালের শিক্ষাবর্ষে</span>
                   <Field value={student.className || ''} minWidth="180px" />
                   <span>শ্রেণির চূড়ান্ত পরীক্ষায় অংশগ্রহণ করে জি.পি.এ ৫.০০ এর মধ্যে</span>
                   <Field value="" minWidth="90px" />
                   <span>অর্জন করে কৃতিত্বের সাথে উত্তীর্ণ হয়েছে।</span><br/>

                   <span className="mr-2 mt-4 inline-block">তার শিখন মূল্যায়ন ও মেধা অত্যন্ত প্রশংসনীয়। তাহার জন্ম তারিখ:</span>
                   <Field value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : ''} minWidth="160px" />
                   <span>। অত্র প্রতিষ্ঠানে অধ্যয়নকালে সে কোনো রাষ্ট্র বা শৃঙ্খলা বিরোধী কাজে অংশগ্রহণ করেনি। আমি তার সর্বাঙ্গীন উন্নতি ও উজ্জ্বল ভবিষ্যৎ কামনা করি।</span>
                 </p>
                 </div>
               ) : (
                 <div className="flex flex-col gap-y-1 w-full text-justify">
                   <div className="flex w-full items-baseline pb-1">
                     <span className="mr-2">This testimonial is proudly presented to</span>
                     <Field value={student.name_en || student.student_name} minWidth="380px" stretch />
                   </div>
                   <div className="flex w-full items-baseline pb-1">
                     <span>son/daughter of</span>
                     <Field value={student.guardian_name || ''} minWidth="300px" stretch />
                     <span>and</span>
                     <Field value={student.mother_name || ''} minWidth="300px" stretch />
                   </div>
                   <p className="text-justify mt-2" style={{ lineHeight: '1.9' }}>
                     <span>address:</span>
                   <Field value={student.address || ''} minWidth="340px" />
                   
                   <span>. He/She appeared in the final examination of class</span>
                   <Field value={student.className || ''} minWidth="180px" />
                   <span>from this institution. His/Her Roll No is</span>
                   <Field value={String(student.roll || '')} minWidth="120px" />
                   <span>and achieved GPA</span>
                   <Field value="" minWidth="80px" />
                   <span>. According to the admission register, his/her date of birth is</span>
                   <Field value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : ''} minWidth="180px" />
                   <span>.</span><br/>

                   <span className="mr-2 mt-4 inline-block">His/Her academic performance and merit were highly commendable. During his/her stay, he/she did not take part in any activity subversive to the state or discipline. I wish him/her a very bright and prosperous future.</span>
                 </p>
                 </div>
               )}
             </div>
           )}

           {type === 'certificate' && (
             <div className="font-medium w-full text-justify" style={{ lineHeight: '1.9' }}>
               {isBn ? (
                 <div className="flex flex-col gap-y-1 w-full text-justify">
                   <div className="flex w-full items-baseline pb-1">
                     <span className="mr-2">এই মর্মে প্রত্যয়ন করা যাচ্ছে যে,</span>
                     <Field value={student.student_name} minWidth="320px" stretch />
                   </div>
                   <div className="flex w-full items-baseline pb-1">
                     <span>পিতা:</span>
                     <Field value={student.guardian_name || ''} minWidth="260px" stretch />
                     <span>, মাতা:</span>
                     <Field value={student.mother_name || ''} minWidth="260px" stretch />
                   </div>
                   <p className="text-justify mt-2" style={{ lineHeight: '1.9' }}>
                     <span>গ্রাম/এলাকা:</span>
                   <Field value={villageOrArea} minWidth="220px" />
                   <span>, ডাকঘর:</span>
                   <Field value={postOffice} minWidth="160px" />
                   <span>, উপজেলা:</span>
                   <Field value={upazila} minWidth="160px" />
                   <span>, জেলা:</span>
                   <Field value={district} minWidth="160px" />
                   <span>। রোল নং:</span>
                   <Field value={String(student.roll || '')} minWidth="90px" />
                   <span>। সে অত্র প্রতিষ্ঠানে ২০</span>
                   <Field value={bnYearSuffix} minWidth="60px" />
                   <span>সালের শিক্ষাবর্ষে</span>
                   <Field value={student.className || ''} minWidth="180px" />
                   <span>শ্রেণির একজন নিয়মিত শিক্ষার্থী।</span><br/>

                   <span className="mr-2 mt-4 inline-block">সে অত্যন্ত নম্র, ভদ্র ও মেধাবী শিক্ষার্থী। প্রাতিষ্ঠানিক ও সহশিক্ষা কার্যক্রমে তার অংশগ্রহণ অত্যন্ত সন্তোষজনক। তাহার জন্ম তারিখ:</span>
                   <Field value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : ''} minWidth="160px" />
                   <span>। আমি তার সুন্দর, সমৃদ্ধ ও আলোকিত জীবনের সার্বিক সাফল্য কামনা করি।</span>
                 </p>
                 </div>
               ) : (
                 <div className="flex flex-col gap-y-1 w-full text-justify">
                   <div className="flex w-full items-baseline pb-1">
                     <span className="mr-2">This is to certify that</span>
                     <Field value={student.name_en || student.student_name} minWidth="380px" stretch />
                   </div>
                   <div className="flex w-full items-baseline pb-1">
                     <span>son/daughter of</span>
                     <Field value={student.guardian_name || ''} minWidth="300px" stretch />
                     <span>and</span>
                     <Field value={student.mother_name || ''} minWidth="300px" stretch />
                   </div>
                   <p className="text-justify mt-2" style={{ lineHeight: '1.9' }}>
                     <span>address:</span>
                   <Field value={student.address || ''} minWidth="340px" />
                   
                   <span>, is a regular student of class</span>
                   <Field value={student.className || ''} minWidth="180px" />
                   <span>in this institution for the academic year 20</span>
                   <Field value={currentYearSuffix} minWidth="60px" />
                   <span>. His/Her Roll No is</span>
                   <Field value={String(student.roll || '')} minWidth="120px" />
                   <span>. According to the admission register, his/her date of birth is</span>
                   <Field value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : ''} minWidth="180px" />
                   <span>.</span><br/>

                   <span className="mr-2 mt-4 inline-block">He/She is a polite, obedient and brilliant student. His/Her participation in academic and co-curricular activities is satisfactory. I wish him/her success in all future endeavors.</span>
                 </p>
                 </div>
               )}
             </div>
           )}

           {type === 'character' && (
             <div className="font-medium w-full text-justify" style={{ lineHeight: '1.9' }}>
               {isBn ? (
                 <div className="flex flex-col gap-y-1 w-full text-justify">
                   <div className="flex w-full items-baseline pb-1">
                     <span className="mr-2">এই মর্মে চারিত্রিক সনদপত্র প্রদান করা যাচ্ছে যে,</span>
                     <Field value={student.student_name} minWidth="320px" stretch />
                   </div>
                   <div className="flex w-full items-baseline pb-1">
                     <span>পিতা:</span>
                     <Field value={student.guardian_name || ''} minWidth="260px" stretch />
                     <span>, মাতা:</span>
                     <Field value={student.mother_name || ''} minWidth="260px" stretch />
                   </div>
                   <p className="text-justify mt-2" style={{ lineHeight: '1.9' }}>
                     <span>গ্রাম/এলাকা:</span>
                   <Field value={villageOrArea} minWidth="220px" />
                   <span>, ডাকঘর:</span>
                   <Field value={postOffice} minWidth="160px" />
                   <span>, উপজেলা:</span>
                   <Field value={upazila} minWidth="160px" />
                   <span>, জেলা:</span>
                   <Field value={district} minWidth="160px" />
                   <span>। রোল নং:</span>
                   <Field value={String(student.roll || '')} minWidth="90px" />
                   <span>। সে অত্র প্রতিষ্ঠানের</span>
                   <Field value={student.className || ''} minWidth="180px" />
                   <span>শ্রেণির একজন নিয়মিত শিক্ষার্থী। </span><br/>

                   <span className="mr-2 mt-4 inline-block">আমার জানা মতে, তার স্বভাব-চরিত্র, আচার-আচরণ ও নৈতিকতা চমৎকার এবং সে একজন সৎ শিক্ষার্থী। তাহার জন্ম তারিখ:</span>
                   <Field value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : ''} minWidth="160px" />
                   <span>। অত্র প্রতিষ্ঠানে অধ্যয়নকালে সে কোনো রাষ্ট্র, সমাজ বা শৃঙ্খলা বিরোধী কার্যকলাপে জড়িত ছিল না। আমি তার ভবিষ্যৎ জীবনের উন্নতি ও মঙ্গল কামনা করি।</span>
                 </p>
                 </div>
               ) : (
                 <div className="flex flex-col gap-y-1 w-full text-justify">
                   <div className="flex w-full items-baseline pb-1">
                     <span className="mr-2">This character certificate is issued to certify that</span>
                     <Field value={student.name_en || student.student_name} minWidth="380px" stretch />
                   </div>
                   <div className="flex w-full items-baseline pb-1">
                     <span>son/daughter of</span>
                     <Field value={student.guardian_name || ''} minWidth="300px" stretch />
                     <span>and</span>
                     <Field value={student.mother_name || ''} minWidth="300px" stretch />
                   </div>
                   <p className="text-justify mt-2" style={{ lineHeight: '1.9' }}>
                     <span>address:</span>
                   <Field value={student.address || ''} minWidth="340px" />
                   
                   <span>, is/was a regular student of class</span>
                   <Field value={student.className || ''} minWidth="180px" />
                   <span>in this institution. His/Her Roll No is</span>
                   <Field value={String(student.roll || '')} minWidth="120px" />
                   <span>. According to the admission register, his/her date of birth is</span>
                   <Field value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : ''} minWidth="180px" />
                   <span>.</span><br/>

                   <span className="mr-2 mt-4 inline-block">To the best of my knowledge, his/her character, conduct, and moral values are excellent. He/She is an honest and responsible student. He/She was never involved in any anti-social or anti-disciplinary activities. I wish him/her all the best for his/her future.</span>
                 </p>
                 </div>
               )}
             </div>
           )}

           {type === 'tc' && (
             <div className="font-medium w-full text-justify">
               {isBn ? (
                 <div className="flex flex-col gap-y-1 w-full text-justify">
                   <div className="flex w-full items-baseline pb-1">
                     <span className="mr-2">এতদ্বারা প্রত্যয়ন করা যাচ্ছে যে,</span>
                     <Field value={student.student_name} minWidth="320px" stretch />
                   </div>
                   <div className="flex w-full items-baseline pb-1">
                     <span>পিতা:</span>
                     <Field value={student.guardian_name || ''} minWidth="260px" stretch />
                     <span>, মাতা:</span>
                     <Field value={student.mother_name || ''} minWidth="260px" stretch />
                   </div>
                   <p className="text-justify mt-2" style={{ lineHeight: '1.9' }}>
                     <span>গ্রাম/এলাকা:</span>
                   <Field value={villageOrArea} minWidth="220px" />
                   <span>, ডাকঘর:</span>
                   <Field value={postOffice} minWidth="160px" />
                   <span>, উপজেলা:</span>
                   <Field value={upazila} minWidth="160px" />
                   <span>, জেলা:</span>
                   <Field value={district} minWidth="160px" />
                   <span>। অত্র প্রতিষ্ঠানের</span>
                   <Field value={student.className || ''} minWidth="180px" />
                   <span>শ্রেণির একজন নিয়মিত শিক্ষার্থী ছিল। তার রোল নং:</span>
                   <Field value={String(student.roll || '')} minWidth="120px" />
                   <span>।</span><br/>

                   <span className="mr-2 mt-4 inline-block">সে অদ্য</span>
                   <Field value={dateStr} minWidth="160px" />
                   <span>তারিখ পর্যন্ত প্রতিষ্ঠানের যাবতীয় পাওনা পরিশোধ করেছে। ভর্তির রেজিষ্টার অনুযায়ী তাঁর জন্ম তারিখ</span>
                   <Field value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : ''} minWidth="160px" />
                   <span>। </span>
                   <span>তার চরিত্র ও আচরণ ভালো। আমরা তার ভবিষ্যৎ জীবনের সাফল্য কামনা করি।</span>
                 </p>
                 </div>
               ) : (
                 <div className="flex flex-col gap-y-1 w-full text-justify">
                   <div className="flex w-full items-baseline pb-1">
                     <span className="mr-2">This is to certify that</span>
                     <Field value={student.name_en || student.student_name} minWidth="380px" stretch />
                   </div>
                   <div className="flex w-full items-baseline pb-1">
                     <span>son/daughter of</span>
                     <Field value={student.guardian_name || ''} minWidth="300px" stretch />
                     <span>and</span>
                     <Field value={student.mother_name || ''} minWidth="300px" stretch />
                   </div>
                   <p className="text-justify mt-2" style={{ lineHeight: '1.9' }}>
                     <span>, was a regular student of class</span>
                   <Field value={student.className || ''} minWidth="180px" />
                   <span>in this institution. His/Her Roll No was</span>
                   <Field value={String(student.roll || '')} minWidth="120px" />
                   <span>.</span><br/>

                   <span className="mr-2 mt-4 inline-block">He/She has cleared all institutional dues up to</span>
                   <Field value={dateStr} minWidth="160px" />
                   <span>. According to the admission register, his/her date of birth is</span>
                   <Field value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString('en-GB') : ''} minWidth="180px" />
                   <span>. His/Her character and conduct were good. We wish him/her success in future endeavors.</span>
                 </p>
                 </div>
               )}
             </div>
           )}

        </div>

        {/* --- Footer Area: Signatures and Stamp --- */}
        <div className="absolute bottom-[45px] left-0 w-full flex justify-between items-end z-30 px-[100px]">
           
           {/* Class Teacher Signature */}
           <div className="flex flex-col items-center">
              <span className="border-b-[1.5px] border-slate-400 w-40 mb-2"></span>
              <p className="text-[16px] font-bold text-[#0f2c59] tracking-wide">{isBn ? 'শ্রেণি শিক্ষক' : 'Class Teacher'}</p>
           </div>
           
           {/* Principal Signature */}
           <div className="flex flex-col items-center relative">
              <div className="flex items-center justify-center relative mb-1" style={{ height: `${madrasah?.config_json?.signature_height || 45}px` }}>
                {madrasah?.config_json?.signature_url && (
                  <img src={madrasah.config_json.signature_url} style={{ height: `${madrasah.config_json.signature_height || 45}px` }} className="object-contain mix-blend-multiply" alt="Sig" crossOrigin="anonymous" />
                )}
              </div>
              <span className="border-b-[1.5px] border-slate-400 w-48 mb-2"></span>
              <p className="text-[16px] font-bold text-[#0f2c59] tracking-wide">{isBn ? 'প্রধান শিক্ষক/অধ্যক্ষ' : 'Principal / Superintendent'}</p>
           </div>

        </div>

      </div>
    </div>
  );
};

