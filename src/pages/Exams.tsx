
import React, { useState } from 'react';
import { Institution, Language, UserRole, Profile } from 'types';
import { ResultEngineProvider, useResultEngine } from 'components/results/ResultEngineProvider';
import SchoolResultEngine from 'components/results/engines/school/SchoolResultEngine';
import BefaqResultEngine from 'components/results/engines/befaq/BefaqResultEngine';
import QawmiResultEngine from 'components/results/engines/qawmi/QawmiResultEngine';

import { AlertCircle } from 'lucide-react';

interface ExamsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  activeYear?: any;
  onNavigateToFinalResults?: () => void;
  profile?: Profile | null;
}

const ExamsContent: React.FC<ExamsProps> = (props) => {
  const { engine: defaultEngine } = useResultEngine();
  const [activeEngineOverride, setActiveEngineOverride] = useState<'school' | 'befaq' | null>(null);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  const isTeacher = props.role === 'teacher';
  const canManageExams = !isTeacher || props.profile?.permissions?.can_manage_results || props.profile?.permissions?.can_manage_exams;

  if (!canManageExams) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className={`text-xl font-black ${props.madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'} mb-2`}>
          {props.lang === 'bn' ? 'আপনার অনুমতি নেই' : 'Access Denied'}
        </h2>
        <p className={`text-slate-500 mb-6 ${props.madrasah?.theme === 'dark' ? 'text-slate-400' : ''}`}>
          {props.lang === 'bn' 
            ? 'আপনার এই মডিউলটি ব্যবহার করার অনুমতি নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' 
            : 'You do not have permission to access this module. Please contact your administrator.'}
        </p>
        <button onClick={props.onBack} className={`px-8 py-3 ${props.madrasah?.theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white'} rounded-full font-black`}>
          {props.lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
        </button>
      </div>
    );
  }

  const handleSwitchEngineAndClass = (targetEngine: 'school' | 'befaq', classId: string) => {
    setActiveEngineOverride(targetEngine);
    setActiveClassId(classId);
  };

  const handleClassBack = () => {
    setActiveClassId(null);
    setActiveEngineOverride(null);
  };

  const currentEngine = activeEngineOverride || defaultEngine;

  switch (currentEngine) {
    case 'befaq':
      return (
        <BefaqResultEngine 
          {...props} 
          initialClassId={activeClassId}
          onSwitchEngineAndClass={handleSwitchEngineAndClass}
          onClassBack={handleClassBack}
        />
      );
    case 'qawmi_custom':
      return <QawmiResultEngine {...props} />;
    case 'school':
    default:
      return (
        <SchoolResultEngine 
          {...props} 
          initialClassId={activeClassId}
          onSwitchEngineAndClass={handleSwitchEngineAndClass}
          onClassBack={handleClassBack}
        />
      );
  }
};

const Exams: React.FC<ExamsProps> = (props) => {
  if (!props.madrasah) return null;

  return (
    <ResultEngineProvider institution={props.madrasah}>
      <ExamsContent {...props} />
    </ResultEngineProvider>
  );
};

export default Exams;
