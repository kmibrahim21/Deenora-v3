import React, { useState } from "react";
import { ChevronLeft, Calendar as CalendarIcon, ArrowLeft, Settings, XCircle, Loader2, Save } from "lucide-react";
import MultiCalendar from "components/MultiCalendar";
import { Language, View, Institution } from "types";
import { supabase } from "supabase";

interface AcademicCalendarPageProps {
  lang: Language;
  onBack: () => void;
  madrasah: Institution | null;
  role: string;
}

const AcademicCalendarPage: React.FC<AcademicCalendarPageProps> = ({
  lang,
  onBack,
  madrasah,
  role,
}) => {
  const isDark = madrasah?.theme === "dark";
  const isAdmin = role === "madrasah_admin" || role === "super_admin";
  
  const [showSettings, setShowSettings] = useState(false);
  const [weeklyHolidays, setWeeklyHolidays] = useState<number[]>(madrasah?.config_json?.weekly_holidays || [5]); // Default Friday is 5
  const [isSaving, setIsSaving] = useState(false);

  const dayNamesBn = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNames = lang === 'bn' ? dayNamesBn : dayNamesEn;

  const toggleHoliday = (dayIndex: number) => {
    if (weeklyHolidays.includes(dayIndex)) {
      setWeeklyHolidays(weeklyHolidays.filter(d => d !== dayIndex));
    } else {
      setWeeklyHolidays([...weeklyHolidays, dayIndex]);
    }
  };

  const saveSettings = async () => {
    if (!madrasah) return;
    setIsSaving(true);
    try {
      const updatedConfig = {
        ...madrasah.config_json,
        weekly_holidays: weeklyHolidays
      };
      
      const { error } = await supabase
        .from('institutions')
        .update({ config_json: updatedConfig })
        .eq('id', madrasah.id);
        
      if (error) throw error;
      
      alert(lang === 'bn' ? 'সাপ্তাহিক ছুটি সেভ হয়েছে' : 'Weekly holidays saved');
      setShowSettings(false);
      window.location.reload();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`min-h-screen pb-24 ${isDark ? "bg-slate-950" : ""}`}>
      <div
        className={`px-4 py-4 flex items-center justify-between border-b ${isDark ? "bg-slate-900 border-slate-800" : "bg-transparent border-blue-100"}`}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm active:scale-95 transition-all ${isDark ? "bg-slate-800 text-blue-400 border-slate-700" : "bg-blue-50 text-[#2563EB] border-blue-100"}`}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1
              className={`text-lg font-black font-noto ${isDark ? "text-white" : "text-[#1E3A8A]"}`}
            >
              {lang === "bn" ? "একাডেমিক ক্যালেন্ডার" : "Academic Calendar"}
            </h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {madrasah?.name}
            </p>
          </div>
        </div>
        
        {isAdmin && (
          <button
            onClick={() => setShowSettings(true)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all ${isDark ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
          >
            <Settings size={18} />
          </button>
        )}
      </div>

      <div className="p-4 max-w-4xl mx-auto">
        <div
          className={`rounded-[2.5rem] p-6 shadow-bubble border ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
        >
          <MultiCalendar
            lang={lang}
            institutionId={madrasah?.id}
            isAdmin={isAdmin}
            madrasah={madrasah}
          />
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className={`rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border-4 animate-in zoom-in-95 duration-500 ${isDark ? 'bg-slate-900 border-slate-800 shadow-blue-500/10' : 'bg-white border-white shadow-slate-200/50'}`}>
            <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner ${isDark ? 'bg-slate-900 text-blue-400' : 'bg-white text-blue-600'}`}>
                  <CalendarIcon size={20} strokeWidth={2.5} />
                </div>
                <h2 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {lang === 'bn' ? 'সাপ্তাহিক ছুটি নির্বাচন' : 'Weekly Holidays'}
                </h2>
              </div>
              <button 
                onClick={() => setShowSettings(false)} 
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${isDark ? 'bg-slate-900 text-slate-400 hover:text-red-400 hover:bg-red-900/20' : 'bg-white text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-100'}`}
              >
                <XCircle size={22} />
              </button>
            </div>

            <div className={`p-6 space-y-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <p className="text-sm font-bold mb-4">
                {lang === 'bn' 
                  ? 'সপ্তাহের কোন দিনগুলোতে আপনার প্রতিষ্ঠানে ছুটি থাকে তা নির্বাচন করুন। এই দিনগুলোতে হাজিরা গ্রহণ বন্ধ থাকবে।' 
                  : 'Select the days of the week when your institution is closed. Attendance will be disabled on these days.'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {dayNames.map((day, index) => {
                  const isSelected = weeklyHolidays.includes(index);
                  return (
                    <button
                      key={index}
                      onClick={() => toggleHoliday(index)}
                      className={`h-12 flex items-center justify-center rounded-xl font-bold border-2 transition-all active:scale-95 ${
                        isSelected 
                          ? (isDark ? 'bg-blue-900/50 border-blue-500 text-blue-400' : 'bg-blue-50 border-[#2563EB] text-[#2563EB]') 
                          : (isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300')
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`p-6 border-t flex gap-4 ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'}`}>
              <button 
                onClick={() => setShowSettings(false)}
                className={`flex-1 h-12 font-black rounded-xl border-2 active:scale-95 transition-all text-xs uppercase tracking-widest ${isDark ? 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>
              <button 
                onClick={saveSettings}
                disabled={isSaving}
                className="flex-1 h-12 bg-[#2563EB] text-white font-black rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 hover:shadow-xl hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} strokeWidth={2.5} /> {lang === 'bn' ? 'সেভ করুন' : 'Save Changes'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendarPage;
