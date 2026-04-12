import React from 'react';
import { Institution, Language, UserRole, Profile } from 'types';
import { ResultEngineProvider, useResultEngine } from 'components/results/ResultEngineProvider';
import SchoolFinalResults from 'components/results/engines/school/FinalResults';
import BefaqFinalResults from 'components/results/engines/befaq/FinalResults';
import QawmiFinalResults from 'components/results/engines/qawmi/FinalResults';
import { useMadrasah } from '../contexts/MadrasahContext';
import { useNavigate } from 'react-router-dom';

import { AlertCircle } from 'lucide-react';

interface FinalResultsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  profile?: Profile | null;
}

const FinalResultsContent: React.FC = () => {
  const { lang, madrasah, role, profile } = useMadrasah();
  const navigate = useNavigate();
  const onBack = () => navigate(-1);
  const { engine } = useResultEngine();
  const isTeacher = role === 'teacher';
  const canManageResults = !isTeacher || profile?.permissions?.can_manage_results || profile?.permissions?.can_manage_exams;

  if (!canManageResults) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className="text-xl font-black text-slate-800 mb-2">
          {lang === 'bn' ? 'আপনার অনুমতি নেই' : 'Access Denied'}
        </h2>
        <p className="text-slate-500 mb-6">
          {lang === 'bn' 
            ? 'আপনার এই মডিউলটি ব্যবহার করার অনুমতি নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' 
            : 'You do not have permission to access this module. Please contact your administrator.'}
        </p>
        <button onClick={onBack} className="px-8 py-3 bg-slate-800 text-white rounded-full font-black">
          {lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
        </button>
      </div>
    );
  }

  const props = { lang, madrasah, onBack, role, profile };

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

const FinalResults: React.FC = () => {
  const { madrasah } = useMadrasah();
  if (!madrasah) return null;

  return (
    <ResultEngineProvider institution={madrasah}>
      <FinalResultsContent />
    </ResultEngineProvider>
  );
};

export default FinalResults;
