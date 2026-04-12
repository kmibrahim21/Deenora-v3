import React from 'react';
import { format } from 'date-fns';
import { Calendar, Globe, Moon, Sun } from 'lucide-react';
import { getBengaliDate, getHijriDate } from '../utils/calendarUtils';
import { Institution } from 'types';

interface MultiCalendarHeaderProps {
  madrasah: Institution | null;
}

const MultiCalendarHeader: React.FC<MultiCalendarHeaderProps> = ({ madrasah }) => {
  const today = new Date();
  const bnDate = getBengaliDate(today);
  const hjDate = getHijriDate(today);

  return (
    <div className="px-5 md:px-10 py-6 bg-transparent shrink-0">
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        {/* English Date */}
        <div className={`flex items-center gap-3 backdrop-blur-2xl border p-3.5 lg:p-5 rounded-3xl shadow-soft hover:shadow-md transition-all flex-1 min-w-0 group ${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white/60 border-white/80'}`}>
          <div className={`w-9 h-9 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/10 text-blue-600'}`}>
            <Calendar size={18} className="lg:hidden" />
            <Calendar size={24} className="hidden lg:block" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[10px] lg:text-[12px] font-black uppercase tracking-widest leading-none mb-1.5 lg:mb-2 ${madrasah?.theme === 'dark' ? 'text-blue-400/60' : 'text-blue-500/60'}`}>ইংরেজি</span>
            <span className={`text-[12px] lg:text-[15px] font-black truncate leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{format(today, 'd MMM, yy')}</span>
          </div>
        </div>

        {/* Bengali Date */}
        <div className={`flex items-center gap-3 backdrop-blur-2xl border p-3.5 lg:p-5 rounded-3xl shadow-soft hover:shadow-md transition-all flex-1 min-w-0 group ${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white/60 border-white/80'}`}>
          <div className={`w-9 h-9 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500/10 text-emerald-600'}`}>
            <Sun size={18} className="lg:hidden" />
            <Sun size={24} className="hidden lg:block" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[10px] lg:text-[12px] font-black uppercase tracking-widest leading-none mb-1.5 lg:mb-2 font-noto ${madrasah?.theme === 'dark' ? 'text-emerald-400/60' : 'text-emerald-500/60'}`}>বাংলা</span>
            <span className={`text-[12px] lg:text-[15px] font-black truncate leading-none font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{bnDate.fullBn.split(',')[0]}</span>
          </div>
        </div>

        {/* Hijri Date */}
        <div className={`flex items-center gap-3 backdrop-blur-2xl border p-3.5 lg:p-5 rounded-3xl shadow-soft hover:shadow-md transition-all flex-1 min-w-0 group ${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white/60 border-white/80'}`}>
          <div className={`w-9 h-9 lg:w-12 lg:h-12 rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-500/10 text-amber-600'}`}>
            <Moon size={18} className="lg:hidden" />
            <Moon size={24} className="hidden lg:block" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[10px] lg:text-[12px] font-black uppercase tracking-widest leading-none mb-1.5 lg:mb-2 font-noto ${madrasah?.theme === 'dark' ? 'text-amber-400/60' : 'text-amber-500/60'}`}>হিজরি</span>
            <span className={`text-[12px] lg:text-[15px] font-black truncate leading-none font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{hjDate.fullBn.split(',')[0]}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiCalendarHeader;
