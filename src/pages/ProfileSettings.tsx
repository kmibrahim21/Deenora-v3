import React, { useState } from 'react';
import { ChevronLeft, Edit3, Loader2, Key, Image as ImageIcon, Upload } from 'lucide-react';
import { supabase } from '../supabase';
import { Institution, Language } from '../types';

interface Props {
  madrasah: Institution | null;
  lang: Language;
  onBack: () => void;
  onProfileUpdate?: () => void;
  setStatusModal: (s: any) => void;
}

const ProfileSettings: React.FC<Props> = ({ madrasah, lang, onBack, onProfileUpdate, setStatusModal }) => {
  const [newName, setNewName] = useState(madrasah?.name || '');
  const [newAddress, setNewAddress] = useState(madrasah?.address || '');
  const [newPhone, setNewPhone] = useState(madrasah?.phone || '');
  const [logoUrl, setLogoUrl] = useState(madrasah?.logo_url || '');
  const [voiceSenderId, setVoiceSenderId] = useState(madrasah?.voice_sender_id || '');
  const [newPin, setNewPin] = useState(madrasah?.config_json?.user_pin || '');
  const [saving, setSaving] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState(madrasah?.config_json?.signature_url || '');
  const [signatureHeight, setSignatureHeight] = useState(madrasah?.config_json?.signature_height || 30);

  const modules = madrasah?.config_json?.modules;
  const packageRaw = madrasah?.config_json?.package_name || madrasah?.config_json?.subscription?.package_name || '1';
  const packageNumber = String(packageRaw);

  // Map package names to numbers if needed, or check for specific labels
  const isPremiumPackage = 
    ['FINANCE', 'PROFESSIONAL', 'ENTERPRISE', 'ENTERPRISE PLUS', 'ফিনান্স', 'প্রফেশনাল', 'এন্টারপ্রাইজ'].includes(packageNumber.toUpperCase()) ||
    ['7', '8', '9'].includes(packageNumber) ||
    packageNumber.toUpperCase().includes('ENTERPRISE PLUS');

  const compressAndResizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > height) {
            if (width > maxWidth) { height = Math.round((height *= maxWidth / width)); width = maxWidth; }
          } else {
            if (height > maxHeight) { width = Math.round((width *= maxHeight / height)); height = maxHeight; }
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Failed to get context'));
          
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => { if (blob) resolve(blob); else reject(new Error('Failed to create blob')); }, 'image/webp', 0.9);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleUpdate = async () => {
    if (!madrasah) return;
    setSaving(true);
    try {
      const updatedConfig = { 
        ...madrasah.config_json, 
        user_pin: newPin.trim(), 
        signature_url: signatureUrl,
        signature_height: signatureHeight
      };
      const { error } = await supabase.from('institutions').update({ 
        name: newName.trim(), 
        address: newAddress.trim() || null,
        phone: newPhone.trim(), 
        voice_sender_id: voiceSenderId.trim() || null,
        logo_url: logoUrl,
        config_json: updatedConfig
      }).eq('id', madrasah.id);
      
      if (error) throw error;
      if (onProfileUpdate) onProfileUpdate();
      setStatusModal({ show: true, type: 'success', title: 'সাফল্য', message: 'Profile updated successfully' });
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'signature') => {
    const file = e.target.files?.[0];
    if (!file || !madrasah) return;
    setSaving(true);
    try {
      // Delete old file if exists
      const oldUrl = type === 'logo' ? logoUrl : signatureUrl;
      if (oldUrl && oldUrl.includes('madrasah-assets/')) {
        const oldFileName = oldUrl.split('madrasah-assets/').pop();
        if (oldFileName) {
          await supabase.storage.from('madrasah-assets').remove([oldFileName]);
        }
      }

      const size = type === 'signature' ? 200 : 600;
      const compressedBlob = await compressAndResizeImage(file, size, size);
      const fileName = `${type}_${madrasah.id}_${Date.now()}.webp`;
      try { await supabase.storage.createBucket('madrasah-assets', { public: true }); } catch (bucketError) {}
      const { error: uploadError } = await supabase.storage.from('madrasah-assets').upload(fileName, compressedBlob, { contentType: 'image/webp', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('madrasah-assets').getPublicUrl(fileName);
      
      if (type === 'logo') setLogoUrl(publicUrl);
      else if (type === 'signature') setSignatureUrl(publicUrl);
    } catch (error: any) {
      alert("Error uploading photo: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-[calc(100vh-60px)] md:h-screen w-full relative ${madrasah?.theme === 'dark' ? 'bg-[#0f172a] text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className={`p-4 md:p-6 flex items-center justify-between sticky top-0 z-50 shadow-sm ${madrasah?.theme === 'dark' ? 'bg-[#1e293b]/90 backdrop-blur-md border-b border-slate-800' : 'bg-white/80 backdrop-blur-md border-b border-slate-100'}`}>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className={`w-10 h-10 rounded-[1.2rem] border flex items-center justify-center transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} active:scale-95`}>
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black font-noto tracking-tight">{lang === 'bn' ? 'প্রোফাইল সেটিংস' : 'Profile Settings'}</h1>
            <p className="text-[11px] font-bold text-slate-400 font-noto">{lang === 'bn' ? 'ব্র্যান্ডিং এবং তথ্য আপডেট' : 'Update branding and information'}</p>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className={`p-6 rounded-[2rem] border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
            <h2 className={`text-sm font-black mb-4 uppercase tracking-widest ${madrasah?.theme === 'dark' ? 'text-blue-400' : 'text-[#2563EB]'}`}>ব্যক্তিগত তথ্য</h2>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">প্রতিষ্ঠানের নাম</label>
                <input type="text" className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 focus:border-blue-500/30 text-white' : 'bg-slate-50 border-slate-100 focus:border-[#2563EB]/30 text-slate-900'}`} value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">ঠিকানা</label>
                <input type="text" className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 focus:border-blue-500/30 text-white' : 'bg-slate-50 border-slate-100 focus:border-[#2563EB]/30 text-slate-900'}`} value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">মোবাইল নাম্বার</label>
                <input type="tel" className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 focus:border-blue-500/30 text-white' : 'bg-slate-50 border-slate-100 focus:border-[#2563EB]/30 text-slate-900'}`} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>

              {modules.voice_broadcast && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">ভয়েস সেন্ডার আইডি</label>
                  <input type="text" placeholder="e.g. 8801700000000" className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 focus:border-blue-500/30 text-white' : 'bg-slate-50 border-slate-100 focus:border-[#2563EB]/30 text-slate-900'}`} value={voiceSenderId} onChange={(e) => setVoiceSenderId(e.target.value)} />
                </div>
              )}

              <div className="space-y-1 opacity-70 cursor-not-allowed">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center justify-between">
                  Gmail / Email
                  <span className="text-[8px] text-red-400 lowercase tracking-normal bg-red-500/10 px-1.5 py-0.5 rounded-md">read-only</span>
                </label>
                <input type="email" readOnly disabled className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none cursor-not-allowed ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`} value={madrasah?.email || (lang === 'bn' ? 'অ্যাসাইন করা হয়নি' : 'Not assigned')} />
              </div>
              <div className="space-y-1 opacity-70 cursor-not-allowed">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center justify-between">
                  {lang === 'bn' ? 'অ্যাকাউন্ট পিন' : 'Account PIN'}
                  <span className="text-[8px] text-red-400 lowercase tracking-normal bg-red-500/10 px-1.5 py-0.5 rounded-md">read-only</span>
                </label>
                <input 
                  type="text" 
                  readOnly 
                  disabled
                  className={`w-full h-12 border rounded-xl px-4 font-black text-sm outline-none cursor-not-allowed font-mono ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`} 
                  value={madrasah?.config_json?.user_pin || ''} 
                />
              </div>
            </div>
          </div>

          {isPremiumPackage && (
            <div className={`p-6 rounded-[2rem] border shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <h2 className={`text-sm font-black mb-4 uppercase tracking-widest flex items-center gap-2 ${madrasah?.theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}>
                প্রধান শিক্ষকের স্বাক্ষর <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 text-[8px] rounded-md border border-emerald-100 dark:border-emerald-500/20">প্রিমিয়াম ফিচার</span>
              </h2>
              
              <div className="flex flex-col items-center">
                {/* Signature Upload */}
                <div className={`flex flex-col items-center p-4 border-2 border-dashed rounded-[1.5rem] w-full max-w-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/50 border-slate-200'}`}>
                   <h3 className="text-[11px] font-black uppercase mb-3 text-slate-500">স্বাক্ষর (Signature)</h3>
                   <div className={`relative group w-full min-h-[100px] py-4 rounded-xl overflow-hidden border flex items-center justify-center shrink-0 mb-3 shadow-sm ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                      {signatureUrl ? (
                         <img 
                           src={signatureUrl} 
                           alt="Signature" 
                           className="object-contain p-2 transition-all duration-300" 
                           style={{ height: `${signatureHeight * 1.5}px` }}
                           crossOrigin="anonymous"
                        />
                      ) : (
                         <div className="text-slate-300 font-black flex flex-col items-center gap-2">
                           <Edit3 size={24} />
                           <span className="text-[9px]">No Signature</span>
                         </div>
                      )}
                      <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm">
                        <Upload className="text-white" size={24} />
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'signature')} disabled={saving} />
                      </label>
                   </div>
                   <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest">স্বচ্ছ স্বাক্ষর ছবি দিন</p>
                </div>

                <div className="w-full max-w-sm mt-4 p-4 border rounded-xl bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">স্বাক্ষরের সাইজ (Signature Size)</label>
                    <span className="text-[10px] font-black text-[#2563EB]">{signatureHeight}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="15" 
                    max="80" 
                    value={signatureHeight} 
                    onChange={(e) => setSignatureHeight(Number(e.target.value))} 
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[8px] text-slate-400 font-bold">MIN</span>
                    <span className="text-[8px] text-slate-400 font-bold">MAX</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4">
             <button onClick={handleUpdate} disabled={saving} className="w-full h-14 bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-black rounded-[1.5rem] text-[13px] uppercase shadow-premium flex items-center justify-center gap-2 active:scale-95 transition-all">
                {saving ? <Loader2 className="animate-spin" size={18} /> : (lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save Changes')}
             </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
