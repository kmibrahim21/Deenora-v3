
import React from 'react';
import { ADMISSION_T } from './constants';
import { AdmissionFormData, AdmissionFormLang } from './types';
import { Save, Eye, Camera } from 'lucide-react';

interface Props {
  formData: AdmissionFormData;
  setFormData: React.Dispatch<React.SetStateAction<AdmissionFormData>>;
  lang: AdmissionFormLang;
  onPreview: () => void;
}

const AdmissionForm: React.FC<Props> = ({ formData, setFormData, lang, onPreview }) => {
  const t = ADMISSION_T[lang];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (doc: string) => {
    setFormData(prev => {
      const currentDocs = prev.documentsChecked || [];
      const docs = currentDocs.includes(doc)
        ? currentDocs.filter(d => d !== doc)
        : [...currentDocs, doc];
      return { ...prev, documentsChecked: docs };
    });
  };

  const Input = ({ label, name, type = "text", placeholder = "" }: { label: string, name: keyof AdmissionFormData, type?: string, placeholder?: string }) => (
    <div className="space-y-1.5">
      <label className="text-sm font-bold text-slate-700 font-noto">{label}</label>
      <input
        type={type}
        name={name}
        value={(formData[name] as string) || ''}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium"
      />
    </div>
  );

  return (
    <div className="space-y-8 bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100">
      {/* Header Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Input label={t.formNumber} name="formNumber" placeholder="ADM-001" />
        <Input label={t.admissionDate} name="admissionDate" type="date" />
        <Input label={t.academicYear} name="academicYear" placeholder="2024" />
        <Input label={t.session} name="session" placeholder="January-December" />
      </div>

      <hr className="border-slate-100" />

      {/* Student Info */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
            <h2 className="text-lg font-black text-slate-800 font-noto uppercase tracking-tight">{t.studentInfo}</h2>
          </div>
          <div className="relative group">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setFormData(prev => ({ ...prev, photoUrl: reader.result as string }));
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center bg-slate-50 group-hover:border-blue-400 transition-colors overflow-hidden relative">
              {formData.photoUrl ? (
                <>
                  <img src={formData.photoUrl} alt="Student" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera size={20} className="text-white" />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center mb-1 group-hover:bg-blue-100 transition-colors">
                    <Camera size={14} className="text-slate-400 group-hover:text-blue-500" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Photo</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Input label={t.studentName} name="studentName" />
          <Input label={t.studentNameEn} name="studentNameEn" />
          <Input label={t.dateOfBirth} name="date_of_birth" type="date" />
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 font-noto">{t.gender}</label>
            <select
              name="gender"
              value={formData.gender || 'male'}
              onChange={handleChange}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium"
            >
              <option value="male">{t.male}</option>
              <option value="female">{t.female}</option>
              <option value="other">{t.other}</option>
            </select>
          </div>
          <Input label={t.nationality} name="nationality" />
          <Input label={t.religion} name="religion" />
          <Input label={t.bloodGroup} name="blood_group" />
          <Input label={t.admissionClass} name="admissionClass" />
        </div>
      </section>

      <hr className="border-slate-100" />

      {/* Parent Info */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
          <h2 className="text-lg font-black text-slate-800 font-noto uppercase tracking-tight">{t.parentInfo}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Input label={t.fatherName} name="fatherName" />
          <Input label={t.fatherOccupation} name="fatherOccupation" />
          <Input label={t.motherName} name="motherName" />
          <Input label={t.motherOccupation} name="motherOccupation" />
          <Input label={t.guardianName} name="guardian_name" />
          <Input label={t.guardianRelation} name="guardianRelation" />
          <div className="sm:col-span-2">
            <Input label={t.guardianPhone} name="guardian_phone" placeholder="017XXXXXXXX" />
          </div>
        </div>
      </section>

      <hr className="border-slate-100" />

      {/* Address */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
          <h2 className="text-lg font-black text-slate-800 font-noto uppercase tracking-tight">{t.addressInfo}</h2>
        </div>
        <div className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 font-noto">{t.presentAddress}</label>
            <textarea
              name="presentAddress"
              value={formData.presentAddress || ''}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700 font-noto">{t.permanentAddress}</label>
            <textarea
              name="permanentAddress"
              value={formData.permanentAddress || ''}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm font-medium resize-none"
            />
          </div>
        </div>
      </section>

      <hr className="border-slate-100" />

      {/* Prev Inst */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
          <h2 className="text-lg font-black text-slate-800 font-noto uppercase tracking-tight">{t.prevInstInfo}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Input label={t.previousInstitution} name="previousInstitution" />
          <Input label={t.previousClass} name="previousClass" />
        </div>
      </section>

      <hr className="border-slate-100" />

      {/* Documents */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
          <h2 className="text-lg font-black text-slate-800 font-noto uppercase tracking-tight">{t.documents}</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { id: 'birth', label: t.docBirthCert },
            { id: 'tc', label: t.docPrevTC },
            { id: 'nid', label: t.docParentNID },
            { id: 'photos', label: t.docPhotos },
          ].map(doc => (
            <label key={doc.id} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-blue-50 transition-colors">
              <input
                type="checkbox"
                checked={(formData.documentsChecked || []).includes(doc.id)}
                onChange={() => handleCheckboxChange(doc.id)}
                className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-bold text-slate-700 font-noto">{doc.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 pt-6">
        <button
          onClick={onPreview}
          className="flex-1 py-4 bg-slate-100 text-slate-700 font-black rounded-2xl flex items-center justify-center gap-3 hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
        >
          <Eye size={20} />
          {t.preview}
        </button>
        <button
          onClick={onPreview} // For now, just go to preview/download
          className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
        >
          <Eye size={20} />
          {lang === 'bn' ? 'প্রিভিউ ও ডাউনলোড' : 'Preview & Download'}
        </button>
      </div>
    </div>
  );
};

export default AdmissionForm;
