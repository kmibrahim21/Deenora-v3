
import React from 'react';
import { ChevronLeft, Calendar as CalendarIcon } from 'lucide-react';
import MultiCalendar from 'components/MultiCalendar';
import { Language, View, Institution } from 'types';

interface AcademicCalendarPageProps {
  lang: Language;
  onBack: () => void;
  madrasah: Institution | null;
  role: string;
}

const AcademicCalendarPage: React.FC<AcademicCalendarPageProps> = ({ lang, onBack, madrasah, role }) => {
  const isDark = madrasah?.theme === 'dark';

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      <div className={`sticky top-0 z-30 px-4 py-4 flex items-center gap-4 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <button onClick={onBack} className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className={`text-lg font-black font-noto ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
            {lang === 'bn' ? 'একাডেমিক ক্যালেন্ডার' : 'Academic Calendar'}
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {madrasah?.name}
          </p>
        </div>
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        <div className={`rounded-[2.5rem] p-6 shadow-bubble border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <MultiCalendar 
            lang={lang} 
            institutionId={madrasah?.id} 
            isAdmin={role === 'madrasah_admin' || role === 'super_admin'} 
            madrasah={madrasah}
          />
        </div>
      </div>
    </div>
  );
};

export default AcademicCalendarPage;
