
import React, { useState } from 'react';
import { GraduationCap, ArrowRight, Plus, Loader2, AlertCircle, Users, Banknote } from 'lucide-react';
import { Institution, Language } from 'types';
import { useNavigate } from 'react-router-dom';

interface AcademicYearSetupRequiredProps {
  madrasah: Institution;
  lang: Language;
  onUpdate: () => void;
  isAdmin: boolean;
}

export const AcademicYearSetupRequired: React.FC<AcademicYearSetupRequiredProps> = ({ madrasah, lang, onUpdate, isAdmin }) => {
  const navigate = useNavigate();
  const isDark = madrasah.theme === 'dark';

  return (
    <div className={`min-h-[80vh] flex flex-col items-center justify-center p-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700`}>
      <div className={`relative mb-10`}>
        <div className={`absolute inset-0 blur-3xl opacity-20 bg-blue-500 animate-pulse`}></div>
        <div className={`relative w-28 h-28 rounded-[2.5rem] flex items-center justify-center shadow-2xl ${isDark ? 'bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 border border-white/10' : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'}`}>
          <GraduationCap size={56} strokeWidth={1.5} />
        </div>
      </div>

      <h1 className={`text-4xl font-black mb-6 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
        {lang === 'bn' ? 'শিক্ষাবর্ষ সেটআপ প্রয়োজন' : 'Academic Year Setup Required'}
      </h1>

      <p className={`text-lg max-w-lg mb-12 leading-relaxed font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
        {lang === 'bn' 
          ? 'আপনার প্রতিষ্ঠানের কার্যক্রম শুরু করার জন্য প্রথমে একটি শিক্ষাবর্ষ তৈরি করুন। এটি ছাত্র ভর্তি, হাজিরা এবং ফি ম্যানেজমেন্টের জন্য অপরিহার্য।' 
          : 'To start your institution\'s operations, please create an academic year first. This is essential for student enrollment, attendance, and fee management.'}
      </p>

      {isAdmin ? (
        <button
          onClick={() => navigate('/academic-year')}
          className="group relative flex items-center gap-4 px-12 py-5 bg-[#2563EB] hover:bg-blue-700 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-blue-600/30 transition-all hover:scale-105 active:scale-95"
        >
          <Plus size={28} />
          {lang === 'bn' ? 'শিক্ষাবর্ষ তৈরি করুন' : 'Create Academic Year'}
          <ArrowRight size={24} className="ml-2 group-hover:translate-x-2 transition-transform" />
        </button>
      ) : (
        <div className={`flex items-center gap-4 p-6 rounded-[2rem] border ${isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
          <AlertCircle size={32} />
          <p className="font-black text-lg">
            {lang === 'bn' 
              ? 'অনুগ্রহ করে আপনার অ্যাডমিনকে শিক্ষাবর্ষ সেটআপ করতে বলুন।' 
              : 'Please ask your administrator to setup the academic year.'}
          </p>
        </div>
      )}

      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl w-full">
        {[
          { icon: Plus, title: lang === 'bn' ? 'শিক্ষাবর্ষ তৈরি' : 'Create Year', desc: lang === 'bn' ? 'নতুন বছর শুরু করুন' : 'Start new year' },
          { icon: Users, title: lang === 'bn' ? 'ছাত্র ভর্তি' : 'Add Students', desc: lang === 'bn' ? 'ছাত্রদের তথ্য এড করুন' : 'Add student data' },
          { icon: Banknote, title: lang === 'bn' ? 'ফি ও হিসাব' : 'Fees & Finance', desc: lang === 'bn' ? 'সব হিসাব ম্যানেজ' : 'Manage all finances' },
        ].map((item, i) => (
          <div key={i} className={`p-8 rounded-[2.5rem] border transition-all hover:translate-y-[-4px] ${isDark ? 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800' : 'bg-white border-slate-100 shadow-sm hover:shadow-xl'}`}>
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 mx-auto ${isDark ? 'bg-slate-900 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <item.icon size={28} />
            </div>
            <h3 className={`font-black mb-2 text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h3>
            <p className={`text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
