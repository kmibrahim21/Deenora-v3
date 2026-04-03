import React from 'react';
import { Institution, Language, UserRole, Profile } from 'types';
import { ResultEngineProvider, useResultEngine } from 'components/results/ResultEngineProvider';
import SchoolFinalResults from 'components/results/engines/school/FinalResults';
import BefaqFinalResults from 'components/results/engines/befaq/FinalResults';
import QawmiFinalResults from 'components/results/engines/qawmi/FinalResults';

import { AlertCircle } from 'lucide-react';

interface FinalResultsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
}

const FinalResultsContent: React.FC<FinalResultsProps> = (props) => {
  const { engine } = useResultEngine();
  const isTeacher = props.role === 'teacher';
  const canManageResults = !isTeacher || props.profile?.permissions?.can_manage_results || props.profile?.permissions?.can_manage_exams;

  if (!canManageResults) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-slate-800 mb-2">
          {props.lang === 'bn' ? 'আপনার অনুমতি নেই' : 'Access Denied'}
        </h2>
        <p className="text-slate-500 mb-6">
          {props.lang === 'bn' 
            ? 'আপনার এই মডিউলটি ব্যবহার করার অনুমতি নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' 
            : 'You do not have permission to access this module. Please contact your administrator.'}
        </p>
        <button onClick={props.onBack} className="px-8 py-3 bg-slate-800 text-white rounded-full font-black">
          {props.lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
        </button>
      </div>
    );
  }

  switch (engine) {
    case 'befaq':
      return <BefaqFinalResults {...props} />;
    case 'qawmi_custom':
      return <QawmiFinalResults {...props} />;
    case 'school':
    default:
      return <SchoolFinalResults {...props} />;
  }
};

const FinalResults: React.FC<FinalResultsProps> = (props) => {
  if (!props.madrasah) return null;

  return (
    <ResultEngineProvider institution={props.madrasah}>
      <FinalResultsContent {...props} />
    </ResultEngineProvider>
  );
};

export default FinalResults;
