
import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Edit3, User as UserIcon, Smartphone, PhoneCall, UserCheck, MessageCircle, BookOpen, Phone, Trash2, AlertTriangle, Loader2, X, Zap, Calendar, Banknote, FileText, Check, Save, Camera, MapPin, School, ShieldCheck } from 'lucide-react';
import { Student, Language, Institution } from 'types';
import { supabase } from 'supabase';
import { SupabaseWrapper } from 'services/supabaseWrapper';
import { requestManager } from 'services/RequestManager';
import { CacheService } from 'services/cacheService';
import { t } from 'translations';
import { extractStudentExtraFields, packStudentNotesWithExtra, getDisplayNotes } from 'utils/studentExtraFields';

interface StudentDetailsProps {
  student: Student;
  madrasah: Institution | null;
  onEdit: () => void;
  onBack: () => void;
  lang: Language;
  readOnly?: boolean;
  institutionId?: string;
  triggerRefresh?: () => void;
  role?: string;
  profile?: any;
  onStudentUpdate?: (updatedStudent: Student) => void;
}

import { openWhatsAppChooser } from '../utils/whatsapp';

const compressAndResizeImage = (file: File, maxWidth = 300, maxHeight = 300): Promise<Blob> => {
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

const StudentDetails: React.FC<StudentDetailsProps> = ({ student, madrasah, onEdit, onBack, lang, readOnly, institutionId, triggerRefresh, role, profile, onStudentUpdate }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(getDisplayNotes(student.notes) || '');

  useEffect(() => {
    setEditedNotes(getDisplayNotes(student.notes) || '');
  }, [student.id, student.notes]);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [libraryIssues, setLibraryIssues] = useState<any[]>([]);
  
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState(student.photo_url || '');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [isActive, setIsActive] = useState(student.is_active !== false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPhotoDeleteConfirm, setShowPhotoDeleteConfirm] = useState(false);
  const [photoAlert, setPhotoAlert] = useState<{ show: boolean; type: 'success' | 'error'; message: string } | null>(null);
  
  const isDark = madrasah?.theme === 'dark';
  const isPhotoModuleEnabled = madrasah?.config_json?.modules?.student_photo === true;
  const canUploadPhoto = isPhotoModuleEnabled && (role === 'super_admin' || role === 'madrasah_admin' || !!profile?.permissions?.can_upload_student_photos);

  useEffect(() => {
    if (photoAlert && photoAlert.show) {
      const timer = setTimeout(() => {
        setPhotoAlert(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [photoAlert]);

  useEffect(() => {
    if (student?.id) {
       supabase.from('library_issues')
          .select('*, book:library_books(title)')
          .eq('user_type', 'student')
          .eq('student_id', student.id)
          .order('issue_date', { ascending: false })
          .then(({ data, error }) => {
              if (error && error.message.includes('does not exist')) return;
              if (data) setLibraryIssues(data);
          });
    }
  }, [student?.id]);

  useEffect(() => {
    setCurrentPhotoUrl(student.photo_url || '');
    setIsActive(student.is_active !== false);
  }, [student?.photo_url, student?.id, student?.is_active]);

  const toggleStatus = async () => {
    setIsUpdatingStatus(true);
    const newStatus = !isActive;
    try {
      await SupabaseWrapper.safeUpdate('students', student.id, { is_active: newStatus });
      setIsActive(newStatus);
      if (onStudentUpdate) {
        onStudentUpdate({ ...student, is_active: newStatus });
      }
      // Invalidate Pattern
      if (madrasah) {
        requestManager.invalidatePattern('fetch:students:');
        // Update local cache
        CacheService.getCachedData('students', madrasah.id).then(cached => {
          if (Array.isArray(cached)) {
            const updated = cached.map((s: any) => s.id === student.id ? { ...s, is_active: newStatus } : s);
            CacheService.cacheData('students', madrasah.id, updated);
          }
        }).catch(() => {});
      }
      if (triggerRefresh) triggerRefresh();
    } catch (err: any) {
      console.error('Error updating status:', err);
      alert(err.message || 'Error updating status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      // Preserve any admission extra data tags and start tags in notes
      const extra = extractStudentExtraFields(student);
      const accMatch = student.notes?.match(/\[ACC_START:(.*?)\]/);
      let newFullNotes = packStudentNotesWithExtra(editedNotes, extra);
      if (accMatch && !newFullNotes.includes(accMatch[0])) {
        newFullNotes = `${newFullNotes}\n${accMatch[0]}`.trim();
      }

      await SupabaseWrapper.safeUpdate('students', student.id, { notes: newFullNotes });
      
      const updatedStudentObj = { ...student, notes: newFullNotes };
      if (onStudentUpdate) {
        onStudentUpdate(updatedStudentObj);
      } else {
        student.notes = newFullNotes;
      }
      setIsEditingNotes(false);
      
      // Invalidate Pattern
      if (madrasah) {
        requestManager.invalidatePattern('fetch:students:');
        // Update local cache to prevent stale data on refresh
        CacheService.getCachedData('students', madrasah.id).then(cached => {
          if (Array.isArray(cached)) {
            const updated = cached.map((s: any) => s.id === student.id ? { ...s, notes: newFullNotes } : s);
            CacheService.cacheData('students', madrasah.id, updated);
          }
        }).catch(() => {});
      }
      if (triggerRefresh) triggerRefresh();
    } catch (err: any) {
      console.error('Error saving notes:', err);
      if (err.message?.includes('column "notes"')) {
        alert("Database Error: 'notes' column is missing from 'students' table. Please run this in Supabase SQL Editor: ALTER TABLE students ADD COLUMN notes TEXT;");
      } else {
        alert(err.message || 'Error saving notes');
      }
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !student.id) return;
    
    setIsUploadingImage(true);
    try {
      const compressedBlob = await compressAndResizeImage(file, 450, 450);
      const fileName = `student_photo_${student.id}_${Date.now()}.webp`;
      
      try {
        await supabase.storage.createBucket('madrasah-assets', { public: true });
      } catch (bucketError) {}

      // Delete the old photo from storage if it exists to optimize storage space
      const oldPhotoUrl = student.photo_url || currentPhotoUrl;
      if (oldPhotoUrl) {
        try {
          const urlWithoutQuery = oldPhotoUrl.split('?')[0];
          const marker = 'student_photos/';
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

      const { error: uploadErr } = await supabase.storage
        .from('madrasah-assets')
        .upload(`student_photos/${fileName}`, compressedBlob, {
          cacheControl: '2592000', // Cache for 30 days
          contentType: 'image/webp',
          upsert: true
        });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('madrasah-assets')
        .getPublicUrl(`student_photos/${fileName}`);

      const publicUrl = publicUrlData.publicUrl;
      if (!publicUrl) throw new Error('Could not retrieve public URL');

      const { error: updateErr } = await supabase
        .from('students')
        .update({ photo_url: publicUrl })
        .eq('id', student.id);

      if (updateErr) throw updateErr;

      // Force instant refresh with timestamp cache buster
      const photoUrlWithBuster = publicUrl + '?t=' + Date.now();
      setCurrentPhotoUrl(photoUrlWithBuster);
      if (onStudentUpdate) {
        onStudentUpdate({ ...student, photo_url: photoUrlWithBuster });
      } else {
        student.photo_url = photoUrlWithBuster;
      }

      requestManager.invalidatePattern('fetch:students:');
      
      if (institutionId) {
        const cached = await CacheService.getCachedData('students', institutionId);
        if (Array.isArray(cached)) {
          const updated = cached.map((s: any) => s.id === student.id ? { ...s, photo_url: publicUrl } : s);
          await CacheService.cacheData('students', institutionId, updated);
        }
      }

      if (triggerRefresh) triggerRefresh();
      
      setPhotoAlert({
        show: true,
        type: 'success',
        message: lang === 'bn' ? 'ছবি সফলভাবে আপলোড হয়েছে।' : 'Photo uploaded successfully.'
      });
    } catch (err: any) {
      console.error('Photo upload error:', err);
      setPhotoAlert({
        show: true,
        type: 'error',
        message: (lang === 'bn' ? 'ছবি আপলোড ব্যর্থ হয়েছে: ' : 'Photo upload failed: ') + err.message
      });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = () => {
    setShowPhotoDeleteConfirm(true);
  };

  const handleConfirmDeletePhoto = async () => {
    if (!student.id) return;
    setShowPhotoDeleteConfirm(false);
    setIsDeletingPhoto(true);
    try {
      const existingPhotoUrl = student.photo_url || currentPhotoUrl;

      const { error: updateErr } = await supabase
        .from('students')
        .update({ photo_url: null })
        .eq('id', student.id);

      if (updateErr) throw updateErr;

      // Delete the image file from Supabase Storage
      if (existingPhotoUrl) {
        try {
          const urlWithoutQuery = existingPhotoUrl.split('?')[0];
          const marker = 'student_photos/';
          const markerIndex = urlWithoutQuery.indexOf(marker);
          if (markerIndex !== -1) {
            const storagePath = urlWithoutQuery.substring(markerIndex);
            await supabase.storage
              .from('madrasah-assets')
              .remove([storagePath]);
          }
        } catch (storageDelErr) {
          console.error('Failed to remove image from storage:', storageDelErr);
        }
      }

      setCurrentPhotoUrl('');
      if (onStudentUpdate) {
        onStudentUpdate({ ...student, photo_url: undefined });
      } else {
        student.photo_url = undefined;
      }

      requestManager.invalidatePattern('fetch:students:');

      if (institutionId) {
        const cached = await CacheService.getCachedData('students', institutionId);
        if (Array.isArray(cached)) {
          const updated = cached.map((s: any) => s.id === student.id ? { ...s, photo_url: null } : s);
          await CacheService.cacheData('students', institutionId, updated);
        }
      }

      if (triggerRefresh) triggerRefresh();

      setPhotoAlert({
        show: true,
        type: 'success',
        message: lang === 'bn' ? 'ছবি মুছে ফেলা হয়েছে।' : 'Photo deleted successfully.'
      });
    } catch (err: any) {
      console.error('Delete photo error:', err);
      setPhotoAlert({
        show: true,
        type: 'error',
        message: (lang === 'bn' ? 'ছবি মুছতে ব্যর্থ হয়েছে: ' : 'Delete photo failed: ') + err.message
      });
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const initiateWhatsAppCall = async (phone: string) => {
    openWhatsAppChooser(phone);
  };

  const initiateWhatsAppMessage = async (phone: string) => {
    openWhatsAppChooser(phone, 'আস-সালামু আলাইকুম');
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', student.id);
      
      if (error) throw error;
      
      // Invalidate Patterns
      if (madrasah) {
        requestManager.invalidatePattern('fetch:students:');
        requestManager.invalidatePattern(`stats:${madrasah.id}`);
        requestManager.invalidatePattern(`fees:${madrasah.id}`);
        requestManager.invalidatePattern(`dashboard_`);
        
        // Remove from local IndexedDB cache
        const cached = await CacheService.getCachedData('students', madrasah.id);
        if (Array.isArray(cached)) {
          const updated = cached.filter((s: any) => s.id !== student.id);
          await CacheService.cacheData('students', madrasah.id, updated);
        }
      }
      
      if (triggerRefresh) triggerRefresh();
      onBack();
    } catch (err: any) {
      alert(err.message);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="animate-in slide-in-from-right-4 duration-700 pb-20 space-y-4">
      {/* Enhanced Header */}
      <div className="relative overflow-hidden rounded-[1.2rem] p-5 bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E3A8A] shadow-[0_10px_30px_-10px_rgba(37,99,235,0.3)] border border-white/20">
        <div className="absolute top-0 right-0 p-2 opacity-10 rotate-12 animate-pulse">
          <UserIcon size={60} strokeWidth={1} />
        </div>
        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-white/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack} 
              className="w-9 h-9 bg-white/20 backdrop-blur-2xl rounded-[1rem] flex items-center justify-center text-white active:scale-90 transition-all border border-white/30 shadow-lg shrink-0 hover:bg-white/30"
            >
              <ArrowLeft size={18} strokeWidth={3} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-white font-noto tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
                {t('student_details', lang, madrasah?.institution_type)}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                <p className="text-white/80 text-xs font-black uppercase tracking-[0.15em]">
                  {student.classes?.class_name || 'N/A'}
                </p>
              </div>
            </div>
          </div>
          
          {!readOnly && (
            <div className="flex gap-1.5">
              <button
                onClick={toggleStatus}
                disabled={isUpdatingStatus}
                className={`w-9 h-9 backdrop-blur-2xl rounded-[1rem] flex items-center justify-center active:scale-90 transition-all border shadow-lg ${
                  isActive 
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-100 hover:bg-emerald-500/30' 
                  : 'bg-red-500/20 border-red-500/30 text-red-100 hover:bg-red-500/30'
                }`}
                title={isActive ? (lang === 'bn' ? 'অ্যাক্টিভ' : 'Active') : (lang === 'bn' ? 'ইন-অ্যাক্টিভ' : 'Inactive')}
              >
                {isUpdatingStatus ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : isActive ? (
                  <UserCheck size={16} />
                ) : (
                  <X size={16} />
                )}
              </button>
              <button 
                onClick={() => setShowDeleteConfirm(true)} 
                className="w-9 h-9 bg-red-500/20 backdrop-blur-2xl rounded-[1rem] flex items-center justify-center text-red-100 active:scale-90 transition-all border border-red-500/30 shadow-lg hover:bg-red-500/30"
              >
                <Trash2 size={16} />
              </button>
              <button 
                onClick={onEdit} 
                className="w-9 h-9 bg-white rounded-[1rem] flex items-center justify-center text-[#2563EB] active:scale-90 transition-all border border-white shadow-lg hover:shadow-[#2563EB]/20"
              >
                <Edit3 size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className={`p-5 rounded-[1.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.08)] border relative overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
        <div className={`absolute top-0 left-0 w-full h-14 bg-gradient-to-b to-transparent ${isDark ? 'from-slate-800/50' : 'from-slate-50/50'}`} />
        
        <div className="relative flex flex-col items-center text-center">
          <div className="relative mb-2 group">
            <div className="absolute inset-0 bg-[#2563EB] blur-3xl opacity-20 group-hover:opacity-30 transition-opacity" />
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />

            <div 
              onClick={() => {
                if (canUploadPhoto && !isUploadingImage) fileInputRef.current?.click();
              }}
              className={`relative w-24 h-24 rounded-[1rem] flex items-center justify-center text-[#2563EB] border-[2px] shadow-xl overflow-hidden transform group-hover:scale-105 transition-all duration-500 ${isDark ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-800' : 'bg-gradient-to-br from-blue-50 to-white border-white'} ${canUploadPhoto ? 'cursor-pointer hover:border-[#2563EB]' : ''}`}
            >
              {isUploadingImage ? (
                <div className="flex flex-col items-center justify-center text-slate-500">
                  <Loader2 className="animate-spin text-blue-500 mb-1" size={24} />
                  <span className="text-[8px] font-black uppercase tracking-widest">{lang === 'bn' ? 'আপলোড...' : 'Uploading'}</span>
                </div>
              ) : currentPhotoUrl ? (
                <img src={currentPhotoUrl} className="w-full h-full object-cover" alt={student.student_name} referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={48} strokeWidth={2.5} />
              )}

              {/* Hover Camera icon overlay */}
              {canUploadPhoto && !isUploadingImage && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Camera className="text-white" size={20} />
                </div>
              )}
            </div>

            <div className="absolute -bottom-0.5 -right-0.5 flex flex-col gap-1 items-end pointer-events-none">
              {student.registration_number && (
                <div className={`min-w-[1.75rem] h-6 px-1 bg-indigo-600 text-white rounded-[0.6rem] flex items-center justify-center border-2 shadow-xl ${isDark ? 'border-slate-800' : 'border-white'}`} title="Registration Number">
                  <span className="text-[10px] font-black tracking-tighter">R: {student.registration_number}</span>
                </div>
              )}
            </div>
          </div>
          
          {currentPhotoUrl && canUploadPhoto && (
            <button 
              onClick={handleDeletePhoto}
              disabled={isDeletingPhoto}
              className={`mb-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-[0.5rem] text-[10px] font-black transition-all border ${isDark ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' : 'bg-red-50 border-red-100 text-red-600 hover:bg-red-100'}`}
            >
              {isDeletingPhoto ? (
                <Loader2 className="animate-spin text-red-500" size={10} />
              ) : (
                <Trash2 size={10} />
              )}
              {lang === 'bn' ? 'ছবি মুছুন' : 'Delete Photo'}
            </button>
          )}

          <h2 className={`text-xl font-black font-noto tracking-tight leading-tight mb-0.5 drop-shadow-sm ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{student.student_name}</h2>
          {student.name_en && (
            <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              {student.name_en}
            </p>
          )}
          
          <div className="flex flex-wrap justify-center gap-1.5">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[0.7rem] border-2 shadow-inner ${isDark ? 'bg-blue-900/20 border-[#2563EB]/20' : 'bg-blue-50 border-[#2563EB]/10'}`}>
              <span className="text-xs font-black text-[#2563EB] uppercase tracking-[0.15em]">{t('roll', lang)}: {student.roll || '-'}</span>
            </div>
            {student.section && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[0.7rem] border-2 shadow-inner ${isDark ? 'bg-emerald-900/20 border-emerald-500/20' : 'bg-emerald-50 border-emerald-500/10'}`}>
                <span className="text-xs font-black text-emerald-600 uppercase tracking-[0.15em]">{t('section', lang)}: {student.section}</span>
              </div>
            )}
            {!isActive && (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[0.7rem] border-2 shadow-inner ${isDark ? 'bg-red-900/20 border-red-500/20' : 'bg-red-50 border-red-500/10'}`}>
                <span className="text-xs font-black text-red-600 uppercase tracking-[0.15em]">{lang === 'bn' ? 'ইন-অ্যাক্টিভ' : 'Inactive'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Info Section */}
        <div className="mt-4 space-y-4">
          {/* Personal Details */}
          {(student.date_of_birth || student.blood_group) && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1.5 mb-1">
                <div className="w-0.5 h-3.5 bg-gradient-to-b from-indigo-500 to-indigo-800 rounded-full shadow-lg shadow-indigo-500/20" />
                <h3 className={`text-xs font-black uppercase tracking-[0.15em] ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'ব্যক্তিগত তথ্য' : 'Personal Details'}</h3>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {student.date_of_birth && (
                  <div className={`flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-2.5 p-3 sm:p-4 rounded-[1rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-indigo-500/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-indigo-500/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-[0.6rem] flex items-center justify-center text-indigo-500 shrink-0 shadow-md border group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <Calendar size={18} />
                    </div>
                    <div className="min-w-0 text-center sm:text-left">
                      <p className="text-[7px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{t('dob', lang)}</p>
                      <p className={`text-[10px] sm:text-base font-black truncate font-noto leading-tight ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.date_of_birth}</p>
                    </div>
                  </div>
                )}
                {student.blood_group && (
                  <div className={`flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-2.5 p-3 sm:p-4 rounded-[1rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-red-500/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-red-500/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-[0.6rem] flex items-center justify-center text-red-500 shrink-0 shadow-md border group-hover:bg-red-500 group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <Zap size={18} fill="currentColor" />
                    </div>
                    <div className="min-w-0 text-center sm:text-left">
                      <p className="text-[7px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{lang === 'bn' ? 'রক্তের গ্রুপ' : 'Blood Group'}</p>
                      <p className={`text-[10px] sm:text-base font-black truncate font-noto leading-tight ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.blood_group}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 px-1.5 mb-1">
              <div className="w-0.5 h-3.5 bg-gradient-to-b from-[#2563EB] to-[#1E3A8A] rounded-full shadow-lg shadow-[#2563EB]/20" />
              <h3 className={`text-xs font-black uppercase tracking-[0.15em] ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'অভিভাবকের তথ্য' : 'Guardian Details'}</h3>
            </div>

          <div className="grid grid-cols-1 gap-1.5">
            <div className={`flex items-center gap-2.5 p-4 rounded-[1rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-[#2563EB]/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
              <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center text-[#2563EB] shrink-0 shadow-md border group-hover:bg-[#2563EB] group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <UserCheck size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{t('guardian_name', lang)}</p>
                <p className={`text-base font-black truncate font-noto leading-tight ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.guardian_name || 'N/A'}</p>
              </div>
            </div>

            {student.mother_name && (
              <div className={`flex items-center gap-2.5 p-4 rounded-[1rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-[#2563EB]/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
                <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center text-[#2563EB] shrink-0 shadow-md border group-hover:bg-[#2563EB] group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <UserCheck size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{lang === 'bn' ? 'মাতার নাম' : "Mother's Name"}</p>
                  <p className={`text-base font-black truncate font-noto leading-tight ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.mother_name}</p>
                </div>
              </div>
            )}

            <div className={`flex flex-col p-4 rounded-[1.2rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:border-[#2563EB]/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center text-[#2563EB] shrink-0 shadow-md border group-hover:bg-[#2563EB] group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <Smartphone size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{lang === 'bn' ? 'প্রাথমিক নাম্বার' : 'Primary Number'}</p>
                    <p className={`text-base font-black tracking-tight leading-none ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.guardian_phone}</p>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-1.5">
                <button 
                  onClick={() => window.location.href = `tel:${student.guardian_phone}`}
                  className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  <Phone size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'কল' : 'Call'}
                </button>
                <button 
                  onClick={() => initiateWhatsAppMessage(student.guardian_phone)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                >
                  <MessageCircle size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'মেসেজ' : 'SMS'}
                </button>
                <button 
                  onClick={() => initiateWhatsAppCall(student.guardian_phone)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-[#128C7E] to-[#075E54] text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                >
                  <PhoneCall size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'ওয়াটসঅ্যাপ' : 'WhatsApp'}
                </button>
              </div>
            </div>

            {student.guardian_phone_2 && (
              <div className={`flex flex-col p-4 rounded-[1.2rem] border-2 transition-all group animate-in slide-in-from-top-4 ${isDark ? 'bg-slate-800 border-slate-700 hover:border-blue-400/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-blue-400/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center text-blue-400 shrink-0 shadow-md border group-hover:bg-blue-400 group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                      <Smartphone size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{lang === 'bn' ? 'অপশনাল নাম্বার' : 'Optional Number'}</p>
                      <p className={`text-base font-black tracking-tight leading-none ${isDark ? 'text-slate-200' : 'text-[#1E293B]'}`}>{student.guardian_phone_2}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button 
                    onClick={() => window.location.href = `tel:${student.guardian_phone_2}`}
                    className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-blue-400 to-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-blue-400/20 active:scale-95 transition-all"
                  >
                    <Phone size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'কল' : 'Call'}
                  </button>
                  <button 
                    onClick={() => initiateWhatsAppMessage(student.guardian_phone_2)}
                    className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                  >
                    <MessageCircle size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'মেসেজ' : 'SMS'}
                  </button>
                  <button 
                    onClick={() => initiateWhatsAppCall(student.guardian_phone_2)}
                    className="flex flex-col items-center justify-center gap-0.5 py-2.5 bg-gradient-to-br from-[#128C7E] to-[#075E54] text-white rounded-xl font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                  >
                    <PhoneCall size={18} fill="currentColor" className="opacity-90" /> {lang === 'bn' ? 'ওয়াটসঅ্যাপ' : 'WhatsApp'}
                  </button>
                </div>
              </div>
            )}

            {student.address && (
              <div className={`flex items-start gap-2.5 p-4 rounded-[1rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-[#2563EB]/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-[#2563EB]/30 hover:shadow-lg hover:shadow-slate-200/50'}`}>
                <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center text-[#2563EB] shrink-0 shadow-md border group-hover:bg-[#2563EB] group-hover:text-white transition-all duration-300 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                  <BookOpen size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{t('address', lang)}</p>
                  <p className={`text-sm font-bold font-noto leading-relaxed ${isDark ? 'text-slate-300' : 'text-[#1E293B]'}`}>{student.address}</p>
                </div>
              </div>
            )}

            {/* Additional Admission Information Section */}
            {(() => {
              const extraInfo = extractStudentExtraFields(student);
              const hasAnyExtraInfo = Boolean(
                extraInfo.father_name || extraInfo.father_occupation || extraInfo.mother_occupation ||
                extraInfo.guardian_relation || extraInfo.gender || extraInfo.nationality ||
                extraInfo.religion || extraInfo.permanent_address || extraInfo.previous_institution ||
                extraInfo.previous_class
              );
              if (!hasAnyExtraInfo) return null;

              return (
                <div className={`p-4 sm:p-5 rounded-[1.2rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:border-emerald-500/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-emerald-500/30 hover:shadow-lg'}`}>
                  <div className="flex items-center gap-1.5 px-1.5 mb-3">
                    <div className="w-0.5 h-3.5 bg-gradient-to-b from-emerald-500 to-teal-700 rounded-full shadow-lg shadow-emerald-500/20" />
                    <h3 className={`text-xs font-black uppercase tracking-[0.15em] flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                      {lang === 'bn' ? 'অতিরিক্ত / ভর্তি তথ্য' : 'Additional Information'}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {extraInfo.father_name && (
                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'পিতার নাম' : "Father's Name"}</p>
                        <p className={`text-sm font-bold mt-0.5 font-noto ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{extraInfo.father_name}</p>
                      </div>
                    )}

                    {extraInfo.father_occupation && (
                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'পিতার পেশা' : "Father's Occupation"}</p>
                        <p className={`text-sm font-bold mt-0.5 font-noto ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{extraInfo.father_occupation}</p>
                      </div>
                    )}

                    {extraInfo.mother_occupation && (
                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'মাতার পেশা' : "Mother's Occupation"}</p>
                        <p className={`text-sm font-bold mt-0.5 font-noto ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{extraInfo.mother_occupation}</p>
                      </div>
                    )}

                    {extraInfo.guardian_relation && (
                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'অভিভাবকের সম্পর্ক' : 'Guardian Relation'}</p>
                        <p className={`text-sm font-bold mt-0.5 font-noto ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{extraInfo.guardian_relation}</p>
                      </div>
                    )}

                    {extraInfo.gender && (
                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'লিঙ্গ' : 'Gender'}</p>
                        <p className={`text-sm font-bold mt-0.5 font-noto ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{extraInfo.gender}</p>
                      </div>
                    )}

                    {(extraInfo.religion || extraInfo.nationality) && (
                      <div className={`p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'ধর্ম ও জাতীয়তা' : 'Religion & Nationality'}</p>
                        <p className={`text-sm font-bold mt-0.5 font-noto ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          {[extraInfo.religion, extraInfo.nationality].filter(Boolean).join(' | ')}
                        </p>
                      </div>
                    )}

                    {extraInfo.permanent_address && (
                      <div className={`p-3 rounded-xl border sm:col-span-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'স্থায়ী ঠিকানা' : 'Permanent Address'}</p>
                        <p className={`text-sm font-bold mt-0.5 font-noto ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{extraInfo.permanent_address}</p>
                      </div>
                    )}

                    {(extraInfo.previous_institution || extraInfo.previous_class) && (
                      <div className={`p-3 rounded-xl border sm:col-span-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'পূর্ববর্তী প্রতিষ্ঠান ও শ্রেণী' : 'Previous School & Class'}</p>
                        <p className={`text-sm font-bold mt-0.5 font-noto ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                          {extraInfo.previous_institution ? `${extraInfo.previous_institution}` : ''}
                          {extraInfo.previous_class ? ` (শ্রেণী: ${extraInfo.previous_class})` : ''}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Library History */}
            {libraryIssues.length > 0 && (
              <div className={`p-4 sm:p-5 rounded-[1.2rem] border-2 transition-all group ${isDark ? 'bg-slate-800 border-slate-700 hover:border-indigo-500/30' : 'bg-slate-50/80 border-slate-100 hover:bg-white hover:border-indigo-500/30 hover:shadow-lg'}`}>
                <div className="flex items-center gap-1.5 px-1.5 mb-3">
                  <div className="w-0.5 h-3.5 bg-gradient-to-b from-indigo-500 to-indigo-800 rounded-full shadow-lg shadow-indigo-500/20" />
                  <h3 className={`text-xs font-black uppercase tracking-[0.15em] flex items-center gap-2 ${isDark ? 'text-slate-100' : 'text-[#1E3A8A]'}`}>
                    {lang === 'bn' ? 'লাইব্রেরী' : 'Library Items'}
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px]">{libraryIssues.length}</span>
                  </h3>
                </div>
                <div className="space-y-2.5">
                  {libraryIssues.map(issue => (
                    <div key={issue.id} className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <div>
                        <p className="font-bold text-sm tracking-tight">{issue.book?.title || 'Unknown Book'}</p>
                        <p className="text-[10px] font-black text-slate-400 mt-1 uppercase">Issued: {issue.issue_date ? new Date(issue.issue_date.includes('T') ? issue.issue_date : issue.issue_date + 'T00:00:00').toLocaleDateString('bn-BD') : ''}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${issue.status === 'returned' ? 'bg-emerald-500/10 text-emerald-500' : issue.status === 'lost' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                           {issue.status}
                        </span>
                        {issue.status === 'issued' && (
                          <p className={`text-[9px] font-black mt-1 uppercase ${issue.due_date < new Date().toISOString().split('T')[0] ? 'text-red-500' : 'text-slate-400'}`}>
                            Due: {issue.due_date ? new Date(issue.due_date.includes('T') ? issue.due_date : issue.due_date + 'T00:00:00').toLocaleDateString('bn-BD') : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Student Notes Section */}
            <div className={`flex flex-col p-5 rounded-[1.2rem] border-2 transition-all group ${isDark ? 'bg-slate-800/80 border-slate-700 hover:border-amber-400/30' : 'bg-[#FFFBEB]/50 border-amber-100 hover:bg-white hover:border-amber-400/40 hover:shadow-lg hover:shadow-amber-200/40'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-10 h-10 rounded-[0.6rem] flex items-center justify-center shrink-0 shadow-md border transition-all duration-300 ${isDark ? 'bg-amber-900/30 text-amber-500 border-amber-800' : 'bg-amber-100 text-amber-600 border-amber-200'} group-hover:scale-105`}>
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-[0.1em] mb-0.5">{lang === 'bn' ? 'শিক্ষার্থী নোট (এডমিন/শিক্ষক)' : 'Student Notes'}</p>
                    <p className={`text-[10px] font-bold ${isDark ? 'text-amber-500/70' : 'text-amber-600/70'}`}>
                      {lang === 'bn' ? 'শিক্ষার্থীর পড়াশুনা বা চারিত্রিক দিক' : 'Behavior or Academic Notes'}
                    </p>
                  </div>
                </div>
                {!readOnly && !isEditingNotes && (
                  <button 
                    onClick={() => {
                        setEditedNotes(getDisplayNotes(student.notes) || '');
                        setIsEditingNotes(true);
                    }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all active:scale-95 ${isDark ? 'bg-slate-900 border-slate-700 text-amber-500 hover:bg-slate-800 hover:border-amber-500/50' : 'bg-white border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300'} shadow-sm`}
                    title="Edit Note"
                  >
                    <Edit3 size={16} />
                  </button>
                )}
              </div>

              {isEditingNotes ? (
                <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    placeholder={lang === 'bn' ? 'শিক্ষার্থীর সম্পর্কে কিছু লিখুন...' : 'Write something about the student...'}
                    className={`w-full min-h-[100px] p-3 rounded-xl border-2 text-sm focus:outline-none focus:ring-0 transition-all font-noto ${isDark ? 'bg-slate-900/80 border-slate-700 focus:border-amber-500/50 text-slate-200 placeholder:text-slate-600' : 'bg-white border-amber-200 focus:border-amber-500 text-slate-700 placeholder:text-slate-400'} shadow-inner`}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setIsEditingNotes(false);
                        setEditedNotes(getDisplayNotes(student.notes) || '');
                      }}
                      className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg border transition-all active:scale-95 ${isDark ? 'text-slate-400 border-slate-700 hover:bg-slate-800' : 'text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                      disabled={isSavingNotes}
                    >
                      {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      disabled={isSavingNotes || editedNotes === (getDisplayNotes(student.notes) || '')}
                      className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isSavingNotes ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      {lang === 'bn' ? 'সেভ করুন' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`mt-1 p-4 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800/50 text-slate-300' : 'bg-white/60 border-amber-50 text-slate-700'} shadow-inner min-h-[60px]`}>
                  {getDisplayNotes(student.notes) ? (
                    <p className="text-sm font-medium font-noto leading-relaxed whitespace-pre-wrap">{getDisplayNotes(student.notes)}</p>
                  ) : (
                    <p className={`text-xs italic ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                      {lang === 'bn' ? 'কোনো নোট দেওয়া নেই।' : 'No notes added.'}
                    </p>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>

      {showDeleteConfirm && (
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-3xl animate-in fade-in duration-500 fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className={`w-full max-w-xs rounded-[3rem] p-8 shadow-[0_50px_120px_rgba(239,68,68,0.3)] border text-center space-y-6 animate-in zoom-in-95 duration-500 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-red-50'}`}>
             <div className="relative">
               <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 animate-pulse" />
               <div className={`relative w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner border mb-4 ${isDark ? 'bg-red-900/20 text-red-400 border-red-800/50' : 'bg-red-50 text-red-500 border-red-100'}`}>
                  <AlertTriangle size={40} />
               </div>
             </div>
             <div>
                <h3 className={`text-xl font-black font-noto tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{t('confirm_delete', lang)}</h3>
                <p className="text-[12px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-2 leading-relaxed">
                  {lang === 'bn' ? `আপনি কি নিশ্চিতভাবে "${student.student_name}" এর সকল তথ্য মুছে ফেলতে চান? এটি আর ফিরিয়ে আনা যাবে না।` : `Are you sure you want to delete all info for "${student.student_name}"? This cannot be undone.`}
                </p>
             </div>
             <div className="flex flex-col gap-3 pt-1">
                <button 
                  onClick={handleDelete} 
                  disabled={isDeleting} 
                  className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-black rounded-full shadow-2xl shadow-red-200 active:scale-95 transition-all flex items-center justify-center text-base gap-2 border border-white/10"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={20} /> : (
                    <><Trash2 size={20} /> {t('confirm_btn', lang)}</>
                  )}
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(false)} 
                  disabled={isDeleting}
                  className={`w-full py-4 font-black rounded-full active:scale-95 transition-all text-xs uppercase tracking-widest border ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                >
                  {t('cancel_btn', lang)}
                </button>
             </div>
          </div>
        </div>
      )}

      {showPhotoDeleteConfirm && (
        <div className="modal-overlay bg-[#080A12]/60 backdrop-blur-3xl animate-in fade-in duration-500 fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div className={`w-full max-w-xs rounded-[3rem] p-8 shadow-[0_50px_120px_rgba(239,68,68,0.3)] border text-center space-y-6 animate-in zoom-in-95 duration-500 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-red-50'}`}>
             <div className="relative">
               <div className="absolute inset-0 bg-red-400 blur-3xl opacity-20 animate-pulse" />
               <div className={`relative w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-inner border mb-4 ${isDark ? 'bg-red-950/30 text-red-400 border-red-800/50' : 'bg-red-50 text-red-500 border-red-100'}`}>
                  <Trash2 size={40} />
               </div>
             </div>
             <div>
                <h3 className={`text-xl font-black font-noto tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                  {lang === 'bn' ? 'ছবি মুছে ফেলবেন?' : 'Delete Photo?'}
                </h3>
                <p className="text-[12px] font-bold text-slate-400 mt-2 uppercase tracking-wider px-2 leading-relaxed">
                  {lang === 'bn' ? 'আপনি কি নিশ্চিতভাবে এই শিক্ষার্থীর ছবি মুছে ফেলতে চান?' : 'Are you sure you want to delete this student\'s photo?'}
                </p>
             </div>
             <div className="flex flex-col gap-3 pt-1">
                <button 
                  onClick={handleConfirmDeletePhoto} 
                  disabled={isDeletingPhoto} 
                  className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-black rounded-full shadow-2xl shadow-red-200 active:scale-95 transition-all flex items-center justify-center text-base gap-2 border border-white/10"
                >
                  {isDeletingPhoto ? <Loader2 className="animate-spin" size={20} /> : (
                    <><Trash2 size={20} /> {lang === 'bn' ? 'হ্যাঁ, মুছুন' : 'Yes, Delete'}</>
                  )}
                </button>
                <button 
                  onClick={() => setShowPhotoDeleteConfirm(false)} 
                  disabled={isDeletingPhoto}
                  className={`w-full py-4 font-black rounded-full active:scale-95 transition-all text-xs uppercase tracking-widest border ${isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                >
                  {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                </button>
             </div>
          </div>
        </div>
      )}

      {photoAlert && photoAlert.show && (
        <div className="fixed bottom-6 right-6 z-[1010] p-4 max-w-sm w-full animate-in slide-in-from-bottom duration-300">
          <div className={`p-4 rounded-2xl shadow-2xl border flex items-center gap-3 ${isDark ? 'bg-slate-900/95 border-slate-800 text-slate-100' : 'bg-white/95 border-slate-100 text-slate-800'} backdrop-blur-md`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${photoAlert.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
              {photoAlert.type === 'success' ? <Check size={16} strokeWidth={3} /> : <AlertTriangle size={16} />}
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-black uppercase tracking-wider text-slate-400">{photoAlert.type === 'success' ? (lang === 'bn' ? 'সফল' : 'Success') : (lang === 'bn' ? 'ত্রুটি' : 'Error')}</p>
              <p className="text-[13px] font-semibold text-slate-300 mt-0.5 font-noto break-words">{photoAlert.message}</p>
            </div>
            <button 
              onClick={() => setPhotoAlert(null)}
              className={`p-1 rounded-lg hover:bg-slate-800 transition-colors ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDetails;
