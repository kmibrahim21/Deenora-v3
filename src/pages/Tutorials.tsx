
import React, { useState, useEffect } from 'react';
import { ChevronLeft, Play, Youtube, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from 'supabase';
import { Language, Tutorial, Institution } from 'types';

interface TutorialsProps {
  lang: Language;
  onBack: () => void;
  madrasah: Institution | null;
}

const Tutorials: React.FC<TutorialsProps> = ({ lang, onBack, madrasah }) => {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTutorials();
  }, []);

  const fetchTutorials = async () => {
    try {
      const { data, error } = await supabase
        .from('tutorials')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setTutorials(data || []);
    } catch (err) {
      console.error('Error fetching tutorials:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen pb-24 ${madrasah?.theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} sticky top-0 z-30 px-4 py-4 flex items-center gap-4 border-b`}>
        <button onClick={onBack} className={`w-10 h-10 rounded-xl flex items-center justify-center active:scale-95 transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-slate-300' : 'bg-slate-50 text-slate-400'}`}>
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className={`text-lg font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
            {lang === 'bn' ? 'টিউটোরিয়াল' : 'Tutorials'}
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {lang === 'bn' ? 'এপ চালনোর ভিডিও গাইড' : 'App Usage Video Guides'}
          </p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="animate-spin mb-4" size={32} />
            <p className="text-sm font-bold">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</p>
          </div>
        ) : tutorials.length === 0 ? (
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[2.5rem] p-10 text-center border shadow-bubble`}>
            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4 ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-slate-500' : 'bg-slate-50 text-slate-300'}`}>
              <Youtube size={32} />
            </div>
            <p className="text-slate-400 font-bold">
              {lang === 'bn' ? 'কোন টিউটোরিয়াল পাওয়া যায়নি' : 'No tutorials found'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {tutorials.map((tutorial) => (
              <a 
                key={tutorial.id}
                href={tutorial.url || (tutorial as any).youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} p-5 rounded-[2rem] border shadow-bubble flex items-center gap-5 active:scale-[0.98] transition-all group`}
              >
                <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Play size={24} fill="currentColor" />
                </div>
                <div className="flex-1">
                  <h3 className={`text-sm font-black leading-tight mb-1 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{tutorial.title}</h3>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Youtube size={12} />
                    <span className="text-[10px] font-black uppercase tracking-widest">YouTube</span>
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-slate-500 group-hover:bg-blue-900/30 group-hover:text-blue-400' : 'bg-slate-50 text-slate-300 group-hover:bg-blue-50 group-hover:text-[#2563EB]'}`}>
                  <ExternalLink size={16} />
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Tutorials;
