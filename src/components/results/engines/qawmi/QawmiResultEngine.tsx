import React, { useState, useEffect } from 'react';
import { Institution, Language, UserRole, Profile, Class } from 'types';
import { ArrowLeft, Settings, BookOpen, ChevronRight } from 'lucide-react';
import { supabase } from 'supabase';
import { sortMadrasahClasses } from '../../../../pages/Classes';

interface QawmiResultEngineProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
}

const QawmiResultEngine: React.FC<QawmiResultEngineProps> = ({ lang, madrasah, onBack, role, profile }) => {
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (madrasah) {
      fetchClasses();
    }
  }, [madrasah?.id]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes')
      .select('*')
      .eq('institution_id', madrasah?.id)
      .order('sort_order', { ascending: true });
    if (data) {
      let filteredClasses = data;
      if (profile?.role === 'teacher' && profile?.permissions?.allowed_classes) {
        filteredClasses = data.filter(cls => profile.permissions?.allowed_classes?.includes(cls.id));
      }
      setClasses(sortMadrasahClasses(filteredClasses));
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={selectedClassId ? () => setSelectedClassId(null) : onBack} className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
            <ArrowLeft size={20}/>
          </button>
          <h1 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E293B]'} font-noto`}>
            {selectedClassId ? classes.find(c => c.id === selectedClassId)?.class_name : 'কওমি ফলাফল (কাস্টম)'}
          </h1>
        </div>
      </div>

      {!selectedClassId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-amber-100 border-t-amber-600 rounded-full animate-spin"></div>
            </div>
          ) : classes.map(cls => (
            <button
              key={cls.id}
              onClick={() => setSelectedClassId(cls.id)}
              className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-6 rounded-[2rem] border shadow-bubble flex items-center justify-between hover:border-amber-200 transition-all active:scale-95`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${madrasah?.theme === 'dark' ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'} rounded-2xl flex items-center justify-center`}><BookOpen size={24}/></div>
                <h3 className={`text-lg font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'} font-noto`}>{cls.class_name}</h3>
              </div>
              <ChevronRight className="text-slate-300" />
            </button>
          ))}
        </div>
      ) : (
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} p-8 rounded-[2.5rem] border shadow-bubble text-center space-y-4`}>
          <div className={`w-20 h-20 ${madrasah?.theme === 'dark' ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'} rounded-full flex items-center justify-center mx-auto mb-4`}>
              <Settings size={40} />
          </div>
          <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>কাস্টমাইজড রেজাল্ট সিস্টেম</h3>
          <p className="text-slate-500 max-w-md mx-auto">
              এই মডিউলটি কওমি মাদ্রাসার জন্য বিশেষভাবে তৈরি করা হচ্ছে। এখানে আপনি আপনার মাদ্রাসার নিয়ম অনুযায়ী ফলাফল তৈরি করতে পারবেন।
          </p>
          <div className="pt-4">
              <span className={`px-4 py-2 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-500'} rounded-full text-xs font-black uppercase tracking-widest`}>শীঘ্রই আসছে</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default QawmiResultEngine;
