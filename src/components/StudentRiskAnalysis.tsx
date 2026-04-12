
import React, { useState, useEffect, memo } from 'react';
import { supabase } from 'supabase';
import { Language, Student, Institution } from 'types';
import { t } from 'translations';
import { AlertTriangle, ShieldCheck, Zap, Loader2, ChevronRight, User, GraduationCap, Clock, TrendingDown } from 'lucide-react';
import { isValidUUID } from 'utils/validation';

const localT = {
  analyzingRisks: { en: 'Analyzing Risks...', bn: 'ঝুঁকি বিশ্লেষণ করা হচ্ছে...' },
  showLess: { en: 'Show Less', bn: 'কম দেখান' },
  showAll: { en: 'Show All', bn: 'সব দেখান' },
};

interface RiskData {
  student_id: string;
  student_name: string;
  class_name: string;
  roll: number;
  attendance_pct: number;
  late_count: number;
  latest_avg: number;
  dropout_risk: 'safe' | 'warning' | 'high';
  late_risk: 'safe' | 'warning' | 'high';
  result_risk: 'safe' | 'warning' | 'high';
}

interface RiskAnalysisProps {
  institutionId: string;
  lang: Language;
  onStudentClick: (student: any) => void;
  madrasah: Institution | null;
}

const StudentRiskAnalysis: React.FC<RiskAnalysisProps> = memo(({ institutionId, lang, onStudentClick, madrasah }) => {
  const [risks, setRisks] = useState<RiskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchRisks();
  }, [institutionId]);

  const fetchRisks = async () => {
    if (!isValidUUID(institutionId)) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_student_risk_analysis', { p_madrasah_id: institutionId });
      if (error) throw error;
      if (data) setRisks(data);
    } catch (err) {
      console.error('Risk Analysis Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const highRisks = risks.filter(r => r.dropout_risk === 'high' || r.late_risk === 'high' || r.result_risk === 'high');
  const warningRisks = risks.filter(r => 
    (r.dropout_risk === 'warning' || r.late_risk === 'warning' || r.result_risk === 'warning') && 
    !(r.dropout_risk === 'high' || r.late_risk === 'high' || r.result_risk === 'high')
  );

  const displayedRisks = expanded ? [...highRisks, ...warningRisks] : highRisks.slice(0, 3);

  if (loading) return (
    <div className="glass-card p-8 flex items-center justify-center gap-4">
      <Loader2 className="animate-spin text-blue-500" size={24} />
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{localT.analyzingRisks[lang]}</span>
    </div>
  );

  return (
    <div className="space-y-5 px-1 animate-in fade-in duration-700">
      <div className="flex items-center justify-between px-4">
        <div className="section-header">
          <div className="section-header-dot bg-red-500"></div>
          <h2 className="section-title">
            {t('prediction_system', lang)}
          </h2>
        </div>
        { (highRisks.length > 3 || warningRisks.length > 0) && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            className={`text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl transition-all active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}
          >
            {expanded ? localT.showLess[lang] : localT.showAll[lang]}
          </button>
        )}
      </div>

      <div className="space-y-3">
        {displayedRisks.length > 0 ? displayedRisks.map((risk) => (
          <div 
            key={risk.student_id} 
            onClick={() => onStudentClick({ id: risk.student_id, student_name: risk.student_name, roll: risk.roll })}
            className={`glass-card p-5 flex items-center justify-between active:scale-[0.98] transition-all group cursor-pointer border-transparent hover:border-red-500/20`}
          >
            <div className="flex items-center gap-5 min-w-0 flex-1">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-premium transition-transform group-hover:scale-110 ${
                risk.dropout_risk === 'high' || risk.late_risk === 'high' || risk.result_risk === 'high' 
                ? (madrasah?.theme === 'dark' ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-500')
                : (madrasah?.theme === 'dark' ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-50 text-orange-500')
              }`}>
                <AlertTriangle size={26} />
              </div>
              <div className="min-w-0">
                <h3 className={`font-black text-base font-noto truncate leading-tight ${madrasah?.theme === 'dark' ? 'text-slate-200' : 'text-[#1E3A8A]'}`}>{risk.student_name}</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {risk.dropout_risk !== 'safe' && (
                    <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${
                      risk.dropout_risk === 'high' ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'
                    }`}>
                      <TrendingDown size={10} /> {t('dropout_risk', lang)}
                    </span>
                  )}
                  {risk.late_risk !== 'safe' && (
                    <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${
                      risk.late_risk === 'high' ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'
                    }`}>
                      <Clock size={10} /> {t('late_regularity', lang)}
                    </span>
                  )}
                  {risk.result_risk !== 'safe' && (
                    <span className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm ${
                      risk.result_risk === 'high' ? 'bg-red-500 text-white' : 'bg-orange-400 text-white'
                    }`}>
                      <GraduationCap size={10} /> {t('result_decline', lang)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:bg-red-500 group-hover:text-white ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
              <ChevronRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        )) : (
          <div className="glass-card p-12 text-center space-y-4">
            <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-500'}`}>
              <ShieldCheck size={48} />
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{t('no_risk_found', lang)}</p>
          </div>
        )}
      </div>
    </div>
  );
});

export default StudentRiskAnalysis;
