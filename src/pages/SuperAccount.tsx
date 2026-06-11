
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Loader2, User as UserIcon, ShieldCheck, ChevronRight, Smartphone, Save, Sliders, CreditCard, LayoutDashboard, X, Play, Mic, Moon, Sun, Languages, Globe, CheckCircle2, Package, Plus, Trash2, Edit2, ArrowLeft, ArrowRight, Calendar, Award, Type } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase, smsApi } from 'supabase';
import { Institution, Language, View, SubscriptionPackage } from 'types';
import { t } from 'translations';

interface SuperAccountProps {
  lang: Language;
  setLang: (l: Language) => void;
  setView: (view: View) => void;
  onLogout: () => void;
  onProfileUpdate?: () => void;
  initialMadrasah: Institution | null;
  setStatusModal: (modal: { show: boolean; type: 'success' | 'error'; title: string; message: string }) => void;
  dataVersion?: number;
  triggerRefresh?: () => void;
}

const SuperAccount: React.FC<SuperAccountProps> = ({ lang, setLang, setView, onLogout, onProfileUpdate, initialMadrasah, setStatusModal, dataVersion, triggerRefresh }) => {
  const [madrasah, setMadrasah] = useState<Institution | null>(initialMadrasah);
  const [saving, setSaving] = useState(false);
  const [isEditingBulkSMS, setIsEditingBulkSMS] = useState(false);
  const [isEditingGlobalUpdate, setIsEditingGlobalUpdate] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [isEditingPersonalApi, setIsEditingPersonalApi] = useState(false);
  const [isEditingPackages, setIsEditingPackages] = useState(false);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [editingPackage, setEditingPackage] = useState<Partial<SubscriptionPackage> | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState({ show: false, title: '', message: '' });

  const [globalSettings, setGlobalSettings] = useState({
    reve_api_key: '',
    reve_secret_key: '',
    reve_caller_id: '',
    reve_client_id: '',
    bkash_number: '',
    support_number: '',
    sms_rate: 0.50,
    voice_rate: 1.00,
    global_update_active: false,
    global_update_message: '',
    global_update_version: 0
  });

  const [personalApiSettings, setPersonalApiSettings] = useState({
    reve_api_key: '',
    reve_secret_key: '',
    reve_client_id: '',
    reve_caller_id: ''
  });

  useEffect(() => {
    if (initialMadrasah) {
      setMadrasah(initialMadrasah);
    }
  }, [initialMadrasah]);

  useEffect(() => {
    if (madrasah) {
      setPersonalApiSettings({
        reve_api_key: madrasah.reve_api_key || '',
        reve_secret_key: madrasah.reve_secret_key || '',
        reve_client_id: madrasah.reve_client_id || '',
        reve_caller_id: madrasah.voice_sender_id || ''
      });
    }
  }, [madrasah]);

  useEffect(() => {
    fetchGlobalSettings();
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_packages')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setPackages(data);
      } else {
        const defaults = [
          { id: '1', name: 'স্টার্টার', rate: 0.50, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 1 },
          { id: '2', name: 'বেসিক', rate: 0.75, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 2 },
          { id: '3', name: 'স্মার্ট', rate: 1.00, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 3 },
          { id: '4', name: 'একাডেমিক', rate: 1.00, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'পরীক্ষা', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 4 },
          { id: '5', name: 'স্ট্যান্ডার্ড', rate: 1.50, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা', 'পরীক্ষা', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 5 },
          { id: '6', name: 'ফিনান্স', rate: 1.50, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'ফি ও হিসাব', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 6 },
          { id: '7', name: 'প্রফেশনাল', rate: 1.75, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা অথবা পরীক্ষা', 'ফি ও হিসাব', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 7 },
          { id: '8', name: 'এন্টারপ্রাইজ', rate: 2.50, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা', 'পরীক্ষা', 'ফি ও হিসাব', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 8 },
        ];
        setPackages(defaults as any);
      }
    } catch (err) {
      const defaults = [
        { id: '1', name: 'স্টার্টার', rate: 0.50, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 1 },
        { id: '2', name: 'বেসিক', rate: 0.75, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 2 },
        { id: '3', name: 'স্মার্ট', rate: 1.00, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 3 },
        { id: '4', name: 'একাডেমিক', rate: 1.00, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'পরীক্ষা', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 4 },
        { id: '5', name: 'স্ট্যান্ডার্ড', rate: 1.50, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা', 'পরীক্ষা', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 5 },
        { id: '6', name: 'ফিনান্স', rate: 1.50, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'ফি ও হিসাব', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 6 },
        { id: '7', name: 'প্রফেশনাল', rate: 1.75, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা অথবা পরীক্ষা', 'ফি ও হিসাব', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 7 },
        { id: '8', name: 'এন্টারপ্রাইজ', rate: 2.50, features: ['শিক্ষার্থীদের বিবরণ', 'বাল্ক এসএমএস', 'ভয়েস কল', 'হাজিরা', 'পরীক্ষা', 'ফি ও হিসাব', 'শিক্ষক ব্যবস্থাপনা', 'একাডেমিক ক্যালেন্ডার'], sort_order: 8 },
      ];
      setPackages(defaults as any);
    }
  };

  const handleSavePackage = async () => {
    if (!editingPackage?.name || !editingPackage?.rate) return;
    setSaving(true);
    try {
      if (editingPackage.id && editingPackage.id.length > 5) {
        const { error } = await supabase
          .from('subscription_packages')
          .update({
            name: editingPackage.name,
            rate: editingPackage.rate,
            features: editingPackage.features,
            sort_order: editingPackage.sort_order
          })
          .eq('id', editingPackage.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('subscription_packages')
          .insert([{
            name: editingPackage.name,
            rate: editingPackage.rate,
            features: editingPackage.features || [],
            sort_order: editingPackage.sort_order || packages.length + 1
          }]);
        if (error) throw error;
      }
      setShowPackageForm(false);
      fetchPackages();
      if (onProfileUpdate) onProfileUpdate();
      if (triggerRefresh) triggerRefresh();
      setShowSuccessModal({ show: true, title: 'প্যাকেজ আপডেট', message: 'প্যাকেজ সফলভাবে সংরক্ষণ করা হয়েছে।' });
    } catch (err: any) { 
      console.error('Error saving package:', err);
      const errorMessage = err.message || err.details || 'Unknown error';
      setStatusModal({ 
        show: true, 
        type: 'error', 
        title: 'ত্রুটি', 
        message: `প্যাকেজ সেভ করা সম্ভব হয়নি। এরর: ${errorMessage}` 
      });
    } finally { setSaving(false); }
  };

  const handleDeletePackage = async (id: string) => {
    if (!confirm('আপনি কি এই প্যাকেজটি ডিলিট করতে চান?')) return;
    try {
      const { error } = await supabase.from('subscription_packages').delete().eq('id', id);
      if (error) throw error;
      fetchPackages();
      if (onProfileUpdate) onProfileUpdate();
      if (triggerRefresh) triggerRefresh();
    } catch (err) {
      setPackages(packages.filter(p => p.id !== id));
    }
  };

  const fetchGlobalSettings = async () => {
    const settings = await smsApi.getGlobalSettings();
    setGlobalSettings({
      reve_api_key: settings.reve_api_key || '',
      reve_secret_key: settings.reve_secret_key || '',
      reve_caller_id: settings.reve_caller_id || '',
      reve_client_id: settings.reve_client_id || '',
      bkash_number: settings.bkash_number || '',
      support_number: settings.support_number || '',
      sms_rate: settings.sms_rate || 0.50,
      voice_rate: settings.voice_rate || 1.00,
      global_update_active: settings.global_update_active || false,
      global_update_message: settings.global_update_message || '',
      global_update_version: settings.global_update_version || 0
    });
  };

  const handleSaveBulkSMS = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        id: '00000000-0000-0000-0000-000000000001',
        reve_api_key: (globalSettings.reve_api_key || '').trim(),
        reve_secret_key: (globalSettings.reve_secret_key || '').trim(),
        reve_caller_id: (globalSettings.reve_caller_id || '').trim(),
        reve_client_id: (globalSettings.reve_client_id || '').trim(),
        bkash_number: (globalSettings.bkash_number || '').trim(),
        sms_rate: Number(globalSettings.sms_rate),
        voice_rate: Number(globalSettings.voice_rate)
      };

      // Only add support_number if it's likely to exist or as a trial
      if (globalSettings.support_number) {
        updateData.support_number = globalSettings.support_number.trim();
      }

      const { error } = await supabase.from('system_settings').upsert(updateData);
      if (error) {
        if (error.message.includes('support_number')) {
           // Fallback update without support_number
           delete updateData.support_number;
           const { error: error2 } = await supabase.from('system_settings').upsert(updateData);
           if (error2) throw error2;
           alert("Database Error: 'support_number' column is missing. Please run this in Supabase SQL Editor: ALTER TABLE system_settings ADD COLUMN support_number TEXT;");
        } else {
           throw error;
        }
      }
      setIsEditingBulkSMS(false);
      setShowSuccessModal({ show: true, title: 'Bulk SMS আপডেট', message: 'Bulk SMS ও রেট সেটিংস আপডেট হয়েছে।' });
      fetchGlobalSettings();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleSaveGlobalUpdate = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('system_settings').update({
        global_update_active: globalSettings.global_update_active,
        global_update_message: globalSettings.global_update_message,
        global_update_version: globalSettings.global_update_version
      }).eq('id', '00000000-0000-0000-0000-000000000001');

      if (error) throw error;
      setIsEditingGlobalUpdate(false);
      setShowSuccessModal({ show: true, title: 'আপডেট সেটিংস', message: 'গ্লোবাল আপডেট সফলভাবে সেভ হয়েছে।' });
      fetchGlobalSettings();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleSavePayment = async () => {
    setSaving(true);
    try {
      const updateData: any = {
        id: '00000000-0000-0000-0000-000000000001',
        reve_api_key: (globalSettings.reve_api_key || '').trim(),
        reve_secret_key: (globalSettings.reve_secret_key || '').trim(),
        reve_caller_id: (globalSettings.reve_caller_id || '').trim(),
        reve_client_id: (globalSettings.reve_client_id || '').trim(),
        bkash_number: (globalSettings.bkash_number || '').trim(),
        sms_rate: Number(globalSettings.sms_rate),
        voice_rate: Number(globalSettings.voice_rate)
      };

      if (globalSettings.support_number) {
        updateData.support_number = globalSettings.support_number.trim();
      }

      const { error } = await supabase.from('system_settings').upsert(updateData);
      if (error) {
        if (error.message.includes('support_number')) {
           delete updateData.support_number;
           const { error: error2 } = await supabase.from('system_settings').upsert(updateData);
           if (error2) throw error2;
           alert("Database Error: 'support_number' column is missing. Please run this in Supabase SQL Editor: ALTER TABLE system_settings ADD COLUMN support_number TEXT;");
        } else {
          throw error;
        }
      }
      setIsEditingPayment(false);
      setShowSuccessModal({ show: true, title: 'পেমেন্ট আপডেট', message: 'পেমেন্ট সেটিংস আপডেট হয়েছে।' });
      fetchGlobalSettings();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleSavePersonalApi = async () => {
    if (!madrasah?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('institutions').update({
        reve_api_key: personalApiSettings.reve_api_key.trim(),
        reve_secret_key: personalApiSettings.reve_secret_key.trim(),
        reve_client_id: personalApiSettings.reve_client_id.trim(),
        voice_sender_id: personalApiSettings.reve_caller_id.trim()
      }).eq('id', madrasah.id);

      if (error) throw error;
      
      setIsEditingPersonalApi(false);
      setShowSuccessModal({ 
        show: true, 
        title: 'এপিআই আপডেট', 
        message: 'আপনার ব্যক্তিগত এপিআই সেটিংস সফলভাবে আপডেট হয়েছে।' 
      });
      
      if (onProfileUpdate) onProfileUpdate();
      if (triggerRefresh) triggerRefresh();

    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleTheme = async () => {
    const currentTheme = madrasah?.theme || localStorage.getItem('super_admin_theme') || 'default';
    const newTheme = currentTheme === 'dark' ? 'default' : 'dark';
    localStorage.setItem('super_admin_theme', newTheme);
    setMadrasah(prev => prev ? { ...prev, theme: newTheme } : { id: 'super_admin', name: 'Super Admin', theme: newTheme } as any);
    if (onProfileUpdate) onProfileUpdate();
  };

  const displayName = lang === 'bn' ? 'সুপার অ্যাডমিন' : 'Super Admin';

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-36 relative z-10">
      <div className="relative pt-20 px-1">
        <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-[4rem] p-6 sm:p-10 pt-28 md:pt-36 shadow-bubble border relative text-center`}>
          <div className="absolute inset-0 overflow-hidden rounded-[4rem]">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-blue-600 to-indigo-700 opacity-[0.03]" />
          </div>
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-20">
            <div className="relative group">
              <div className={`w-40 h-40 p-4 rounded-full shadow-bubble border-[12px] flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-900' : 'bg-white border-slate-50'}`}>
                <div className={`w-full h-full rounded-full flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400' : 'bg-blue-50 text-[#2563EB]'}`}><UserIcon size={70} strokeWidth={1.5} /></div>
              </div>
            </div>
          </div>
          <div className="space-y-6 mt-4">
             <div className="space-y-1">
               <div className="px-4 pb-3">
                 <h2 className={`text-[22px] sm:text-[32px] font-black font-noto tracking-tight leading-tight break-words whitespace-normal ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{displayName}</h2>
               </div>
               <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">System Controller</p>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mx-1">
        <button 
          onClick={() => setView('admin-tutorials')} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'টিউটোরিয়াল ম্যানেজ' : 'Manage Tutorials'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Video Guides</p>
          </div>
        </button>

        <button 
          onClick={() => setView('admin-voice-service')} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Mic size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'ভয়েস ড্যাশবোর্ড' : 'Voice Dashboard'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Service Control</p>
          </div>
        </button>

        <button 
          onClick={() => setView('academic-calendar')} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Calendar size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'একাডেমিক ক্যালেন্ডার' : 'Academic Calendar'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Events & Holidays</p>
          </div>
        </button>

        <button 
          onClick={() => setIsEditingBulkSMS(true)} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Sliders size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'রেট ম্যানেজমেন্ট' : 'Rates Management'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Communication Rates</p>
          </div>
        </button>

        <button 
          onClick={() => setIsEditingBulkSMS(true)}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>Bulk SMS</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Master Gateway</p>
          </div>
        </button>
        
        <button 
          onClick={() => setIsEditingPackages(true)}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Package size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'প্যাকেজসমূহ' : 'Packages'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Subscription Plans</p>
          </div>
        </button>

        <button 
          onClick={() => setIsEditingPersonalApi(true)}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'এপিআই সিকিউরিটি' : 'API Security'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Personal Gateway</p>
          </div>
        </button>

        <button 
          onClick={() => setIsEditingPayment(true)}
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <CreditCard size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>Master Payment</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{globalSettings.bkash_number || 'N/A'}</p>
          </div>
        </button>

        <div className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
              <Languages size={24} />
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{t('language', lang)}</h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{t('change_lang', lang)}</p>
            </div>
          </div>
          <div className={`flex p-1 rounded-2xl border ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <button onClick={() => setLang('bn')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'bn' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>বাংলা</button>
            <button onClick={() => setLang('en')} className={`px-4 py-2.5 rounded-xl text-[10px] font-black transition-all ${lang === 'en' ? (madrasah?.theme === 'dark' ? 'bg-slate-700 text-blue-400 shadow-sm' : 'bg-white text-[#2563EB] shadow-sm') : 'text-slate-400'}`}>ENG</button>
          </div>
        </div>

        <div className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between gap-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-indigo-900 text-indigo-300' : 'bg-blue-50 text-[#2563EB]'}`}>
              {madrasah?.theme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'ডার্ক মোড' : 'Dark Mode'}</h5>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{lang === 'bn' ? 'চোখের আরামের জন্য' : 'For eye comfort'}</p>
            </div>
          </div>
          <button onClick={toggleTheme} className={`w-14 h-8 rounded-full relative transition-all duration-300 ${madrasah?.theme === 'dark' ? 'bg-indigo-600' : 'bg-slate-200'}`}>
            <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${madrasah?.theme === 'dark' ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        <button 
          onClick={() => setIsEditingGlobalUpdate(true)} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Globe size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'গ্লোবাল আপডেট' : 'Global Update'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Pop-up Control</p>
          </div>
        </button>

        <button 
          onClick={onLogout} 
          className={`col-span-2 p-6 rounded-[3rem] border shadow-sm flex items-center justify-between group active:scale-[0.98] transition-all ${madrasah?.theme === 'dark' ? 'bg-red-900/20 border-red-900/30' : 'bg-red-50/50 border-red-100'}`}
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <LogOut size={24} />
            </div>
            <div className="text-left">
              <h5 className={`text-base font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{t('logout', lang)}</h5>
              <p className="text-[10px] font-bold text-red-300 uppercase tracking-widest mt-1.5">{t('logout_system', lang)}</p>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-red-900/50' : 'bg-white text-red-200'}`}>
            <ChevronRight size={20} />
          </div>
        </button>
      </div>

      {isEditingPackages && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-2xl rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[85vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-5 shrink-0 relative overflow-hidden">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-amber-900/30 text-amber-400 border-amber-900/50' : 'bg-amber-50 text-amber-600 border-amber-100'}`}><Package size={20} strokeWidth={2.5} /></div>
                       <div><h3 className={`text-lg font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'সাবস্ক্রিপশন প্যাকেজসমূহ' : 'Subscription Packages'}</h3><p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Plan Management</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditingPackage({ name: '', rate: 0, features: [], sort_order: packages.length + 1 }); setShowPackageForm(true); }} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400 border-blue-900/50' : 'bg-blue-50 text-blue-600 border-blue-100'}`}><Plus size={18} /></button>
                      <button onClick={() => setIsEditingPackages(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-300 border-slate-100'}`}><X size={18} /></button>
                    </div>
                 </div>
              </div>
              <div className="px-6 pb-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {packages.map((pkg) => (
                      <div key={pkg.id} className={`p-5 rounded-[2rem] border relative group ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className={`text-base font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{pkg.name}</h4>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{pkg.rate.toFixed(2)} TK / Student</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingPackage(pkg); setShowPackageForm(true); }} className="p-2 text-slate-400 hover:text-blue-500"><Edit2 size={14} /></button>
                            <button onClick={() => handleDeletePackage(pkg.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          {pkg.features.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                              <CheckCircle2 size={10} className="text-emerald-500" />
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}

      {showPackageForm && createPortal(
        <div className="modal-overlay bg-slate-900/60 backdrop-blur-md z-[60] animate-in fade-in duration-300">
          <div className={`w-full max-w-md rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[90vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className="p-6 shrink-0 border-b border-slate-100/10">
              <div className="flex items-center justify-between">
                <h3 className={`text-xl font-black font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{editingPackage?.id ? 'প্যাকেজ এডিট' : 'নতুন প্যাকেজ'}</h3>
                <button onClick={() => setShowPackageForm(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase px-1">প্যাকেজের নাম</label>
                <input type="text" className={`w-full h-12 rounded-2xl px-4 font-bold outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} value={editingPackage?.name || ''} onChange={(e) => setEditingPackage({...editingPackage, name: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase px-1">রেট (প্রতি শিক্ষার্থী)</label>
                <input type="number" step="0.01" className={`w-full h-12 rounded-2xl px-4 font-bold outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} value={editingPackage?.rate || 0} onChange={(e) => setEditingPackage({...editingPackage, rate: parseFloat(e.target.value)})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase px-1">ফিচারসমূহ (কমা দিয়ে লিখুন)</label>
                <textarea rows={4} className={`w-full rounded-2xl p-4 font-bold outline-none border resize-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} value={editingPackage?.features?.join(', ') || ''} onChange={(e) => setEditingPackage({...editingPackage, features: e.target.value.split(',').map(f => f.trim()).filter(f => f !== '')})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase px-1">সিরিয়াল নম্বর</label>
                <input type="number" className={`w-full h-12 rounded-2xl px-4 font-bold outline-none border ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} value={editingPackage?.sort_order || 0} onChange={(e) => setEditingPackage({...editingPackage, sort_order: parseInt(e.target.value)})} />
              </div>
              <button onClick={handleSavePackage} disabled={saving} className="w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20 text-[13px] uppercase tracking-[0.25em] mt-4">
                {saving ? <Loader2 className="animate-spin" size={22} /> : <>Save Package</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {isEditingPersonalApi && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[85vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-5 shrink-0 relative overflow-hidden">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-amber-900/30 text-amber-400 border-amber-900/50' : 'bg-amber-50 text-amber-600 border-amber-100'}`}><ShieldCheck size={20} strokeWidth={2.5} /></div>
                       <div><h3 className={`text-lg font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'এপিআই সিকিউরিটি' : 'API Security'}</h3><p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Personal Account</p></div>
                    </div>
                    <button onClick={() => setIsEditingPersonalApi(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-300 border-slate-100'}`}><X size={18} /></button>
                 </div>
              </div>
              <div className="px-6 pb-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Personal Gateway Settings</h4>
                    <div className={`p-4 rounded-[2rem] border space-y-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">REVE API Key</label>
                          <input type="text" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={personalApiSettings.reve_api_key} onChange={(e) => setPersonalApiSettings({...personalApiSettings, reve_api_key: e.target.value})} placeholder="Enter REVE API Key" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Secret Key</label>
                          <input type="password" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={personalApiSettings.reve_secret_key} onChange={(e) => setPersonalApiSettings({...personalApiSettings, reve_secret_key: e.target.value})} placeholder="Enter Secret Key" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Masking / Sender ID</label>
                          <input type="text" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={personalApiSettings.reve_client_id} onChange={(e) => setPersonalApiSettings({...personalApiSettings, reve_client_id: e.target.value})} placeholder="e.g. DEENORA" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Voice Sender ID</label>
                          <input type="text" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={personalApiSettings.reve_caller_id} onChange={(e) => setPersonalApiSettings({...personalApiSettings, reve_caller_id: e.target.value})} placeholder="e.g. 8801..." />
                       </div>
                    </div>
                 </div>
                 <div className="pt-2">
                    <button onClick={handleSavePersonalApi} disabled={saving} className="relative w-full h-16 bg-amber-500 text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20 text-[13px] uppercase tracking-[0.25em]">
                       {saving ? <Loader2 className="animate-spin" size={22} /> : <>Save API Keys</>}
                    </button>
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}

      {isEditingBulkSMS && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[85vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-5 shrink-0 relative overflow-hidden">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400 border-blue-900/50' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}><LayoutDashboard size={20} strokeWidth={2.5} /></div>
                       <div><h3 className={`text-lg font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>Bulk SMS</h3><p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Master Gateway</p></div>
                    </div>
                    <button onClick={() => setIsEditingBulkSMS(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-300 border-slate-100'}`}><X size={18} /></button>
                 </div>
              </div>
              <div className="px-6 pb-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Gateway Protocols</h4>
                    <div className={`p-4 rounded-[2rem] border space-y-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Master API Key</label><input type="text" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={globalSettings.reve_api_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_api_key: e.target.value})} /></div>
                       <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Encryption Token</label><input type="password" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={globalSettings.reve_secret_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_secret_key: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Global Voice Sender ID</label><input type="text" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={globalSettings.reve_caller_id} onChange={(e) => setGlobalSettings({...globalSettings, reve_caller_id: e.target.value})} /></div>
                        <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Global Masking / Sender ID</label><input type="text" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={globalSettings.reve_client_id} onChange={(e) => setGlobalSettings({...globalSettings, reve_client_id: e.target.value})} /></div>
                    </div>
                 </div>
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Service Rates (Per Unit)</h4>
                    <div className={`p-4 rounded-[2rem] border space-y-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Bulk SMS Rate (TK)</label><input type="number" step="0.01" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={globalSettings.sms_rate} onChange={(e) => setGlobalSettings({...globalSettings, sms_rate: parseFloat(e.target.value)})} /></div>
                       <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Voice Call Rate (TK)</label><input type="number" step="0.01" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400 focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#2563EB] focus:border-[#2563EB]/50'}`} value={globalSettings.voice_rate} onChange={(e) => setGlobalSettings({...globalSettings, voice_rate: parseFloat(e.target.value)})} /></div>
                    </div>
                 </div>
                 <div className="pt-2">
                    <button onClick={handleSaveBulkSMS} disabled={saving} className="relative w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20 text-[13px] uppercase tracking-[0.25em]">
                       {saving ? <Loader2 className="animate-spin" size={22} /> : <>Save Settings</>}
                    </button>
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}

      {isEditingGlobalUpdate && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[85vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-5 shrink-0 relative overflow-hidden">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-orange-900/30 text-orange-400 border-orange-900/50' : 'bg-orange-50 text-orange-600 border-orange-100'}`}><Globe size={20} strokeWidth={2.5} /></div>
                       <div><h3 className={`text-lg font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'গ্লোবাল আপডেট' : 'Global Update'}</h3><p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Service Control</p></div>
                    </div>
                    <button onClick={() => setIsEditingGlobalUpdate(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-300 border-slate-100'}`}><X size={18} /></button>
                 </div>
              </div>
              <div className="px-6 pb-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 <div className="space-y-4">
                    <div className={`p-5 rounded-[2rem] border flex items-center justify-between ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="text-left">
                          <h5 className={`text-sm font-black font-noto leading-none ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'আপডেট শো করুন' : 'Show Update Popup'}</h5>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{lang === 'bn' ? 'সবার জন্য পপআপ' : 'Popup for everyone'}</p>
                       </div>
                       <button 
                          onClick={() => setGlobalSettings({...globalSettings, global_update_active: !globalSettings.global_update_active})} 
                          className={`w-12 h-6 rounded-full relative transition-all duration-300 ${globalSettings.global_update_active ? 'bg-orange-500' : 'bg-slate-300'}`}
                       >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${globalSettings.global_update_active ? 'left-6.5' : 'left-0.5'}`} />
                       </button>
                    </div>

                    <div className="space-y-1.5">
                       <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase">{lang === 'bn' ? 'আপডেট মেসেজ' : 'Update Message'}</label>
                          <div className="flex items-center gap-1.5">
                             <button 
                                onClick={() => {
                                   const start = '**';
                                   const end = '**';
                                   const msg = globalSettings.global_update_message;
                                   setGlobalSettings({...globalSettings, global_update_message: msg + (msg && !msg.endsWith(' ') ? ' ' : '') + start + (lang === 'bn' ? 'বোল্ড' : 'Bold') + end});
                                }}
                                className="w-8 h-8 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center text-xs font-black shadow-sm hover:scale-105 transition-all font-serif" title="Bold"
                             >
                                B
                             </button>
                             <button 
                                onClick={() => {
                                   const start = '*';
                                   const end = '*';
                                   const msg = globalSettings.global_update_message;
                                   setGlobalSettings({...globalSettings, global_update_message: msg + (msg && !msg.endsWith(' ') ? ' ' : '') + start + (lang === 'bn' ? 'ইটালিক' : 'Italic') + end});
                                }}
                                className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center text-xs italic shadow-sm hover:scale-105 transition-all font-serif" title="Italic"
                             >
                                I
                             </button>
                             <button 
                                onClick={() => {
                                   const start = '# ';
                                   const msg = globalSettings.global_update_message;
                                   setGlobalSettings({...globalSettings, global_update_message: msg + "\n" + start + (lang === 'bn' ? 'বড় হেডলাইন' : 'Big Heading')});
                                }}
                                className="w-9 h-8 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm hover:scale-105 transition-all" title="Large Text"
                             >
                                BIG
                             </button>
                             <button 
                                onClick={() => {
                                   const start = '##### ';
                                   const msg = globalSettings.global_update_message;
                                   setGlobalSettings({...globalSettings, global_update_message: msg + "\n" + start + (lang === 'bn' ? 'ছোট লেখা' : 'Small text')});
                                }}
                                className="w-9 h-8 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg flex items-center justify-center text-[8px] font-black shadow-sm hover:scale-105 transition-all" title="Small Text"
                             >
                                SML
                             </button>
                          </div>
                       </div>
                       <textarea 
                          rows={6} 
                          className={`w-full rounded-2xl p-4 font-bold outline-none border resize-none text-xs leading-relaxed ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} 
                          value={globalSettings.global_update_message} 
                          onChange={(e) => setGlobalSettings({...globalSettings, global_update_message: e.target.value})}
                          placeholder={lang === 'bn' ? 'এখানে মেসেজ লিখুন (Markdown সাপোর্ট করে)...' : 'Write message here (Markdown supported)...'}
                       />
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase px-1 flex items-center gap-2">
                          <Type size={12} />
                          {lang === 'bn' ? 'লাইভ প্রিভিউ' : 'Live Preview'}
                       </label>
                       <div className={`p-4 rounded-2xl border text-[11px] leading-relaxed break-words font-noto ${madrasah?.theme === 'dark' ? 'bg-slate-900/50 border-slate-700 text-slate-400' : 'bg-orange-50/20 border-orange-100 text-slate-600'}`}>
                          <article className="prose prose-xs dark:prose-invert max-w-none">
                             <ReactMarkdown>{globalSettings.global_update_message || '...'}</ReactMarkdown>
                          </article>
                       </div>
                    </div>


                    <div className="space-y-1.5">
                       <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase">{lang === 'bn' ? 'ভার্সন কোড' : 'Version Code'}</label>
                          <span className="text-[8px] font-bold text-orange-500 uppercase">{lang === 'bn' ? 'সবার জন্য পপআপ শো করতে ভার্সন বাড়ান' : 'Increase to force show for all'}</span>
                       </div>
                       <div className="flex gap-2">
                          <input 
                             type="number" 
                             className={`flex-1 h-11 rounded-xl px-4 font-bold text-xs outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} 
                             value={globalSettings.global_update_version} 
                             onChange={(e) => setGlobalSettings({...globalSettings, global_update_version: parseInt(e.target.value) || 0})}
                          />
                          <button 
                             onClick={() => setGlobalSettings({...globalSettings, global_update_version: globalSettings.global_update_version + 1})}
                             className="px-4 py-2 bg-orange-100 text-orange-600 rounded-xl font-bold text-[10px] uppercase active:scale-95 transition-all"
                          >
                             +1
                          </button>
                       </div>
                    </div>
                 </div>
                 <div className="pt-2">
                    <button onClick={handleSaveGlobalUpdate} disabled={saving} className="relative w-full h-16 bg-orange-600 text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20 text-[13px] uppercase tracking-[0.25em]">
                       {saving ? <Loader2 className="animate-spin" size={22} /> : <>{lang === 'bn' ? 'আপডেট সেভ করুন' : 'Save Update'}</>}
                    </button>
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}
      {isEditingPayment && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-sm rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[85vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-5 shrink-0 relative overflow-hidden">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400 border-indigo-900/50' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}><CreditCard size={20} strokeWidth={2.5} /></div>
                       <div><h3 className={`text-lg font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>Master Payment</h3><p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Global Gateway</p></div>
                    </div>
                    <button onClick={() => setIsEditingPayment(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-300 border-slate-100'}`}><X size={18} /></button>
                 </div>
              </div>
              <div className="px-6 pb-8 space-y-5 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 <div className="space-y-2.5">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Global Identities</h4>
                    <div className={`p-4 rounded-[2rem] border space-y-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Master Payment Number</label>
                          <input type="text" className={`w-full h-11 rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/50'}`} value={globalSettings.bkash_number} onChange={(e) => setGlobalSettings({...globalSettings, bkash_number: e.target.value})} placeholder="bKash Number" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Support Number</label>
                          <input type="text" className={`w-full h-11 rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/50'}`} value={globalSettings.support_number} onChange={(e) => setGlobalSettings({...globalSettings, support_number: e.target.value})} placeholder="Support Number" />
                       </div>
                    </div>
                 </div>
                 <div className="pt-2">
                    <button onClick={handleSavePayment} disabled={saving} className="relative w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20 text-[13px] uppercase tracking-[0.25em]">
                       {saving ? <Loader2 className="animate-spin" size={22} /> : <>Save Settings</>}
                    </button>
                 </div>
              </div>
           </div>
        </div>,
        document.body
      )}

      {showSuccessModal.show && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className={`w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-500 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}>
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto"><CheckCircle2 size={32} /></div>
            <div className="space-y-1"><h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{showSuccessModal.title}</h3><p className="text-slate-400 font-bold text-sm">{showSuccessModal.message}</p></div>
            <button onClick={() => setShowSuccessModal({ ...showSuccessModal, show: false })} className="w-full py-4 bg-[#2563EB] text-white font-black rounded-2xl shadow-premium active:scale-95 transition-all">ঠিক আছে</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SuperAccount;
