import React from 'react';
import {
  ArrowLeft,
  FileText,
  Award,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Lock,
  ChevronRight,
  FileQuestion
} from 'lucide-react';
import { Language, Institution, Profile, View } from 'types';
import { hasAdmissionFormAccess } from 'utils/packageUtils';

interface AcademicDocumentsProps {
  lang: Language;
  onBack: () => void;
  madrasah: Institution | null;
  role: string;
  profile?: Profile | null;
  onNavigate: (view: View) => void;
  onUpgradeClick?: () => void;
}

export const AcademicDocuments: React.FC<AcademicDocumentsProps> = ({
  lang,
  onBack,
  madrasah,
  role,
  onNavigate,
  onUpgradeClick,
}) => {
  const isDark = madrasah?.theme === 'dark';
  const isSuperAdmin = role === 'super_admin';
  const isAdmin = role === 'madrasah_admin' || isSuperAdmin;
  const canAccessAdmissionForm = hasAdmissionFormAccess(madrasah, isAdmin);
  
  const configObj = madrasah?.config_json || {} as any;
  const modulesConfig = configObj.modules || {} as any;
  
  const hasCertificates = modulesConfig.certificates ?? true;
  const hasClassRoutine = modulesConfig.class_routine ?? false;
  const hasIdCards = modulesConfig.id_cards ?? false;
  const hasQuestionBank = (modulesConfig.question_bank === true) || isSuperAdmin;

  const allModules = [
    {
      id: 'question-builder' as View,
      title: lang === 'bn' ? 'প্রশ্ন ব্যাংক ও প্রশ্নপত্র মেকার' : 'Question Bank & Paper Studio',
      subtitle: lang === 'bn' ? '৬২,০০০+ প্রশ্ন ও অটো বিল্ডার' : '62,000+ Questions & Builder',
      desc: lang === 'bn' ? 'নূরানী, বেফাক, আলিয়া ও NCTB প্রশ্নপত্র ড্র্যাগ-অ্যান্ড-ড্রপে তৈরি ও প্রিন্ট করুন' : 'Create & print customized exam question papers with Noorani, Befaq & NCTB banks',
      icon: Sparkles,
      colorClass: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
      borderHover: 'hover:border-indigo-300 dark:hover:border-indigo-500/50',
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      restricted: !hasQuestionBank,
      badge: !hasQuestionBank ? (lang === 'bn' ? 'লকড' : 'Locked') : (lang === 'bn' ? '✨ নতুন' : '✨ New'),
      show: hasQuestionBank,
      onClick: () => onNavigate('question-builder'),
    },
    {
      id: 'admission-form' as View,
      title: lang === 'bn' ? 'ভর্তি ফরম' : 'Admission Form',
      subtitle: lang === 'bn' ? 'ভর্তি আবেদন ফরম' : 'Admission Form',
      desc: lang === 'bn' ? 'কাস্টমাইজড ভর্তি আবেদন ফরম তৈরি ও প্রিন্ট করুন' : 'Create & print customized admission forms',
      icon: FileText,
      colorClass: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
      borderHover: 'hover:border-blue-300 dark:hover:border-blue-500/50',
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      restricted: !canAccessAdmissionForm,
      badge: !canAccessAdmissionForm ? (lang === 'bn' ? 'স্ট্যান্ডার্ড+' : 'Standard+') : null,
      show: true,
      onClick: () => {
        if (!canAccessAdmissionForm) {
          if (onUpgradeClick) {
            onUpgradeClick();
          } else {
            alert(
              lang === 'bn'
                ? 'ভর্তি ফরম ফিচারটি ব্যবহারের জন্য অ্যাকাউন্ট সক্রিয় থাকতে হবে এবং স্ট্যান্ডার্ড থেকে আল্টিমেট প্যাকেজে আপগ্রেড করতে হবে।'
                : 'Admission Form feature requires an Active account on Standard to Ultimate Package.'
            );
            onNavigate('account');
          }
          return;
        }
        onNavigate('admission-form');
      },
    },
    {
      id: 'certificates' as View,
      title: lang === 'bn' ? 'সার্টিফিকেট' : 'Certificates',
      subtitle: lang === 'bn' ? 'সনদ ও প্রশংসাপত্র' : 'Certificates & Testimonials',
      desc: lang === 'bn' ? 'শিক্ষার্থীদের প্রশংসাপত্র, প্রত্যয়নপত্র ও সনদ তৈরি করুন' : 'Generate certificates and testimonials',
      icon: Award,
      colorClass: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
      borderHover: 'hover:border-amber-300 dark:hover:border-amber-500/50',
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      restricted: false,
      badge: null,
      show: hasCertificates,
      onClick: () => onNavigate('certificates'),
    },
    {
      id: 'class-routine' as View,
      title: lang === 'bn' ? 'ক্লাস রুটিন' : 'Class Routine',
      subtitle: lang === 'bn' ? 'শ্রেণিভিত্তিক সময়সূচী' : 'Class Schedule',
      desc: lang === 'bn' ? 'পিরিয়ড, বিষয় ও শিক্ষকভিত্তিক ক্লাস রুটিন তৈরি ও প্রিন্ট' : 'Class routines, periods and teacher assignments',
      icon: LayoutDashboard,
      colorClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
      borderHover: 'hover:border-emerald-300 dark:hover:border-emerald-500/50',
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      restricted: false,
      badge: null,
      show: hasClassRoutine,
      onClick: () => onNavigate('class-routine'),
    },
    {
      id: 'id-cards' as View,
      title: lang === 'bn' ? 'স্টুডেন্ট আইডি কার্ড' : 'Student ID Card',
      subtitle: lang === 'bn' ? 'স্মার্ট আইডি কার্ড' : 'ID Card Generator',
      desc: lang === 'bn' ? 'শিক্ষার্থীদের ছবি ও তথ্যসহ স্মার্ট আইডি কার্ড প্রিন্ট করুন' : 'Generate & print student identity cards with photos',
      icon: ShieldCheck,
      colorClass: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
      borderHover: 'hover:border-teal-300 dark:hover:border-teal-500/50',
      iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
      restricted: false,
      badge: null,
      show: hasIdCards,
      onClick: () => onNavigate('id-cards'),
    },
  ];

  const modules = allModules.filter(m => m.show);

  return (
    <div className={`min-h-screen pb-24 ${isDark ? 'bg-slate-900' : ''}`}>
      {/* Header Bar */}
      <div
        className={`${
          isDark ? 'bg-slate-800 border-slate-700' : 'bg-transparent border-blue-100'
        } px-4 py-4 flex items-center gap-4 border-b`}
      >
        <button
          onClick={onBack}
          className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm active:scale-95 transition-all ${
            isDark
              ? 'bg-slate-800 text-blue-400 border-slate-700 hover:bg-slate-700'
              : 'bg-blue-50 text-[#2563EB] border-blue-100 hover:bg-blue-100'
          }`}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1
              className={`text-lg font-black font-noto ${
                isDark ? 'text-white' : 'text-[#1E3A8A]'
              }`}
            >
              {lang === 'bn' ? 'একাডেমিক ডকুমেন্টস' : 'Academic Documents'}
            </h1>
            <span className="p-1 rounded-lg bg-blue-500/10 text-[#2563EB] dark:text-blue-400">
              <Sparkles size={14} />
            </span>
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-noto">
            {lang === 'bn'
              ? 'ভর্তি ফরম, সনদ, রুটিন ও স্টুডেন্ট আইডি কার্ড'
              : 'Forms, Certificates, Routine & ID Cards'}
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={m.onClick}
                className={`${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                } p-5 sm:p-6 rounded-[2rem] border shadow-bubble flex items-start justify-between gap-4 active:scale-[0.98] transition-all text-left group ${
                  m.borderHover
                } ${m.restricted ? 'opacity-90' : ''}`}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform ${m.iconBg}`}
                  >
                    <Icon size={26} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3
                        className={`text-base font-black font-noto leading-tight ${
                          isDark ? 'text-white' : 'text-[#1E3A8A]'
                        }`}
                      >
                        {m.title}
                      </h3>
                      {m.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center gap-1">
                          <Lock size={10} />
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 font-noto leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                </div>

                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    isDark
                      ? 'bg-slate-700/60 text-slate-400 group-hover:bg-blue-900/30 group-hover:text-blue-400'
                      : 'bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-[#2563EB]'
                  }`}
                >
                  {m.restricted ? (
                    <Lock size={16} className="text-amber-500" />
                  ) : (
                    <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AcademicDocuments;
