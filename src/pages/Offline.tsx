import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

const Offline: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-6 text-center z-[99999]">
      <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
        <WifiOff size={48} className="text-red-500" />
      </div>
      <h1 className="text-2xl font-black text-[#1E293B] mb-2 font-noto">
        আপনি অফলাইনে আছেন
      </h1>
      <p className="text-slate-500 font-medium mb-8 max-w-xs font-noto">
        অনুগ্রহ করে আপনার ইন্টারনেট সংযোগ পরীক্ষা করুন এবং আবার চেষ্টা করুন।
      </p>
      <button 
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 px-8 py-4 bg-[#2563EB] text-white rounded-2xl font-black shadow-premium active:scale-95 transition-all font-noto"
      >
        <RefreshCw size={20} />
        পুনরায় চেষ্টা করুন
      </button>
    </div>
  );
};

export default Offline;
