import React from 'react';
import { Institution, Language, UserRole, Profile } from 'types';
import { ArrowLeft, Trophy } from 'lucide-react';

interface FinalResultsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
}

const FinalResults: React.FC<FinalResultsProps> = ({ lang, madrasah, onBack, role, profile }) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100">
            <ArrowLeft size={20}/>
          </button>
          <h1 className="text-xl font-black text-[#1E293B] font-noto">
            চূড়ান্ত ফলাফল (কওমি)
          </h1>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-bubble text-center space-y-4">
        <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trophy size={40} />
        </div>
        <h3 className="text-xl font-black text-[#1E3A8A]">চূড়ান্ত ফলাফল শীঘ্রই আসছে</h3>
        <p className="text-slate-500 max-w-md mx-auto">
            কাস্টম কওমি সিস্টেমের জন্য চূড়ান্ত ফলাফল মডিউলটি তৈরির কাজ চলছে।
        </p>
      </div>
    </div>
  );
};

export default FinalResults;
