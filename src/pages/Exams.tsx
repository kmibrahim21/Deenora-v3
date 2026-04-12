
import React from 'react';
import { Institution, Language, UserRole, Profile } from 'types';
import { ResultEngineProvider, useResultEngine } from 'components/results/ResultEngineProvider';
import SchoolResultEngine from 'components/results/engines/school/SchoolResultEngine';
import BefaqResultEngine from 'components/results/engines/befaq/BefaqResultEngine';
import QawmiResultEngine from 'components/results/engines/qawmi/QawmiResultEngine';

import { AlertCircle } from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { useMadrasah } from '../contexts/MadrasahContext';

const ExamsContent: React.FC = () => {
  const { lang, madrasah, role, activeYear, profile } = useMadrasah();
  const navigate = useNavigate();
  const onBack = () => navigate(-1);
  const onNavigateToFinalResults = () => navigate('/final-results');

  const { engine } = useResultEngine();
  const isTeacher = role === 'teacher';
  const canManageExams = !isTeacher || profile?.permissions?.can_manage_results || profile?.permissions?.can_manage_exams;

  if (!canManageExams) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <AlertCircle size={60} className="text-red-500 mb-4" />
        <h2 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-800'} mb-2`}>
          {lang === 'bn' ? 'আপনার অনুমতি নেই' : 'Access Denied'}
        </h2>
        <p className={`text-slate-500 mb-6 ${madrasah?.theme === 'dark' ? 'text-slate-400' : ''}`}>
          {lang === 'bn' 
            ? 'আপনার এই মডিউলটি ব্যবহার করার অনুমতি নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।' 
            : 'You do not have permission to access this module. Please contact your administrator.'}
        </p>
        <button onClick={onBack} className={`px-8 py-3 ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white'} rounded-full font-black`}>
          {lang === 'bn' ? 'ফিরে যান' : 'Go Back'}
        </button>
      </div>
    );
  }

  const props = { lang, madrasah, onBack, role, activeYear, onNavigateToFinalResults, profile };

  switch (engine) {
    case 'befaq':
      return <BefaqResultEngine {...props} />;
    case 'qawmi_custom':
      return <QawmiResultEngine {...props} />;
    case 'school':
    default:
      return <SchoolResultEngine {...props} />;
  }
};

const Exams: React.FC = () => {
  const { madrasah } = useMadrasah();
  if (!madrasah) return null;

  return (
    <ResultEngineProvider institution={madrasah}>
      <ExamsContent />
    </ResultEngineProvider>
  );
};

export default Exams;
