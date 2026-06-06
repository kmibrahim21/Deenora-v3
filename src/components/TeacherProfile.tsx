import React, { useState } from 'react';
import { Camera, User, Phone, Briefcase, Calendar, CheckCircle2, Shield, X, Lock, Edit3, Trash2, ArrowLeft, Mail, MapPin } from 'lucide-react';
import { supabase } from 'supabase';
import { Teacher, Language, Institution } from 'types';

interface TeacherProfileProps {
  teacher: Teacher;
  madrasah: Institution;
  lang: Language;
  onBack: () => void;
  onTeacherUpdate: (updatedTeacher: Teacher) => void;
  onEdit: (teacher: Teacher) => void;
  onDelete: (teacherId: string) => void;
}

const compressAndResizeImage = (file: File, maxWidth = 450, maxHeight = 450): Promise<Blob> => {
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
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get 2D context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas toBlob returned null'));
            }
          },
          'image/webp',
          0.6
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const TeacherProfile: React.FC<TeacherProfileProps> = ({ teacher, madrasah, lang, onBack, onTeacherUpdate, onEdit, onDelete }) => {
  const isDark = madrasah?.theme === 'dark';
  const [photoUrl, setPhotoUrl] = useState(teacher.photo_url || '');
  const [uploading, setUploading] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploading(true);

    try {
      const compressedBlob = await compressAndResizeImage(file, 450, 450);

      try {
        await supabase.storage.createBucket('madrasah-assets', { public: true });
      } catch (bucketError) {}
      
      // Delete old photo
      const oldPhotoUrl = teacher.photo_url || photoUrl;
      if (oldPhotoUrl) {
        try {
          const urlWithoutQuery = oldPhotoUrl.split('?')[0];
          const marker = 'teacher_photos/';
          const markerIndex = urlWithoutQuery.indexOf(marker);
          if (markerIndex !== -1) {
            const storagePath = urlWithoutQuery.substring(markerIndex);
            await supabase.storage
              .from('madrasah-assets')
              .remove([storagePath]);
          }
        } catch (storageDelErr) {
          console.error('Failed to clean up old image from storage:', storageDelErr);
        }
      }

      const fileName = `teacher_photo_${teacher.id}_${Date.now()}.webp`;
      const filePath = `teacher_photos/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('madrasah-assets').upload(filePath, compressedBlob, {
        cacheControl: '2592000',
        contentType: 'image/webp',
        upsert: true
      });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('madrasah-assets').getPublicUrl(filePath);
      const publicUrl = publicUrlData.publicUrl;

      // Update in db
      const { error: updateError } = await supabase.from('teachers').update({ photo_url: publicUrl }).eq('id', teacher.id);
      
      if (updateError) throw updateError;

      setPhotoUrl(publicUrl);
      onTeacherUpdate({ ...teacher, photo_url: publicUrl });

    } catch (error: any) {
      alert("Error uploading photo: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      {/* Top Banner Area */}
      <div className={`relative h-48 sm:h-64 rounded-t-[2.5rem] overflow-hidden ${isDark ? 'bg-gradient-to-br from-blue-900/60 to-slate-900' : 'bg-gradient-to-br from-blue-500 to-blue-700'}`}>
        <div className="absolute inset-0 bg-black/10" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
        
        {/* Navigation Actions */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between">
          <button 
            onClick={onBack} 
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(teacher)}
              className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md flex items-center justify-center text-white transition-colors"
            >
              <Edit3 size={18} />
            </button>
            <button
              onClick={() => onDelete(teacher.id)}
              className="w-10 h-10 rounded-full bg-red-500/80 hover:bg-red-600 backdrop-blur-md flex items-center justify-center text-white transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`-mt-20 relative px-6 sm:px-10 pb-10 rounded-[2.5rem] ${isDark ? 'bg-slate-900 text-white shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.5)]' : 'bg-white text-slate-900 shadow-[0_-15px_40px_-15px_rgba(0,0,20,0.1)]'}`}>
        
        {/* Avatar Section */}
        <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8 -translate-y-6 sm:-translate-y-12">
          <div className="relative group">
            <div className={`w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border-8 flex items-center justify-center z-10 relative ${isDark ? 'bg-slate-800 border-slate-900' : 'bg-blue-50 border-white shadow-xl'}`}>
              {photoUrl ? (
                 <img src={photoUrl} alt={teacher.name} className="w-full h-full object-cover" />
              ) : (
                 <User size={64} className="text-blue-200" />
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                  <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>
            {madrasah?.config_json?.modules?.student_photo && (
              <label className="absolute -bottom-2 -right-2 w-12 h-12 bg-blue-600 text-white rounded-2xl shadow-xl flex items-center justify-center cursor-pointer hover:bg-blue-700 hover:scale-105 active:scale-95 transition-all z-20 tooltip" data-tip="Change Photo">
                <Camera size={20} />
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              </label>
            )}
          </div>

          <div className="text-center sm:text-left flex-1 pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
              <h2 className="text-2xl sm:text-3xl font-black">{teacher.name}</h2>
              {teacher.is_active && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-black uppercase tracking-widest self-center">
                  <CheckCircle2 size={14} /> {lang === 'bn' ? 'সক্রিয়' : 'Active'}
                </span>
              )}
            </div>
            <p className="font-bold text-slate-500 flex items-center justify-center sm:justify-start gap-1.5 uppercase tracking-widest text-[11px]">
              <Briefcase size={14} /> {teacher.designation || (lang === 'bn' ? 'শিক্ষক' : 'Teacher')}
            </p>
          </div>
        </div>

        {/* Contact Strip */}
        <div className={`p-4 rounded-2xl mb-8 flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-6 flex-wrap ${isDark ? 'bg-slate-800/50 text-slate-300' : 'bg-slate-50/80 text-slate-600'}`}>
          <a href={`tel:${teacher.phone}`} className="flex items-center gap-2 hover:text-blue-500 transition-colors">
            <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
              <Phone size={16} />
            </div>
            <span className="font-bold font-mono">{teacher.phone}</span>
          </a>
          <div className="hidden sm:block w-px h-8 bg-slate-300 dark:bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${isDark ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-600'}`}>
              <Calendar size={16} />
            </div>
            <span className="font-bold text-sm">{lang === 'bn' ? 'যোগদান:' : 'Joined:'} {new Date(teacher.join_date || teacher.created_at || Date.now()).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          {teacher.pin && (
            <>
              <div className="hidden sm:block w-px h-8 bg-slate-300 dark:bg-slate-700" />
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
                  <Lock size={16} />
                </div>
                <span className="font-bold text-sm">PIN/Pass: {teacher.pin}</span>
              </div>
            </>
          )}
          {teacher.address && (
            <>
              <div className="hidden sm:block w-px h-8 bg-slate-300 dark:bg-slate-700" />
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${isDark ? 'bg-emerald-900/30 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                  <Briefcase size={16} />
                </div>
                <span className="font-bold text-sm line-clamp-1">{teacher.address}</span>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Salary Card */}
          <div className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
            <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-400 mb-5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              {lang === 'bn' ? 'বেতন' : 'Compensation'}
            </h4>
            
            <div className="flex items-end gap-3">
              <span className="text-4xl font-black tracking-tighter">৳{teacher.basic_salary || '0'}</span>
              <span className="text-sm font-bold text-slate-400 mb-1">/{lang === 'bn' ? 'মাসিক' : 'month'}</span>
            </div>
          </div>

          {/* Module Access Card */}
          <div className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
            <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-400 mb-5 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              {lang === 'bn' ? 'মডিউল অ্যাক্সেস' : 'Module Access'}
            </h4>
            
            <div className="flex flex-wrap gap-2">
              {teacher.permissions && Object.keys(teacher.permissions).length > 0 ? (
                Object.entries(teacher.permissions).filter(([k,v]) => v && k !== 'allowed_classes').map(([k]) => (
                  <span key={k} className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                    <Shield size={12} className={isDark ? "text-blue-400" : "text-blue-600"} />
                    {k.replace('can_manage_', '').replace('can_', '').replace(/_/g, ' ')}
                  </span>
                ))
              ) : (
                <p className="text-sm font-bold text-slate-500 italic">{lang === 'bn' ? 'কোনো মডিউল অ্যাক্সেস নেই' : 'No module access'}</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

