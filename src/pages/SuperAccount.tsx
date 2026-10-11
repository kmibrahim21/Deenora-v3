
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Loader2, User as UserIcon, ShieldCheck, ChevronRight, Smartphone, Save, Sliders, CreditCard, LayoutDashboard, X, Play, Mic, Moon, Sun, Languages, Globe, CheckCircle2, Package, Plus, Trash2, Edit2, ArrowLeft, ArrowRight, Calendar, Award, Type, Shield, Users2, UserPlus, Trash, Building2, BarChart3, Link2, Youtube, ExternalLink, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { linkifyMarkdown, getMarkdownComponents } from 'utils/markdownUtils';
import { supabase, smsApi } from 'supabase';
import { Institution, Language, View, SubscriptionPackage, SmsProviderConfig } from 'types';
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
  profile: any;
}

const SuperAccount: React.FC<SuperAccountProps> = ({ lang, setLang, setView, onLogout, onProfileUpdate, initialMadrasah, setStatusModal, dataVersion, triggerRefresh, profile }) => {
  const isSuperAdmin = profile?.role === 'super_admin';
  const isManager = profile?.role === 'manager';
  const [madrasah, setMadrasah] = useState<Institution | null>(initialMadrasah);
  const [saving, setSaving] = useState(false);
  const [isEditingBulkSMS, setIsEditingBulkSMS] = useState(false);
  const [isEditingGlobalUpdate, setIsEditingGlobalUpdate] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [isEditingPersonalApi, setIsEditingPersonalApi] = useState(false);
  const [isEditingManagerPermissions, setIsEditingManagerPermissions] = useState(false);
  const [isEditingStaff, setIsEditingStaff] = useState(false);
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
    reve_non_masking_id: '',
    automas_api_key: '',
    automas_masking_sender_id: '',
    automas_non_masking_sender_id: '',
    sms_provider_config: {
      reve: { masking_enabled: true, non_masking_enabled: true },
      automas: { masking_enabled: false, non_masking_enabled: false },
      primary: { masking: 'reve', non_masking: 'reve' },
      masking_rate: 0.55,
      non_masking_rate: 0.35
    } as SmsProviderConfig,
    bkash_number: '',
    nagad_number: '',
    support_number: '',
    sms_rate: 0.55,
    voice_rate: 0.45,
    manager_permissions: {} as any,
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
          { id: '1', name: 'স্টার্টার', rate: 0.50, features: ['এসএমএস'], sort_order: 1 },
          { id: '2', name: 'বেসিক', rate: 0.75, features: ['এসএমএস', 'ভয়েস কল'], sort_order: 2 },
          { id: '3', name: 'স্মার্ট', rate: 1.00, features: ['হাজিরা', 'এসএমএস', 'ভয়েস কল'], sort_order: 3 },
          { id: '4', name: 'একাডেমিক', rate: 1.00, features: ['পরীক্ষা', 'এসএমএস', 'ভয়েস কল'], sort_order: 4 },
          { id: '5', name: 'স্ট্যান্ডার্ড', rate: 1.50, features: ['হাজিরা', 'পরীক্ষা', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'ক্লাস রুটিন'], sort_order: 5 },
          { id: '6', name: 'ফিনান্স', rate: 1.50, features: ['হিসাব ও ফি', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'ক্লাস রুটিন'], sort_order: 6 },
          { id: '7', name: 'প্রফেশনাল', rate: 1.75, features: ['হাজিরা', 'হিসাব ও ফি', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'ক্লাস রুটিন'], sort_order: 7 },
          { id: '8', name: 'এন্টারপ্রাইজ', rate: 2.00, features: ['হাজিরা', 'পরীক্ষা', 'হিসাব ও ফি', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'ক্লাস রুটিন'], sort_order: 8 },
          { id: '9', name: 'এন্টারপ্রাইজ প্লাস', rate: 2.50, features: ['হাজিরা', 'পরীক্ষা', 'হিসাব ও ফি', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'ক্লাস রুটিন', 'শিক্ষার্থীর ছবি', 'আইডি কার্ড'], sort_order: 9 },
          { id: '10', name: 'আলটিমেট', rate: 3.00, features: ['হাজিরা', 'পরীক্ষা', 'হিসাব ও ফি', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'শিক্ষার্থীর ছবি', 'আইডি কার্ড', 'ক্লাস রুটিন', 'অভিভাবক পোর্টাল', 'মেসেজ'], sort_order: 10 },
        ];
        setPackages(defaults as any);
      }
    } catch (err) {
      const defaults = [
        { id: '1', name: 'স্টার্টার', rate: 0.50, features: ['এসএমএস'], sort_order: 1 },
        { id: '2', name: 'বেসিক', rate: 0.75, features: ['এসএমএস', 'ভয়েস কল'], sort_order: 2 },
        { id: '3', name: 'স্মার্ট', rate: 1.00, features: ['হাজিরা', 'এসএমএস', 'ভয়েস কল'], sort_order: 3 },
        { id: '4', name: 'একাডেমিক', rate: 1.00, features: ['পরীক্ষা', 'এসএমএস', 'ভয়েস কল'], sort_order: 4 },
        { id: '5', name: 'স্ট্যান্ডার্ড', rate: 1.50, features: ['হাজিরা', 'পরীক্ষা', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'ক্লাস রুটিন'], sort_order: 5 },
        { id: '6', name: 'ফিনান্স', rate: 1.50, features: ['হিসাব ও ফি', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'ক্লাস রুটিন'], sort_order: 6 },
        { id: '7', name: 'প্রফেশনাল', rate: 1.75, features: ['হাজিরা', 'হিসাব ও ফি', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'ক্লাস রুটিন'], sort_order: 7 },
        { id: '8', name: 'এন্টারপ্রাইজ', rate: 2.00, features: ['হাজিরা', 'পরীক্ষা', 'হিসাব ও ফি', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'ক্লাস রুটিন'], sort_order: 8 },
        { id: '9', name: 'এন্টারপ্রাইজ প্লাস', rate: 2.50, features: ['হাজিরা', 'পরীক্ষা', 'হিসাব ও ফি', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'ক্লাস রুটিন', 'শিক্ষার্থীর ছবি', 'আইডি কার্ড'], sort_order: 9 },
        { id: '10', name: 'আলটিমেট', rate: 3.00, features: ['হাজিরা', 'পরীক্ষা', 'হিসাব ও ফি', 'এসএমএস', 'ভয়েস কল', 'প্রত্যয়নপত্র', 'শিক্ষার্থীর ছবি', 'আইডি কার্ড', 'ক্লাস রুটিন', 'অভিভাবক পোর্টাল', 'মেসেজ'], sort_order: 10 },
      ];
      setPackages(defaults as any);
    }
  };

  const handleSavePackage = async () => {
    if (!editingPackage?.name || !editingPackage?.rate) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'update_package',
          id: editingPackage.id,
          name: editingPackage.name,
          rate: editingPackage.rate,
          features: editingPackage.features,
          sort_order: editingPackage.sort_order
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setShowPackageForm(false);
      fetchPackages();
      if (onProfileUpdate) onProfileUpdate();
      if (triggerRefresh) triggerRefresh();
      setShowSuccessModal({ show: true, title: 'প্যাকেজ আপডেট', message: 'প্যাকেজ সফলভাবে সংরক্ষণ করা হয়েছে।' });
    } catch (err: any) { 
      console.error('Error saving package:', err);
      const errorMessage = err.message || 'Unknown error';
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
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'delete_package',
          id
        })
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);

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
      reve_non_masking_id: settings.reve_non_masking_id || '',
      automas_api_key: settings.automas_api_key || '',
      automas_masking_sender_id: settings.automas_masking_sender_id || '',
      automas_non_masking_sender_id: settings.automas_non_masking_sender_id || '',
      sms_provider_config: settings.sms_provider_config || {
        reve: { masking_enabled: true, non_masking_enabled: true },
        automas: { masking_enabled: false, non_masking_enabled: false },
        primary: { masking: 'reve', non_masking: 'reve' },
        masking_rate: 0.55,
        non_masking_rate: 0.35
      },
      bkash_number: settings.bkash_number || '',
      nagad_number: settings.nagad_number || '',
      support_number: settings.support_number || '',
      sms_rate: settings.sms_rate || 0.55,
      voice_rate: settings.voice_rate || 0.45,
      manager_permissions: settings.manager_permissions || {},
      global_update_active: settings.global_update_active || false,
      global_update_message: settings.global_update_message || '',
      global_update_version: settings.global_update_version || 0
    });
  };

  const handleSaveBulkSMS = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'update_system_settings',
          reve_api_key: (globalSettings.reve_api_key || '').trim(),
          reve_secret_key: (globalSettings.reve_secret_key || '').trim(),
          reve_caller_id: (globalSettings.reve_caller_id || '').trim(),
          reve_client_id: (globalSettings.reve_client_id || '').trim(),
          reve_non_masking_id: (globalSettings.reve_non_masking_id || '').trim(),
          automas_api_key: (globalSettings.automas_api_key || '').trim(),
          automas_masking_sender_id: (globalSettings.automas_masking_sender_id || '').trim(),
          automas_non_masking_sender_id: (globalSettings.automas_non_masking_sender_id || '').trim(),
          sms_provider_config: globalSettings.sms_provider_config,
          bkash_number: (globalSettings.bkash_number || '').trim(),
          nagad_number: (globalSettings.nagad_number || '').trim(),
          support_number: (globalSettings.support_number || '').trim(),
          sms_rate: Number(globalSettings.sms_rate),
          voice_rate: Number(globalSettings.voice_rate),
          manager_permissions: globalSettings.manager_permissions
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setIsEditingBulkSMS(false);
      setShowSuccessModal({ show: true, title: 'Bulk SMS আপডেট', message: 'Bulk SMS ও রেট সেটিংস আপডেট হয়েছে।' });
      fetchGlobalSettings();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleSaveGlobalUpdate = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'update_system_settings',
          global_update_active: globalSettings.global_update_active,
          global_update_message: globalSettings.global_update_message,
          global_update_version: globalSettings.global_update_version
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setIsEditingGlobalUpdate(false);
      setShowSuccessModal({ show: true, title: 'আপডেট সেটিংস', message: 'গ্লোবাল আপডেট সফলভাবে সেভ হয়েছে।' });
      fetchGlobalSettings();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleSavePayment = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'update_system_settings',
          bkash_number: (globalSettings.bkash_number || '').trim(),
          nagad_number: (globalSettings.nagad_number || '').trim(),
          support_number: (globalSettings.support_number || '').trim()
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setIsEditingPayment(false);
      setShowSuccessModal({ show: true, title: 'পেমেন্ট আপডেট', message: 'পেমেন্ট সেটিংস আপডেট হয়েছে।' });
      fetchGlobalSettings();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const handleSavePersonalApi = async () => {
    if (!madrasah?.id) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'update_institution',
          id: madrasah.id,
          reve_api_key: personalApiSettings.reve_api_key.trim(),
          reve_secret_key: personalApiSettings.reve_secret_key.trim(),
          reve_client_id: personalApiSettings.reve_client_id.trim(),
          voice_sender_id: personalApiSettings.reve_caller_id.trim()
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);
      
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

  const handleSaveManagerPermissions = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'update_system_settings',
          manager_permissions: globalSettings.manager_permissions
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setIsEditingManagerPermissions(false);
      setShowSuccessModal({ show: true, title: 'ম্যানেজার পারমিশন', message: 'ম্যানেজারের গ্লোবাল পারমিশন সফলভাবে আপডেট হয়েছে।' });
      fetchGlobalSettings();
    } catch (err: any) { alert(err.message); } finally { setSaving(false); }
  };

  const [staff, setStaff] = useState<any[]>([]);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', email: '', password: '', role: 'manager' as any });
  const [editingStaff, setEditingStaff] = useState<any | null>(null);
  const [isUpdatingStaff, setIsUpdatingStaff] = useState(false);

  const fetchStaff = async () => {
    try {
      const { data: sysInst } = await supabase.from('institutions').select('id').eq('name', 'SYSTEM_GLOBAL_INTERNAL').single();
      if (!sysInst) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('institution_id', sysInst.id)
        .in('role', ['manager', 'super_admin']);
      
      if (error) throw error;
      setStaff(data || []);
    } catch (err) {
      console.error("Error fetching staff:", err);
    }
  };

  useEffect(() => {
    if (isEditingStaff) {
      fetchStaff();
    }
  }, [isEditingStaff]);

  const handleCreateStaff = async () => {
    if (!newStaff.name || !newStaff.email || !newStaff.password) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'create_staff',
          ...newStaff
        })
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setShowStaffForm(false);
      setNewStaff({ name: '', email: '', password: '', role: 'manager' });
      fetchStaff();
      setShowSuccessModal({ show: true, title: 'স্টাফ তৈরি', message: 'নতুন স্টাফ সফলভাবে তৈরি হয়েছে।' });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;
    
    setIsUpdatingStaff(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'update_staff',
          id: editingStaff.id,
          name: editingStaff.full_name,
          role: editingStaff.role,
          permissions: editingStaff.permissions,
          is_active: editingStaff.is_active
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setStatusModal({
        show: true,
        type: 'success',
        title: 'সফল',
        message: 'ম্যানেজার তথ্য আপডেট করা হয়েছে।'
      });
      setEditingStaff(null);
      fetchStaff();
    } catch (err: any) {
      console.error('Error updating staff:', err);
      setStatusModal({
        show: true,
        type: 'error',
        title: 'ব্যর্থ',
        message: err.message || 'আপডেট করা সম্ভব হয়নি।'
      });
    } finally {
      setIsUpdatingStaff(false);
    }
  };
  const handleDeleteStaff = async (id: string) => {
    if (!confirm('আপনি কি এই স্টাফ মেম্বারকে ডিলিট করতে চান?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          action: 'delete_staff',
          id
        })
      });

      const result = await res.json();
      if (result.error) throw new Error(result.error);

      fetchStaff();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleManagerPermission = (perm: string) => {
    setGlobalSettings(prev => ({
      ...prev,
      manager_permissions: {
        ...prev.manager_permissions,
        [perm]: !prev.manager_permissions[perm]
      }
    }));
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
          onClick={() => setView('admin-panel')} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Building2 size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'প্রতিষ্ঠান তালিকা' : 'Institutions List'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage Schools</p>
          </div>
        </button>

        <button 
          onClick={() => setView('admin-dashboard')} 
          className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
        >
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <BarChart3 size={24} />
          </div>
          <div>
            <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'ড্যাশবোর্ড ও রিপোর্ট' : 'Dashboard & Reports'}</h5>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Analytics Hub</p>
          </div>
        </button>

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
        
        {isSuperAdmin && (
          <button 
            onClick={() => setIsEditingManagerPermissions(true)}
            className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
          >
            <div className="w-14 h-14 bg-blue-50 text-[#2563EB] rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Shield size={24} />
            </div>
            <div>
              <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'ম্যানেজার পারমিশন' : 'Manager Permissions'}</h5>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Global Role Config</p>
            </div>
          </button>
        )}

        {isSuperAdmin && (
          <button 
            onClick={() => setIsEditingStaff(true)}
            className={`p-6 rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 group active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}
          >
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users2 size={24} />
            </div>
            <div>
              <h5 className={`text-sm font-black font-noto leading-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'স্টাফ ম্যানেজমেন্ট' : 'Staff Management'}</h5>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Manage Managers</p>
            </div>
          </button>
        )}

        {isSuperAdmin && (
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
        )}

        {isSuperAdmin && (
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
        )}

        {isSuperAdmin && (
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
        )}


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

      {isEditingManagerPermissions && createPortal(
        <div className="modal-overlay bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-300">
           <div className={`w-full max-w-xl rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[85vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-5 shrink-0 relative overflow-hidden">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400 border-blue-900/50' : 'bg-blue-50 text-blue-600 border-blue-100'}`}><Shield size={20} strokeWidth={2.5} /></div>
                       <div><h3 className={`text-lg font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{lang === 'bn' ? 'ম্যানেজার পারমিশন' : 'Manager Permissions'}</h3><p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Global Role Config</p></div>
                    </div>
                    <button onClick={() => setIsEditingManagerPermissions(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-300 border-slate-100'}`}><X size={18} /></button>
                 </div>
              </div>
              <div className="px-6 pb-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 <div className="p-5 rounded-[2rem] border space-y-4 bg-amber-50/50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30">
                    <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 leading-relaxed">
                      {lang === 'bn' 
                        ? 'এখানে আপনি সিস্টেমের "ম্যানেজার" রোলের জন্য গ্লোবাল পারমিশন সেট করতে পারবেন। আপনি যা সিলেক্ট করবেন, সকল মাদ্রাসার ম্যানেজাররা সেই পারমিশনগুলো পাবেন।' 
                        : 'Here you can set global permissions for the "Manager" role in the system. Managers of all institutions will inherit these permissions.'}
                    </p>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'institutions', label: lang === 'bn' ? 'প্রতিষ্ঠান ম্যানেজ (নতুন প্রতিষ্ঠান এড)' : 'Manage Institutions (Add New)' },
                      { id: 'institution_info', label: lang === 'bn' ? 'প্রতিষ্ঠান তথ্য' : 'Institution Info' },
                      { id: 'api_security', label: lang === 'bn' ? 'এপিআই সিকিউরিটি' : 'API Security' },
                      { id: 'permissions', label: lang === 'bn' ? 'পারমিশন' : 'Permissions' },
                      { id: 'subscription', label: lang === 'bn' ? 'সাবস্ক্রিপশন' : 'Subscription' },
                      { id: 'history', label: lang === 'bn' ? 'ইতিহাস' : 'History' },
                      { id: 'payment', label: lang === 'bn' ? 'পেমেন্ট' : 'Payment' },
                      { id: 'contact', label: lang === 'bn' ? 'যোগাযোগ' : 'Contact' },
                      { id: 'tutorials', label: lang === 'bn' ? 'টিউটোরিয়াল ম্যানেজ' : 'Manage Tutorials' },
                      { id: 'voice_dashboard', label: lang === 'bn' ? 'ভয়েস ড্যাশবোর্ড / গেটওয়ে' : 'Voice Dashboard / Gateway' },
                      { id: 'can_use_voice_call', label: lang === 'bn' ? 'ভয়েস ব্রডকাস্ট / কল' : 'Voice Broadcast / Call' },
                      { id: 'packages', label: lang === 'bn' ? 'প্যাকেজসমূহ' : 'Packages' },
                      { id: 'read_only', label: lang === 'bn' ? 'রিড-অনলি মোড (শুধু দেখার এক্সেস)' : 'Read-Only Mode (View Only)' }
                    ].map((perm) => (
                      <button
                        key={perm.id}
                        onClick={() => toggleManagerPermission(perm.id)}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-95 ${
                          globalSettings.manager_permissions?.[perm.id]
                            ? 'bg-blue-50 border-blue-200 text-[#2563EB]'
                            : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200'
                        }`}
                      >
                        <span className="text-xs font-black font-noto">{perm.label}</span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          globalSettings.manager_permissions?.[perm.id] ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'
                        }`}>
                          {globalSettings.manager_permissions?.[perm.id] && <CheckCircle2 size={12} />}
                        </div>
                      </button>
                    ))}
                 </div>

                 <button onClick={handleSaveManagerPermissions} disabled={saving} className="relative w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/20 text-[13px] uppercase tracking-[0.25em] mt-2">
                    {saving ? <Loader2 className="animate-spin" size={22} /> : <>Update Manager Access</>}
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* Staff Management Modal */}
      {isEditingStaff && createPortal(
        <div className="fixed inset-0 bg-[#080A12]/60 backdrop-blur-xl z-[9999] flex items-center justify-center p-4">
          <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} w-full max-w-2xl rounded-[3rem] shadow-2xl border overflow-hidden flex flex-col max-h-[90vh]`}>
            <div className={`p-8 border-b flex items-center justify-between shrink-0 ${madrasah?.theme === 'dark' ? 'border-slate-800' : 'border-slate-50'}`}>
              <div>
                <h3 className={`text-2xl font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#2E0B5E]'}`}>
                  {lang === 'bn' ? 'স্টাফ ম্যানেজমেন্ট' : 'Staff Management'}
                </h3>
                <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Manage Global Managers</p>
              </div>
              <button onClick={() => setIsEditingStaff(false)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 space-y-6">
              <div className="flex justify-between items-center">
                <h4 className={`font-bold font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>
                  {lang === 'bn' ? 'স্টাফ মেম্বার তালিকা' : 'Staff List'} ({staff.length})
                </h4>
                <button 
                  onClick={() => setShowStaffForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] text-white rounded-xl text-sm font-bold active:scale-95 transition-all"
                >
                  <UserPlus size={18} />
                  {lang === 'bn' ? 'নতুন স্টাফ' : 'New Staff'}
                </button>
              </div>

              <div className="space-y-3">
                {staff.map(s => (
                  <div key={s.id} className={`p-4 rounded-2xl border flex items-center justify-between ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">
                        {s.full_name?.charAt(0)}
                      </div>
                      <div>
                        <h5 className={`font-bold font-noto ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>{s.full_name}</h5>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${s.role === 'super_admin' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {s.role}
                          </span>
                          {s.permissions?.read_only && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                              <Eye size={10} /> {lang === 'bn' ? 'রিড-অনলি' : 'Read Only'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setEditingStaff(s)}
                        className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all active:scale-95"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteStaff(s.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </div>
                ))}
                {staff.length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-noto">
                    কোনো স্টাফ মেম্বার পাওয়া যায়নি
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => !isUpdatingStaff && setEditingStaff(null)}
          />
          <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} border rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 slide-in-from-bottom-10 duration-300`}>
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1">
                <h3 className={`text-xl font-black ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>Edit Staff Member</h3>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Update permissions and details</p>
              </div>
              <button 
                onClick={() => setEditingStaff(null)}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-8">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Full Name</label>
                  <input 
                    type="text" 
                    className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`}
                    value={editingStaff.full_name}
                    onChange={e => setEditingStaff({...editingStaff, full_name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Role</label>
                  <select 
                    className={`w-full h-14 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-900'} border rounded-2xl px-5 font-black text-sm outline-none focus:border-blue-500 transition-all`}
                    value={editingStaff.role}
                    onChange={e => setEditingStaff({...editingStaff, role: e.target.value as any})}
                  >
                    <option value="manager">Manager</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>

              {/* Read Only Mode Setting */}
              <div 
                onClick={() => {
                  const currentPerms = editingStaff.permissions || {};
                  setEditingStaff({
                    ...editingStaff,
                    permissions: {
                      ...currentPerms,
                      read_only: !currentPerms.read_only
                    }
                  });
                }}
                className={`p-5 rounded-2xl border cursor-pointer transition-all ${
                  editingStaff.permissions?.read_only 
                    ? 'border-amber-500/50 bg-amber-500/10 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30' 
                    : (madrasah?.theme === 'dark' ? 'bg-slate-800/40 border-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-200 hover:border-slate-300')
                } hover:scale-[1.01] active:scale-95`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
                      editingStaff.permissions?.read_only ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : (madrasah?.theme === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-600')
                    }`}>
                      <Eye size={22} />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-black uppercase tracking-wider ${
                          editingStaff.permissions?.read_only ? 'text-amber-600 dark:text-amber-400' : (madrasah?.theme === 'dark' ? 'text-white' : 'text-slate-900')
                        }`}>
                          {lang === 'bn' ? 'রিড-অনলি মোড (Read Only Mode)' : 'Read Only Mode'}
                        </span>
                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          editingStaff.permissions?.read_only ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                        }`}>
                          {editingStaff.permissions?.read_only ? (lang === 'bn' ? 'শুধু দেখার অনুমতি' : 'View Only') : (lang === 'bn' ? 'সম্পূর্ণ এক্সেস' : 'Normal')}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-slate-400 leading-tight">
                        {lang === 'bn' 
                          ? 'এই পারমিশন দিলে ম্যানেজার শুধু তথ্য দেখতে পারবে, কোনো পরিবর্তন বা এডিট করতে পারবে না।' 
                          : 'Read-only permission allows the manager to only view details without editing, saving, or deleting.'}
                      </p>
                    </div>
                  </div>

                  <div className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${
                    editingStaff.permissions?.read_only ? 'bg-amber-500' : (madrasah?.theme === 'dark' ? 'bg-slate-700' : 'bg-slate-300')
                  }`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${
                      editingStaff.permissions?.read_only ? 'left-7' : 'left-1'
                    }`} />
                  </div>
                </div>

                {editingStaff.permissions?.read_only && (
                  <div className="mt-3 pt-3 border-t border-amber-500/20 text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 font-noto">
                    <CheckCircle2 size={13} className="shrink-0" />
                    <span>{lang === 'bn' ? 'রিড-অনলি পারমিশন সক্রিয়: ম্যানেজার কোনো ডাটা পরিবর্তন করতে পারবেন না।' : 'Read-only permission active: manager cannot make any modifications.'}</span>
                  </div>
                )}
              </div>

              {/* Individual Permissions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <ShieldCheck size={16} className="text-blue-500" />
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Module Permissions</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: 'read_only', label: lang === 'bn' ? 'রিড-অনলি মোড (Read Only)' : 'Read-Only Mode' },
                    { key: 'institutions', label: 'Manage Institutions' },
                    { key: 'approvals', label: 'Manage Approvals' },
                    { key: 'sms', label: 'Manage SMS' },
                    { key: 'can_use_voice_call', label: 'Voice Call / Broadcast' },
                    { key: 'voice_dashboard', label: 'Voice Gateway / Service' },
                    { key: 'accounting', label: 'Accounting' },
                    { key: 'fees', label: 'Manage Fees' },
                    { key: 'dashboard', label: 'Global Dashboard' },
                    { key: 'tutorials', label: 'Manage Tutorials' },
                    { key: 'can_manage_students', label: 'Manage Students' }
                  ].map(perm => (
                    <div 
                      key={perm.key}
                      onClick={() => {
                        const currentPerms = editingStaff.permissions || {};
                        setEditingStaff({
                          ...editingStaff,
                          permissions: {
                            ...currentPerms,
                            [perm.key]: !currentPerms[perm.key as keyof typeof currentPerms]
                          }
                        });
                      }}
                      className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${editingStaff.permissions?.[perm.key as keyof typeof editingStaff.permissions] ? 'border-blue-500/30 bg-blue-500/5' : (madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100')} hover:scale-[1.02] active:scale-95`}
                    >
                      <span className={`text-[11px] font-black uppercase tracking-widest ${madrasah?.theme === 'dark' ? 'text-slate-300' : 'text-slate-600'}`}>{perm.label}</span>
                      <div className={`w-10 h-5 rounded-full transition-all relative ${editingStaff.permissions?.[perm.key as keyof typeof editingStaff.permissions] ? 'bg-blue-500' : (madrasah?.theme === 'dark' ? 'bg-slate-700' : 'bg-slate-200')}`}>
                        <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-all ${editingStaff.permissions?.[perm.key as keyof typeof editingStaff.permissions] ? 'left-6' : 'left-1'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Toggle */}
              <div 
                onClick={() => setEditingStaff({...editingStaff, is_active: !editingStaff.is_active})}
                className={`flex items-center justify-between p-5 rounded-2xl border cursor-pointer transition-all ${editingStaff.is_active ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'} hover:scale-[1.02] active:scale-95`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full animate-pulse ${editingStaff.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <div className="space-y-0.5">
                    <span className={`text-xs font-black uppercase tracking-widest ${editingStaff.is_active ? 'text-emerald-500' : 'text-rose-500'}`}>Account Status</span>
                    <p className="text-[10px] font-bold text-slate-400">Current state of the user account</p>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${editingStaff.is_active ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                  {editingStaff.is_active ? 'Active' : 'Disabled'}
                </div>
              </div>

              {/* Save Button */}
              <button 
                onClick={handleUpdateStaff}
                disabled={isUpdatingStaff}
                className="w-full h-16 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-[1.25rem] font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-blue-500/25 flex items-center justify-center gap-3 transition-all active:scale-95"
              >
                {isUpdatingStaff ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Save size={20} />
                    Update Manager Details
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showStaffForm && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
              <div className={`${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} w-full max-w-md rounded-[2.5rem] shadow-2xl border overflow-hidden p-8`}>
                <h4 className={`text-xl font-black font-noto mb-6 ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#2E0B5E]'}`}>
                  {lang === 'bn' ? 'নতুন স্টাফ তৈরি করুন' : 'Create New Staff'}
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">Full Name</label>
                    <input 
                      type="text" 
                      value={newStaff.name}
                      onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                      className={`w-full p-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}
                      placeholder="Enter name"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">Email Address</label>
                    <input 
                      type="email" 
                      value={newStaff.email}
                      onChange={e => setNewStaff({...newStaff, email: e.target.value})}
                      className={`w-full p-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}
                      placeholder="Enter email"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">Password</label>
                    <input 
                      type="password" 
                      value={newStaff.password}
                      onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                      className={`w-full p-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}
                      placeholder="Min 6 characters"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block px-1">System Role</label>
                    <select 
                      value={newStaff.role}
                      onChange={e => setNewStaff({...newStaff, role: e.target.value as any})}
                      className={`w-full p-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold appearance-none ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`}
                    >
                      <option value="manager">Manager</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button 
                    onClick={() => setShowStaffForm(false)}
                    className={`flex-1 p-4 rounded-2xl font-bold transition-all active:scale-95 ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button 
                    onClick={handleCreateStaff}
                    disabled={saving}
                    className="flex-1 p-4 bg-[#2563EB] text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    {lang === 'bn' ? 'তৈরি করুন' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

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
           <div className={`w-full max-w-lg rounded-[3rem] shadow-2xl animate-in zoom-in-95 duration-500 border overflow-hidden flex flex-col max-h-[90vh] relative ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
              <div className="p-5 shrink-0 relative overflow-hidden border-b border-slate-100 dark:border-slate-800">
                 <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${madrasah?.theme === 'dark' ? 'bg-blue-900/30 text-blue-400 border-blue-900/50' : 'bg-blue-50 text-[#2563EB] border-blue-100'}`}><LayoutDashboard size={20} strokeWidth={2.5} /></div>
                       <div><h3 className={`text-lg font-black font-noto tracking-tight ${madrasah?.theme === 'dark' ? 'text-white' : 'text-[#1E3A8A]'}`}>SMS Provider Settings</h3><p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em]">Multi-Provider Gateway Router</p></div>
                    </div>
                    <button onClick={() => setIsEditingBulkSMS(false)} className={`w-9 h-9 rounded-xl flex items-center justify-center active:scale-90 transition-all border ${madrasah?.theme === 'dark' ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-300 border-slate-100'}`}><X size={18} /></button>
                 </div>
              </div>
              <div className="px-6 py-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 relative z-10">
                 
                 {/* REVE SMS Provider */}
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">REVE Gateway</h4>
                       <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400 border border-blue-100 dark:border-blue-900">REVE SMS</span>
                    </div>
                    <div className={`p-4 rounded-[2rem] border space-y-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                          <label className="flex items-center justify-between p-2.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-pointer">
                             <span className="text-[10px] font-bold dark:text-slate-200">Masking SMS</span>
                             <input 
                                type="checkbox" 
                                className="w-4 h-4 accent-blue-600 rounded" 
                                checked={globalSettings.sms_provider_config?.reve?.masking_enabled ?? true} 
                                onChange={(e) => setGlobalSettings({
                                   ...globalSettings,
                                   sms_provider_config: {
                                      ...globalSettings.sms_provider_config,
                                      reve: { ...globalSettings.sms_provider_config?.reve, masking_enabled: e.target.checked }
                                   }
                                })}
                             />
                          </label>
                          <label className="flex items-center justify-between p-2.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-pointer">
                             <span className="text-[10px] font-bold dark:text-slate-200">Non-Masking SMS</span>
                             <input 
                                type="checkbox" 
                                className="w-4 h-4 accent-blue-600 rounded" 
                                checked={globalSettings.sms_provider_config?.reve?.non_masking_enabled ?? true} 
                                onChange={(e) => setGlobalSettings({
                                   ...globalSettings,
                                   sms_provider_config: {
                                      ...globalSettings.sms_provider_config,
                                      reve: { ...globalSettings.sms_provider_config?.reve, non_masking_enabled: e.target.checked }
                                   }
                                })}
                             />
                          </label>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">API Key</label><input type="text" className={`w-full h-11 rounded-xl px-3 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} value={globalSettings.reve_api_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_api_key: e.target.value})} placeholder="REVE API Key" /></div>
                          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Secret Key</label><input type="password" className={`w-full h-11 rounded-xl px-3 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} value={globalSettings.reve_secret_key} onChange={(e) => setGlobalSettings({...globalSettings, reve_secret_key: e.target.value})} placeholder="Secret Key" /></div>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Masking Sender ID</label><input type="text" className={`w-full h-11 rounded-xl px-3 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} value={globalSettings.reve_client_id} onChange={(e) => setGlobalSettings({...globalSettings, reve_client_id: e.target.value})} placeholder="e.g. DEENORA" /></div>
                          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Non-Masking Sender ID</label><input type="text" className={`w-full h-11 rounded-xl px-3 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} value={globalSettings.reve_non_masking_id || globalSettings.reve_caller_id} onChange={(e) => setGlobalSettings({...globalSettings, reve_non_masking_id: e.target.value, reve_caller_id: e.target.value})} placeholder="e.g. 88096..." /></div>
                       </div>
                    </div>
                 </div>

                 {/* Automas SMS Provider */}
                 <div className="space-y-3">
                    <div className="flex items-center justify-between">
                       <h4 className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em]">Automas Gateway</h4>
                       <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400 border border-purple-100 dark:border-purple-900">Automas SMS</span>
                    </div>
                    <div className={`p-4 rounded-[2rem] border space-y-4 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="grid grid-cols-2 gap-3 pb-2 border-b border-slate-200 dark:border-slate-700">
                          <label className="flex items-center justify-between p-2.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-pointer">
                             <span className="text-[10px] font-bold dark:text-slate-200">Masking SMS</span>
                             <input 
                                type="checkbox" 
                                className="w-4 h-4 accent-purple-600 rounded" 
                                checked={globalSettings.sms_provider_config?.automas?.masking_enabled ?? false} 
                                onChange={(e) => setGlobalSettings({
                                   ...globalSettings,
                                   sms_provider_config: {
                                      ...globalSettings.sms_provider_config,
                                      automas: { ...globalSettings.sms_provider_config?.automas, masking_enabled: e.target.checked }
                                   }
                                })}
                             />
                          </label>
                          <label className="flex items-center justify-between p-2.5 rounded-xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-pointer">
                             <span className="text-[10px] font-bold dark:text-slate-200">Non-Masking SMS</span>
                             <input 
                                type="checkbox" 
                                className="w-4 h-4 accent-purple-600 rounded" 
                                checked={globalSettings.sms_provider_config?.automas?.non_masking_enabled ?? false} 
                                onChange={(e) => setGlobalSettings({
                                   ...globalSettings,
                                   sms_provider_config: {
                                      ...globalSettings.sms_provider_config,
                                      automas: { ...globalSettings.sms_provider_config?.automas, non_masking_enabled: e.target.checked }
                                   }
                                })}
                             />
                          </label>
                       </div>
                       <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Automas API Key</label><input type="text" className={`w-full h-11 rounded-xl px-3 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-purple-400' : 'bg-white border-slate-200 text-purple-600'}`} value={globalSettings.automas_api_key} onChange={(e) => setGlobalSettings({...globalSettings, automas_api_key: e.target.value})} placeholder="Automas API Key" /></div>
                       <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Masking Sender ID</label><input type="text" className={`w-full h-11 rounded-xl px-3 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-purple-400' : 'bg-white border-slate-200 text-purple-600'}`} value={globalSettings.automas_masking_sender_id} onChange={(e) => setGlobalSettings({...globalSettings, automas_masking_sender_id: e.target.value})} placeholder="Approved Masking ID" /></div>
                          <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase px-1">Non-Masking Sender ID</label><input type="text" className={`w-full h-11 rounded-xl px-3 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-purple-400' : 'bg-white border-slate-200 text-purple-600'}`} value={globalSettings.automas_non_masking_sender_id} onChange={(e) => setGlobalSettings({...globalSettings, automas_non_masking_sender_id: e.target.value})} placeholder="Approved Non-Masking ID" /></div>
                       </div>
                    </div>
                 </div>

                 {/* Rates */}
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Service Rates (Per Unit)</h4>
                    <div className={`p-4 rounded-[2rem] border grid grid-cols-1 md:grid-cols-2 gap-3 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Non-Masking Rate (TK)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} 
                            value={globalSettings.sms_provider_config?.non_masking_rate || 0} 
                            onChange={(e) => setGlobalSettings({
                               ...globalSettings,
                               sms_provider_config: {
                                  ...globalSettings.sms_provider_config,
                                  non_masking_rate: parseFloat(e.target.value)
                               }
                            })} 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Masking Rate (TK)</label>
                          <input 
                            type="number" 
                            step="0.01" 
                            className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} 
                            value={globalSettings.sms_provider_config?.masking_rate || 0} 
                            onChange={(e) => setGlobalSettings({
                               ...globalSettings,
                               sms_provider_config: {
                                  ...globalSettings.sms_provider_config,
                                  masking_rate: parseFloat(e.target.value)
                               }
                            })} 
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Bulk SMS Rate (TK)</label>
                          <input type="number" step="0.01" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} value={globalSettings.sms_rate} onChange={(e) => setGlobalSettings({...globalSettings, sms_rate: parseFloat(e.target.value)})} />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Voice Call Rate (TK)</label>
                          <input type="number" step="0.01" className={`w-full h-11 rounded-xl px-4 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-blue-400' : 'bg-white border-slate-200 text-[#2563EB]'}`} value={globalSettings.voice_rate} onChange={(e) => setGlobalSettings({...globalSettings, voice_rate: parseFloat(e.target.value)})} />
                       </div>
                    </div>
                 </div>

                 {/* Default SMS Type & Primary Provider Configuration */}
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">Global Routing Rules</h4>
                    <div className={`p-4 rounded-[2rem] border grid grid-cols-1 md:grid-cols-3 gap-3 ${madrasah?.theme === 'dark' ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Default SMS Type</label>
                          <select 
                             className={`w-full h-11 rounded-xl px-3 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-white border-slate-200 text-emerald-600'}`}
                             value={globalSettings.sms_provider_config?.default_type || 'non_masking'}
                             onChange={(e) => setGlobalSettings({
                                ...globalSettings,
                                sms_provider_config: {
                                   ...globalSettings.sms_provider_config,
                                   default_type: e.target.value as any
                                }
                             })}
                          >
                             <option value="masking">Masking SMS</option>
                             <option value="non_masking">Non-Masking SMS</option>
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Masking Primary</label>
                          <select 
                             className={`w-full h-11 rounded-xl px-3 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-amber-700'}`}
                             value={globalSettings.sms_provider_config?.primary?.masking || 'reve'}
                             onChange={(e) => setGlobalSettings({
                                ...globalSettings,
                                sms_provider_config: {
                                   ...globalSettings.sms_provider_config,
                                   primary: { ...globalSettings.sms_provider_config?.primary, masking: e.target.value as any }
                                }
                             })}
                          >
                             <option value="reve">REVE</option>
                             <option value="automas">Automas</option>
                          </select>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">Non-Masking Primary</label>
                          <select 
                             className={`w-full h-11 rounded-xl px-3 font-bold text-[11px] outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-amber-400' : 'bg-white border-slate-200 text-amber-700'}`}
                             value={globalSettings.sms_provider_config?.primary?.non_masking || 'reve'}
                             onChange={(e) => setGlobalSettings({
                                ...globalSettings,
                                sms_provider_config: {
                                   ...globalSettings.sms_provider_config,
                                   primary: { ...globalSettings.sms_provider_config?.primary, non_masking: e.target.value as any }
                                }
                             })}
                          >
                             <option value="reve">REVE</option>
                             <option value="automas">Automas</option>
                          </select>
                       </div>
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
                          <div className="flex flex-wrap items-center gap-1.5">
                             <button 
                                type="button"
                                onClick={() => {
                                   const start = '**';
                                   const end = '**';
                                   const msg = globalSettings.global_update_message;
                                   setGlobalSettings({...globalSettings, global_update_message: msg + (msg && !msg.endsWith(' ') ? ' ' : '') + start + (lang === 'bn' ? 'বোল্ড লেখা' : 'Bold text') + end});
                                }}
                                className="w-8 h-8 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center text-xs font-black shadow-sm hover:scale-105 transition-all font-serif" title="Bold"
                             >
                                B
                             </button>
                             <button 
                                type="button"
                                onClick={() => {
                                   const start = '*';
                                   const end = '*';
                                   const msg = globalSettings.global_update_message;
                                   setGlobalSettings({...globalSettings, global_update_message: msg + (msg && !msg.endsWith(' ') ? ' ' : '') + start + (lang === 'bn' ? 'ইটালিক লেখা' : 'Italic text') + end});
                                }}
                                className="w-8 h-8 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center text-xs italic shadow-sm hover:scale-105 transition-all font-serif" title="Italic"
                             >
                                I
                             </button>
                             <button 
                                type="button"
                                onClick={() => {
                                   const start = '# ';
                                   const msg = globalSettings.global_update_message;
                                   setGlobalSettings({...globalSettings, global_update_message: msg + "\n" + start + (lang === 'bn' ? 'বড় হেডলাইন' : 'Big Heading')});
                                }}
                                className="px-2 h-8 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center text-[10px] font-black shadow-sm hover:scale-105 transition-all" title="Large Text"
                             >
                                BIG
                             </button>
                             <button 
                                type="button"
                                onClick={() => {
                                   const msg = globalSettings.global_update_message;
                                   const template = (lang === 'bn' ? '[ইউটিউব ভিডিও দেখুন](https://www.youtube.com)' : '[Watch YouTube Video](https://www.youtube.com)');
                                   setGlobalSettings({...globalSettings, global_update_message: msg + (msg ? "\n" : "") + template});
                                }}
                                className="px-2.5 h-8 bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-1 text-[10px] font-black shadow-sm hover:scale-105 transition-all" title="Add YouTube Link"
                             >
                                <Youtube size={13} className="shrink-0" />
                                <span>YouTube</span>
                             </button>
                             <button 
                                type="button"
                                onClick={() => {
                                   const msg = globalSettings.global_update_message;
                                   const template = (lang === 'bn' ? '[লিংক ভিজিট করুন](https://example.com)' : '[Visit Link](https://example.com)');
                                   setGlobalSettings({...globalSettings, global_update_message: msg + (msg ? "\n" : "") + template});
                                }}
                                className="px-2 h-8 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-lg flex items-center gap-1 text-[10px] font-black shadow-sm hover:scale-105 transition-all" title="Add Web Link"
                             >
                                <Link2 size={13} className="shrink-0" />
                                <span>Link</span>
                             </button>
                          </div>
                       </div>
                       <textarea 
                          rows={6} 
                          className={`w-full rounded-2xl p-4 font-bold outline-none border resize-none text-xs leading-relaxed ${madrasah?.theme === 'dark' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-[#1E3A8A]'}`} 
                          value={globalSettings.global_update_message} 
                          onChange={(e) => setGlobalSettings({...globalSettings, global_update_message: e.target.value})}
                          placeholder={lang === 'bn' ? 'এখানে মেসেজ লিখুন। যেকোনো লিংক (যেমন YouTube লিংক) দিলে সরাসরি কাজ করবে...' : 'Write update message here. Any link (e.g. YouTube link) will be clickable...'}
                       />
                       <p className="text-[9px] font-bold text-slate-400 font-noto flex items-center gap-1.5 px-1">
                          <span>💡</span>
                          <span>{lang === 'bn' ? 'টেক্সট বক্সে যেকোনো লিংক বা YouTube ভিডিও লিংক পেস্ট করলে ইউজাররা ক্লিকে সরাসরি যেতে পারবে।' : 'Paste any web link or YouTube link and users can click to open it directly.'}</span>
                       </p>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase px-1 flex items-center gap-2">
                          <Type size={12} />
                          {lang === 'bn' ? 'লাইভ প্রিভিউ' : 'Live Preview'}
                       </label>
                       <div className={`p-5 rounded-2xl border text-[11px] min-h-[100px] leading-relaxed break-words font-noto overflow-hidden transition-all ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-900 shadow-inner'}`}>
                          <article className="font-noto font-black">
                             <ReactMarkdown
                                components={getMarkdownComponents(madrasah?.theme === 'dark')}
                             >
                                {(() => {
                                   const rawMsg = globalSettings.global_update_message || (lang === 'bn' ? '*মেসেজ লিখলে এখানে প্রিভিউ দেখা যাবে...*' : '*Write message to see preview...*');
                                   return linkifyMarkdown(rawMsg);
                                })()}
                             </ReactMarkdown>
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
                          <label className="text-[9px] font-black text-slate-400 uppercase px-1">bKash Number</label>
                          <input type="text" className={`w-full h-11 rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/50'}`} value={globalSettings.bkash_number} onChange={(e) => setGlobalSettings({...globalSettings, bkash_number: e.target.value})} placeholder="bKash Number" />
                       </div>
                        <div className="space-y-1">
                           <label className="text-[9px] font-black text-slate-400 uppercase px-1">Nagad Number</label>
                           <input type="text" className={`w-full h-11 rounded-xl px-4 font-black text-sm outline-none ${madrasah?.theme === 'dark' ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500/50' : 'bg-white border-slate-100 text-[#1E3A8A] focus:border-[#2563EB]/50'}`} value={globalSettings.nagad_number} onChange={(e) => setGlobalSettings({...globalSettings, nagad_number: e.target.value})} placeholder="Nagad Number" />
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
