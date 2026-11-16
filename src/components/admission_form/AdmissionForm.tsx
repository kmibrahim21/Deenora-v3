import React from 'react';
import { ADMISSION_T } from './constants';
import { AdmissionFormData, AdmissionFormLang } from './types';
import { Eye, Camera, RotateCcw, UserPlus, Save, Download, Sparkles, CheckCircle2 } from 'lucide-react';
import { DobPicker } from '../common/DobPicker';

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
  lang: AdmissionFormLang;
  classes?: any[];
  selectedClassId?: string;
  onClassChange?: (classId: string, className: string) => void;
  isExistingStudent?: boolean;
  isSavingStudent?: boolean;
  onSaveStudent?: (andDownloadPdf: boolean) => void;
  onDownloadOnly?: () => void;
  onClearNewForm?: () => void;
  onPreview?: () => void;
  onResetData?: () => void;
}

const AdmissionForm: React.FC<Props> = ({
  formData,
  setFormData,
  lang,
  classes = [],
  selectedClassId = '',
  onClassChange,
  isExistingStudent = false,
  isSavingStudent = false,
  onSaveStudent,
  onDownloadOnly,
  onClearNewForm,
  onPreview,
  onResetData,
}) => {
  const t = ADMISSION_T[lang];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (doc: string) => {
    setFormData((prev) => {
      const currentDocs = prev.documentsChecked || [];
      const docs = currentDocs.includes(doc)
        ? currentDocs.filter((d) => d !== doc)
        : [...currentDocs, doc];
      return { ...prev, documentsChecked: docs };
    });
  };

  const Input = ({
    label,
    name,
    type = 'text',
    placeholder = '',
    required = false,
  }: {
    label: string;
    name: keyof AdmissionFormData;
    type?: string;
    placeholder?: string;
    required?: boolean;
  }) => (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-noto block">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={formData[name] !== undefined && formData[name] !== null ? String(formData[name]) : ''}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-xs font-bold dark:text-slate-100"
      />
    </div>
  );

  return (
    <div className="space-y-5 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-[2rem] shadow-sm border border-slate-200 dark:border-slate-800">
      {/* Top Mode Banner & Quick Actions */}
      <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-1 ${
                isExistingStudent
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
              }`}
            >
              <Sparkles size={10} />
              {isExistingStudent
                ? lang === 'bn'
                  ? 'বিদ্যমান শিক্ষার্থী সম্পাদনা মোড'
                  : 'Existing Student Edit Mode'
                : lang === 'bn'
                ? 'নতুন শিক্ষার্থী অনলাইন ভর্তি মোড'
                : 'New Student Online Admission'}
            </span>
            <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm font-noto">
              {isExistingStudent
                ? lang === 'bn'
                  ? `${formData.studentName || 'শিক্ষার্থী'}-এর তথ্য আপডেট`
                  : `Update ${formData.studentName || 'Student'}`
                : lang === 'bn'
                ? 'নতুন শিক্ষার্থী ভর্তি ও ফরম পূরণ'
                : 'New Student Admission & Form Fill'}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onClearNewForm && (
              <button
                type="button"
                onClick={onClearNewForm}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black flex items-center gap-1 hover:bg-emerald-100 transition-all cursor-pointer"
                title={lang === 'bn' ? 'নতুন শিক্ষার্থী ভর্তির জন্য ফরম খালি করুন' : 'Clear form for a new student'}
              >
                <UserPlus size={12} />
                <span>{lang === 'bn' ? 'নতুন ফরম' : 'New Form'}</span>
              </button>
            )}
            {onResetData && (
              <button
                type="button"
                onClick={onResetData}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 hover:bg-slate-200 cursor-pointer"
                title={lang === 'bn' ? 'নমুনা ডাটা লোড করুন' : 'Load sample data'}
              >
                <RotateCcw size={12} />
                <span>{lang === 'bn' ? 'নমুনা' : 'Sample'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Primary Online Admission Action Buttons */}
        {onSaveStudent && (
          <div className="grid grid-cols-1 gap-2 pt-1">
            <button
              type="button"
              disabled={isSavingStudent}
              onClick={() => onSaveStudent(true)}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all text-xs cursor-pointer disabled:opacity-50"
            >
              <Download size={15} />
              <span>
                {isSavingStudent
                  ? lang === 'bn'
                    ? 'ক্লাসে সেভ হচ্ছে...'
                    : 'Saving to Class...'
                  : isExistingStudent
                  ? lang === 'bn'
                    ? 'তথ্য আপডেট ও ফরম PDF ডাউনলোড করুন'
                    : 'Update Student & Download PDF'
                  : lang === 'bn'
                  ? 'ক্লাসে ভর্তি করুন ও ফরম PDF ডাউনলোড করুন'
                  : 'Admit to Class & Download PDF'}
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSavingStudent}
                onClick={() => onSaveStudent(false)}
                className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all text-[11px] cursor-pointer disabled:opacity-50"
              >
                <Save size={13} />
                <span>
                  {isExistingStudent
                    ? lang === 'bn'
                      ? 'শুধু তথ্য আপডেট করুন'
                      : 'Update Only'
                    : lang === 'bn'
                    ? 'শুধু ক্লাসে ভর্তি সেভ করুন'
                    : 'Save to Class Only'}
                </span>
              </button>

              {onDownloadOnly && (
                <button
                  type="button"
                  onClick={onDownloadOnly}
                  className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 active:scale-95 text-white font-black rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all text-[11px] cursor-pointer"
                >
                  <Download size={13} />
                  <span>{lang === 'bn' ? 'শুধু PDF ডাউনলোড' : 'Download PDF Only'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* A. Institutional & Metadata */}
      <div className="grid grid-cols-2 gap-3">
        <Input label={t.formNumber} name="formNumber" placeholder="ADM-2026-001" />
        <Input label={t.admissionDate} name="admissionDate" type="date" />
        <Input label={t.academicYear} name="academicYear" placeholder="২০২৬" />
        <Input label={t.session} name="session" placeholder="২০২৬-২০২৭" />
      </div>

      <hr className="border-slate-100 dark:border-slate-800" />

      {/* B. Student Info & Class Assignment */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 font-noto uppercase">{t.studentInfo}</h4>
          </div>
          <label className="relative group cursor-pointer">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setFormData((prev) => ({ ...prev, photoUrl: reader.result as string }));
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="hidden"
            />
            <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black flex items-center gap-1 border border-blue-200 dark:border-blue-800">
              <Camera size={12} />
              {lang === 'bn' ? 'ছবি যুক্ত/পরিবর্তন' : 'Photo'}
            </span>
          </label>
        </div>

        {/* Class Selector Box (Highlighted for Online Admission) */}
        <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 space-y-2.5">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-blue-900 dark:text-blue-300 font-noto block">
              {lang === 'bn' ? 'ভর্তিচ্ছু ক্লাস / শ্রেণি নির্বাচন করুন (অনলাইন ভর্তির জন্য) *' : 'Select Class for Online Admission *'}
            </label>
            <select
              value={selectedClassId || formData.class_id || ''}
              onChange={(e) => {
                const cId = e.target.value;
                const foundCls = classes.find((c) => c.id === cId);
                const cName = foundCls ? foundCls.class_name : formData.admissionClass || '';
                setFormData((prev) => ({
                  ...prev,
                  class_id: cId,
                  admissionClass: cName,
                }));
                if (onClassChange) onClassChange(cId, cName);
              }}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-700 rounded-xl outline-none text-xs font-black text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="">{lang === 'bn' ? '-- ক্লাস নির্বাচন করুন --' : '-- Select Class --'}</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.class_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label={lang === 'bn' ? 'ফরমে প্রদর্শিত শ্রেণির নাম' : 'Displayed Class Name'}
              name="admissionClass"
              placeholder="হিফজ / প্রথম শ্রেণি"
            />
            <Input
              label={lang === 'bn' ? 'ক্লাস রোল নম্বর' : 'Class Roll No'}
              name="roll"
              placeholder="01"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label={t.studentName} name="studentName" required placeholder="শিক্ষার্থীর বাংলা নাম" />
          <Input label={t.studentNameEn} name="studentNameEn" placeholder="STUDENT NAME (ENGLISH)" />
          <Input label={t.username} name="username" placeholder="ST-2026-01" />
          <Input label={t.biometricId} name="biometricId" placeholder="101" />
          <div className="sm:col-span-2">
            <Input label={t.birthRegNo} name="birthRegNo" placeholder="১৭-ডিজিট জন্ম নিবন্ধন নম্বর" />
          </div>
          <DobPicker
            label={t.dateOfBirth}
            value={formData.date_of_birth || ''}
            onChange={(val) => setFormData((prev) => ({ ...prev, date_of_birth: val }))}
            lang={lang === 'bn' ? 'bn' : 'en'}
          />
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 font-noto block">{t.gender}</label>
            <select
              name="gender"
              value={formData.gender || 'male'}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold dark:text-slate-100"
            >
              <option value="male">{t.male}</option>
              <option value="female">{t.female}</option>
              <option value="other">{t.other}</option>
            </select>
          </div>
          <Input label={t.bloodGroup} name="blood_group" placeholder="O+" />
          <Input label={t.religion} name="religion" placeholder="ইসলাম" />
          <Input label={t.nationality} name="nationality" placeholder="বাংলাদেশী" />
          <Input label={t.department} name="department" placeholder="নূরানী / নাজেরা / হিফজ / কিতাব" />
          <div className="sm:col-span-2">
            <Input label={t.residentialStatus} name="residentialStatus" placeholder="আবাসিক / অনাবাসিক / ডে-কেয়ার" />
          </div>
        </div>
      </section>

      <hr className="border-slate-100 dark:border-slate-800" />

      {/* C. Parent Info */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 font-noto uppercase">{t.parentInfo}</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label={t.fatherName} name="fatherName" />
          <Input label={t.fatherOccupation} name="fatherOccupation" />
          <div className="sm:col-span-2">
            <Input label={t.fatherNid} name="fatherNid" />
          </div>
          <Input label={t.motherName} name="motherName" />
          <Input label={t.motherOccupation} name="motherOccupation" />
          <div className="sm:col-span-2">
            <Input label={t.motherNid} name="motherNid" />
          </div>
          <Input label={t.guardianName} name="guardian_name" required />
          <Input label={t.guardianRelation} name="guardianRelation" />
          <Input label={t.guardianPhone} name="guardian_phone" required placeholder="017XXXXXXXX" />
          <Input label={t.whatsappNumber} name="whatsappNumber" placeholder="017XXXXXXXX" />
          <div className="sm:col-span-2">
            <Input label={t.emergencyPhone} name="emergencyPhone" placeholder="018XXXXXXXX" />
          </div>
        </div>
      </section>

      <hr className="border-slate-100 dark:border-slate-800" />

      {/* D. Address & Academic History */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 font-noto uppercase">{t.addressInfo}</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Input label={t.presentAddress} name="presentAddress" />
          </div>
          <div className="sm:col-span-2">
            <Input label={t.permanentAddress} name="permanentAddress" />
          </div>
          <Input label={t.previousInstitution} name="previousInstitution" />
          <Input label={t.previousClass} name="previousClass" />
          <div className="sm:col-span-2">
            <Input label={t.tcNumber} name="tcNumber" />
          </div>
        </div>
      </section>

      <hr className="border-slate-100 dark:border-slate-800" />

      {/* E. Fees & Financials */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 font-noto uppercase">{t.financialInfo}</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label={t.admissionFee} name="admissionFee" placeholder="৳ ২০০০" />
          <Input label={t.monthlyFee} name="monthlyFee" placeholder="৳ ১২০০" />
          <Input label={t.receiptNumber} name="receiptNumber" placeholder="MR-1001" />
        </div>
      </section>

      <hr className="border-slate-100 dark:border-slate-800" />

      {/* F. Documents Checklist */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-4 bg-blue-600 rounded-full" />
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 font-noto uppercase">{t.documents}</h4>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {[
            { id: 'birth', label: t.docBirthCert },
            { id: 'parentNID', label: t.docParentNID },
            { id: 'photos', label: t.docPhotos },
            { id: 'tc', label: t.docPrevTC },
          ].map((doc) => (
            <label
              key={doc.id}
              className="flex items-center gap-2.5 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer hover:bg-blue-50/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={(formData.documentsChecked || []).includes(doc.id)}
                onChange={() => handleCheckboxChange(doc.id)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-noto">{doc.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Bottom Sticky Action Buttons */}
      {onSaveStudent && (
        <div className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            disabled={isSavingStudent}
            onClick={() => onSaveStudent(true)}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all text-xs cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            <span>
              {isSavingStudent
                ? lang === 'bn'
                  ? 'ক্লাসে ভর্তি সেভ হচ্ছে...'
                  : 'Saving Student...'
                : isExistingStudent
                ? lang === 'bn'
                  ? 'তথ্য আপডেট ও ভর্তি ফরম PDF ডাউনলোড করুন'
                  : 'Update Student & Download Form PDF'
                : lang === 'bn'
                ? 'ক্লাসে ভর্তি সম্পন্ন ও ফরম PDF ডাউনলোড করুন'
                : 'Complete Class Admission & Download PDF'}
            </span>
          </button>
        </div>
      )}

      {onPreview && (
        <button
          type="button"
          onClick={onPreview}
          className="w-full py-3 bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all text-xs cursor-pointer"
        >
          <Eye size={16} />
          {lang === 'bn' ? 'প্রিভিউ ও ডাউনলোড ট্যাবে যান' : 'Go to Preview & Download'}
        </button>
      )}
    </div>
  );
};

export default AdmissionForm;
