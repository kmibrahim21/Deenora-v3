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
    <div className="px-4 py-4 bg-transparent shrink-0">
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        {/* English Date */}
        <div className={`flex items-center gap-2 backdrop-blur-xl border p-2.5 lg:p-4 rounded-2xl lg:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all flex-1 min-w-0 group ${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white/40 border-white/60'}`}>
          <div className={`w-8 h-8 lg:w-11 lg:h-11 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/10 text-blue-600'}`}>
            <Calendar size={16} className="lg:hidden" />
            <Calendar size={22} className="hidden lg:block" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[9px] lg:text-[11px] font-black uppercase tracking-widest leading-none mb-1 lg:mb-1.5 ${madrasah?.theme === 'dark' ? 'text-blue-400/60' : 'text-blue-500/60'}`}>ইংরেজি</span>
            <span className={`text-[13px] lg:text-[17px] font-black truncate leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{format(today, 'd MMM, yy')}</span>
          </div>
        </div>

        {/* Bengali Date */}
        <div className={`flex items-center gap-2 backdrop-blur-xl border p-2.5 lg:p-4 rounded-2xl lg:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all flex-1 min-w-0 group ${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white/40 border-white/60'}`}>
          <div className={`w-8 h-8 lg:w-11 lg:h-11 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500/10 text-emerald-600'}`}>
            <Sun size={16} className="lg:hidden" />
            <Sun size={22} className="hidden lg:block" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[9px] lg:text-[11px] font-black uppercase tracking-widest leading-none mb-1 lg:mb-1.5 font-noto ${madrasah?.theme === 'dark' ? 'text-emerald-400/60' : 'text-emerald-500/60'}`}>বাংলা</span>
            <span className={`text-[13px] lg:text-[17px] font-black truncate leading-none font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{bnDate.fullBn.split(',')[0]}</span>
          </div>
        </div>

        {/* Hijri Date */}
        <div className={`flex items-center gap-2 backdrop-blur-xl border p-2.5 lg:p-4 rounded-2xl lg:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all flex-1 min-w-0 group ${madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700/60' : 'bg-white/40 border-white/60'}`}>
          <div className={`w-8 h-8 lg:w-11 lg:h-11 rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform ${madrasah?.theme === 'dark' ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-500/10 text-amber-600'}`}>
            <Moon size={16} className="lg:hidden" />
            <Moon size={22} className="hidden lg:block" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={`text-[9px] lg:text-[11px] font-black uppercase tracking-widest leading-none mb-1 lg:mb-1.5 font-noto ${madrasah?.theme === 'dark' ? 'text-amber-400/60' : 'text-amber-500/60'}`}>হিজরি</span>
            <span className={`text-[13px] lg:text-[17px] font-black truncate leading-none font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>{hjDate.fullBn.split(',')[0]}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiCalendarHeader;
