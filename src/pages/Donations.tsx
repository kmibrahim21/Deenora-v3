import React, { useState, useEffect, useMemo } from 'react';
import {
  Heart,
  Plus,
  Receipt,
  User,
  Users,
  Search,
  Printer,
  Trash2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  PieChart,
  UserPlus,
  Phone,
  PhoneCall,
  MapPin,
  Clock,
  RefreshCw,
  Filter,
  Check,
  CalendarDays,
  FileText,
  DollarSign,
  AlertCircle,
  Edit2,
  Mic,
  Volume2,
  Radio,
  UserCheck,
  Play,
  Square,
} from 'lucide-react';
import { Institution, Language, Profile, UserRole, Donation, Donor } from 'types';
import { supabase, smsApi } from 'supabase';
import { requestManager } from 'services/RequestManager';
import { CacheService } from 'services/cacheService';
import { numberToBanglaWords, toBanglaDigits } from 'utils/numberToBanglaWords';
import { DonationReceiptModal } from 'components/donation/DonationReceiptModal';
import { DonorProfileModal } from 'components/donation/DonorProfileModal';

interface DonationsProps {
  lang: Language;
  madrasah: Institution | null;
  role: UserRole;
  profile: Profile | null;
  onBack: () => void;
  triggerRefresh?: () => void;
  activeYear?: any;
}

export const fundCategories = [
  { id: 'general', nameBn: 'সাধারণ অনুদান', nameEn: 'General Donation', color: 'bg-blue-500' },
  { id: 'zakat', nameBn: 'যাকাত ও ফিতরা ফান্ড', nameEn: 'Zakat & Fitra Fund', color: 'bg-emerald-500' },
  { id: 'lillah', nameBn: 'লিল্লাহ বোর্ডিং ও এতিম তহবিল', nameEn: 'Lillah Boarding & Orphan Fund', color: 'bg-purple-500' },
  { id: 'development', nameBn: 'ভবন ও মাদরাসা উন্নয়ন তহবিল', nameEn: 'Building & Development Fund', color: 'bg-amber-500' },
  { id: 'orphan', nameBn: 'এতিম ও দুঃস্থ সহায়তা', nameEn: 'Orphan & Poor Support', color: 'bg-rose-500' },
  { id: 'ramadan', nameBn: 'রমযান ইফতার ও খাদ্য তহবিল', nameEn: 'Ramadan Iftar & Food Fund', color: 'bg-teal-500' },
  { id: 'sadaqah', nameBn: 'সদকায়ে জারিয়া', nameEn: 'Sadaqah Jariyah', color: 'bg-indigo-500' },
  { id: 'mosque', nameBn: 'মসজিদ ফান্ড', nameEn: 'Mosque Fund', color: 'bg-cyan-500' },
  { id: 'other', nameBn: 'অন্যান্য দান', nameEn: 'Other Donation', color: 'bg-slate-500' },
];

export const paymentMethods = [
  { id: 'cash', nameBn: 'নগদ / ক্যাশ', nameEn: 'Cash' },
  { id: 'bkash', nameBn: 'বিকাশ (bKash)', nameEn: 'bKash' },
  { id: 'nagad', nameBn: 'নগদ (Nagad)', nameEn: 'Nagad' },
  { id: 'rocket', nameBn: 'রকেট (Rocket)', nameEn: 'Rocket' },
  { id: 'bank', nameBn: 'ব্যাংক হিসাব', nameEn: 'Bank' },
  { id: 'other', nameBn: 'অন্যান্য', nameEn: 'Other' },
];

const Donations: React.FC<DonationsProps> = ({
  lang,
  madrasah,
  role,
  profile,
  onBack,
  triggerRefresh,
  activeYear,
}) => {
  const isDark = madrasah?.theme === 'dark';
  const isAdmin = role === 'madrasah_admin' || role === 'super_admin';

  // Active Tab: Entry, Management (History + Donors), Reports
  const [activeTab, setActiveTab] = useState<'entry' | 'management' | 'reports'>('entry');
  const [mgmtSubTab, setMgmtSubTab] = useState<'history' | 'donors'>('history');

  // Core Data
  const [donations, setDonations] = useState<Donation[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // New Donation Form States
  const [donorName, setDonorName] = useState<string>('');
  const [donorPhone, setDonorPhone] = useState<string>('');
  const [donorAddress, setDonorAddress] = useState<string>('');
  const [fundCategory, setFundCategory] = useState<string>('general');
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [donationDate, setDonationDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [prayerRequest, setPrayerRequest] = useState<string>('');
  const [isMonthlyDonor, setIsMonthlyDonor] = useState<boolean>(false);
  const [sendSms, setSendSms] = useState<boolean>(true);
  const [selectedDonorId, setSelectedDonorId] = useState<string | null>(null);

  // Search & Filters for Donations List
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterFund, setFilterFund] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterDateRange, setFilterDateRange] = useState<'all' | 'today' | 'this_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Donor Filter inside unified Donors tab
  const [donorFilterType, setDonorFilterType] = useState<'all' | 'monthly' | 'general' | 'permanent'>('all');

  // Modals & Selected items
  const [selectedDonationForReceipt, setSelectedDonationForReceipt] = useState<Donation | null>(null);
  const [selectedDonorForProfile, setSelectedDonorForProfile] = useState<Donor | null>(null);
  const [showNewDonorModal, setShowNewDonorModal] = useState<boolean>(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  const [showDonorSuggestions, setShowDonorSuggestions] = useState<boolean>(false);

  // Group Voice Call Modal & Voice Broadcast states
  const [showGroupVoiceModal, setShowGroupVoiceModal] = useState<boolean>(false);
  const [voiceCallMode, setVoiceCallMode] = useState<'broadcast' | 'direct'>('broadcast');
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [voiceTargetGroup, setVoiceTargetGroup] = useState<'all' | 'monthly' | 'unpaid_monthly' | 'general' | 'selected'>('all');
  const [selectedVoiceDonorIds, setSelectedVoiceDonorIds] = useState<string[]>([]);
  const [voiceTemplates, setVoiceTemplates] = useState<any[]>([]);
  const [selectedVoiceTemplateId, setSelectedVoiceTemplateId] = useState<string>('');
  const [sendingVoiceBroadcast, setSendingVoiceBroadcast] = useState<boolean>(false);

  // New/Edit Donor Modal fields
  const [newDonorName, setNewDonorName] = useState<string>('');
  const [newDonorPhone, setNewDonorPhone] = useState<string>('');
  const [newDonorEmail, setNewDonorEmail] = useState<string>('');
  const [newDonorAddress, setNewDonorAddress] = useState<string>('');
  const [newDonorType, setNewDonorType] = useState<'general' | 'monthly' | 'permanent' | 'corporate'>('general');
  const [newDonorPledge, setNewDonorPledge] = useState<string>('');
  const [newDonorNotes, setNewDonorNotes] = useState<string>('');

  // Toast
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
    show: false,
    message: '',
    type: 'success',
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, show: false }));
    }, 4000);
  };

  // Generate Receipt Number
  const generateReceiptNumber = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `DON-${year}${random}`;
  };

  const [receiptNo, setReceiptNo] = useState<string>(generateReceiptNumber());

  // Load Data
  useEffect(() => {
    if (!madrasah?.id) return;
    loadData();
  }, [madrasah?.id]);

  const loadData = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    try {
      // 1. Fetch Donors
      let fetchedDonors: Donor[] = [];
      try {
        const { data: donorData, error: donorErr } = await supabase
          .from('sponsors')
          .select('*')
          .eq('institution_id', madrasah.id)
          .order('name', { ascending: true });

        if (!donorErr && donorData) {
          fetchedDonors = donorData.map((d: any) => ({
            id: d.id,
            institution_id: d.institution_id,
            name: d.name,
            phone: d.phone === 'N/A' ? '' : d.phone,
            email: d.email,
            address: d.address,
            donor_type: (d.donor_type as any) || 'general',
            monthly_pledge_amount: d.monthly_pledge_amount,
            notes: d.notes,
            status: 'active',
            created_at: d.created_at,
          }));
        }
      } catch (e) {
        console.warn('Sponsors table read fallback:', e);
      }

      // Check local storage fallback for offline/persisted donors
      const localDonors = localStorage.getItem(`donors_${madrasah.id}`);
      if (localDonors) {
        try {
          const parsed = JSON.parse(localDonors);
          const map = new Map<string, Donor>();
          fetchedDonors.forEach((d) => map.set(d.id, d));
          parsed.forEach((d: Donor) => map.set(d.id, d));
          fetchedDonors = Array.from(map.values());
        } catch (e) {}
      }
      setDonors(fetchedDonors);

      // 2. Fetch Donations
      let fetchedDonations: Donation[] = [];
      try {
        const { data: donationData, error: donationErr } = await supabase
          .from('donations')
          .select('*')
          .eq('institution_id', madrasah.id)
          .order('donation_date', { ascending: false });

        if (!donationErr && donationData) {
          fetchedDonations = donationData;
        } else {
          // Fallback to ledger parsing if table not found or empty
          console.warn('Donations table empty or error, falling back to ledger');
          const { data: ledgerData } = await supabase
            .from('ledger')
            .select('*')
            .eq('institution_id', madrasah.id)
            .like('description', '%[DONATION%')
            .order('transaction_date', { ascending: false });

          if (ledgerData) {
            ledgerData.forEach((item: any) => {
              let parsedInfo: any = {};
              try {
                const metaMatch = item.description.match(/\{.*?\}/);
                if (metaMatch) parsedInfo = JSON.parse(metaMatch[0]);
              } catch (e) {}

              fetchedDonations.push({
                id: parsedInfo.donation_id || `ledger-${item.id}`,
                institution_id: item.institution_id,
                donor_id: parsedInfo.donor_id,
                donor_name: parsedInfo.donor_name || item.description.split('-')[1]?.trim() || 'Anonymous',
                donor_phone: parsedInfo.donor_phone,
                donor_address: parsedInfo.donor_address,
                amount: item.amount,
                fund_category: parsedInfo.fund_category || 'general',
                payment_method: item.payment_method || 'cash',
                donation_date: item.transaction_date,
                receipt_no: parsedInfo.receipt_no || `L-${item.id.slice(0, 6)}`,
                prayer_request: parsedInfo.prayer_request,
                ledger_id: item.id,
                created_at: item.created_at,
              });
            });
          }
        }
      } catch (e) {
        console.warn('Donations query error:', e);
      }

      // Check local storage fallback for offline/immediate updates
      const localDonations = localStorage.getItem(`donations_${madrasah.id}`);
      if (localDonations) {
        try {
          const parsed = JSON.parse(localDonations);
          const map = new Map<string, Donation>();
          fetchedDonations.forEach((d) => map.set(d.id, d));
          parsed.forEach((d: Donation) => map.set(d.id, d));
          fetchedDonations = Array.from(map.values());
        } catch (e) {}
      }

      // Sort newest first
      fetchedDonations.sort((a, b) => {
        const dateA = new Date(a.donation_date || a.created_at || 0).getTime();
        const dateB = new Date(b.donation_date || b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setDonations(fetchedDonations);
    } catch (err) {
      console.error('Error loading donations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filtered Donors for Auto-suggest
  const filteredDonorSuggestions = useMemo(() => {
    if (!donorName.trim()) return [];
    return donors.filter(
      (d) =>
        d.name.toLowerCase().includes(donorName.toLowerCase()) ||
        (d.phone && d.phone.includes(donorName))
    );
  }, [donors, donorName]);

  const selectDonor = (donor: Donor) => {
    setSelectedDonorId(donor.id);
    setDonorName(donor.name);
    setDonorPhone(donor.phone || '');
    setDonorAddress(donor.address || '');
    if (donor.donor_type === 'monthly') {
      setIsMonthlyDonor(true);
      if (donor.monthly_pledge_amount) {
        setAmount(String(donor.monthly_pledge_amount));
      }
    } else {
      setIsMonthlyDonor(false);
      setAmount('');
    }
    setShowDonorSuggestions(false);
  };

  // Submit Donation
  const handleSubmitDonation = async (printAfterSave: boolean = false) => {
    if (!donorName.trim()) {
      showToast(lang === 'bn' ? 'অনুগ্রহ করে দাতার নাম লিখুন' : 'Please enter donor name', 'error');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount) || numAmount <= 0) {
      showToast(lang === 'bn' ? 'সঠিক টাকার পরিমাণ দিন' : 'Please enter a valid amount', 'error');
      return;
    }
    if (!madrasah?.id) return;

    setSaving(true);
    try {
      const donationId = crypto.randomUUID();
      let ledgerId: string | undefined = undefined;

      // 1. Sync to main accounting ledger - ALWAYS ENABLED (Automated)
      try {
        let yearIdToUse: string | null = activeYear?.id || null;
        if (!yearIdToUse && madrasah?.config_json) {
          let config = madrasah.config_json as any;
          if (typeof config === 'string') {
            try { config = JSON.parse(config); } catch (e) {}
          }
          if (config?.active_academic_year_id) {
            yearIdToUse = config.active_academic_year_id;
          }
        }

        const fundNameObj = fundCategories.find((f) => f.id === fundCategory);
        const fundLabel = fundNameObj ? fundNameObj.nameBn : fundCategory;
        const metaJson = JSON.stringify({
          donation_id: donationId,
          receipt_no: receiptNo,
          donor_id: selectedDonorId,
          donor_name: donorName.trim(),
          donor_phone: donorPhone.trim(),
          donor_address: donorAddress.trim(),
          fund_category: fundCategory,
          payment_method: paymentMethod,
          collected_by: profile?.full_name || 'Admin',
          prayer_request: prayerRequest.trim(),
        });

        const ledgerPayload: any = {
          institution_id: madrasah.id,
          type: 'income',
          category: 'donation',
          amount: numAmount,
          description: `[DONATION:${receiptNo}] ${donorName.trim()} - ${fundLabel} ${metaJson}`,
          transaction_date: donationDate || new Date().toISOString().split('T')[0],
        };

        if (yearIdToUse) {
          ledgerPayload.academic_year_id = yearIdToUse;
        }

        const { data: ledgerRes, error: ledgerErr } = await supabase
          .from('ledger')
          .insert(ledgerPayload)
          .select('id')
          .single();

        if (ledgerErr) {
          console.error('Ledger insert error:', ledgerErr);
        } else if (ledgerRes) {
          ledgerId = ledgerRes.id;
        }
      } catch (err) {
        console.warn('Ledger sync warning:', err);
      }

      // 2. Save or update Donor in database
      let finalDonorId = selectedDonorId;
      if (!finalDonorId) {
        const newId = crypto.randomUUID();
        const donorRecord: Donor = {
          id: newId,
          institution_id: madrasah.id,
          name: donorName.trim(),
          phone: donorPhone.trim(),
          address: donorAddress.trim(),
          donor_type: isMonthlyDonor ? 'monthly' : 'general',
          status: 'active',
          created_at: new Date().toISOString(),
        };

        const { error: sponsorErr } = await supabase.from('sponsors').insert({
          id: newId,
          institution_id: madrasah.id,
          name: donorName.trim(),
          phone: donorPhone.trim() || 'N/A',
          address: donorAddress.trim() || null,
          donor_type: isMonthlyDonor ? 'monthly' : 'general',
        });
        
        if (sponsorErr) {
          console.warn('Sponsors table insert failed, using local only', sponsorErr);
        }

        const updatedDonors = [donorRecord, ...donors];
        setDonors(updatedDonors);
        localStorage.setItem(`donors_${madrasah.id}`, JSON.stringify(updatedDonors));
        finalDonorId = newId;
      }

      // 3. Create Donation record in database
      const donationPayload: any = {
        id: donationId,
        institution_id: madrasah.id,
        donor_id: finalDonorId || null,
        donor_name: donorName.trim(),
        donor_phone: donorPhone.trim() || null,
        donor_address: donorAddress.trim() || null,
        amount: numAmount,
        fund_category: fundCategory,
        payment_method: paymentMethod,
        donation_date: donationDate,
        receipt_no: receiptNo,
        prayer_request: prayerRequest.trim() || null,
        is_monthly_pledge: isMonthlyDonor,
        ledger_id: ledgerId,
        collected_by: profile?.full_name || 'Admin'
      };

      const { error: donationErr } = await supabase.from('donations').insert(donationPayload);
      if (donationErr) {
        console.warn('Donations table insert failed, using local only', donationErr);
      }

      const newDonation: Donation = {
        ...donationPayload,
        created_at: new Date().toISOString(),
      };

      const updatedDonations = [newDonation, ...donations];
      setDonations(updatedDonations);
      localStorage.setItem(`donations_${madrasah.id}`, JSON.stringify(updatedDonations));

      // 4. Send SMS if enabled and mobile provided
      if (sendSms && donorPhone.trim() && donorPhone.length >= 11) {
        try {
          const madrasahName = madrasah.name || 'মাদরাসা';
          const fundNameObj = fundCategories.find((f) => f.id === fundCategory);
          const fundNameStr = fundNameObj ? fundNameObj.nameBn : 'তহবিল';

          // Check custom donation collection SMS template from config_json
          const templates = (madrasah?.config_json as any)?.features?.sms_templates || {};
          const customTemplate = templates.donation_collection;

          let smsText = '';
          if (customTemplate && typeof customTemplate === 'string' && customTemplate.trim()) {
            smsText = customTemplate
              .replace(/\{donor_name\}/g, donorName.trim())
              .replace(/\{amount\}/g, String(numAmount))
              .replace(/\{paid_amount\}/g, String(numAmount))
              .replace(/\{receipt_no\}/g, String(receiptNo))
              .replace(/\{fund_name\}/g, fundNameStr)
              .replace(/\{institution_name\}/g, madrasahName)
              .replace(/\{date\}/g, donationDate || new Date().toISOString().split('T')[0]);
          } else {
            // Short, concise default SMS
            smsText = `${madrasahName}: ৳${numAmount} টাকা অনুদান জমা হয়েছে। রসিদ #${receiptNo}। জাজাকাল্লাহু খাইরান।`;
          }

          smsApi.sendDirect(donorPhone.trim(), smsText, madrasah.id).catch((e) => {
            console.warn('SMS send failed:', e);
          });
        } catch (e) {
          console.warn('SMS trigger error:', e);
        }
      }

      showToast(lang === 'bn' ? 'অনুদান সফলভাবে জমা হয়েছে!' : 'Donation recorded successfully!');

      // Reset form
      setDonorName('');
      setDonorPhone('');
      setDonorAddress('');
      setAmount('');
      setPrayerRequest('');
      setSelectedDonorId(null);
      setIsMonthlyDonor(false);
      const nextReceipt = generateReceiptNumber();
      setReceiptNo(nextReceipt);

      // Open print receipt modal if requested
      if (printAfterSave) {
        setSelectedDonationForReceipt(newDonation);
      }

      if (triggerRefresh) {
        setTimeout(async () => {
          await CacheService.clearCache('fees', madrasah.id);
          await requestManager.invalidatePattern(`ledger:${madrasah.id}`);
          triggerRefresh();
        }, 500);
      }
    } catch (err: any) {
      console.error('Error submitting donation:', err);
      showToast(lang === 'bn' ? 'সংরক্ষণ করতে সমস্যা হয়েছে' : 'Failed to save donation', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Load Voice Templates
  useEffect(() => {
    if (madrasah?.id) {
      fetchVoiceTemplates();
    }
  }, [madrasah?.id]);

  const fetchVoiceTemplates = async () => {
    if (!madrasah?.id) return;
    try {
      const { data, error } = await supabase
        .from('voice_templates')
        .select('*')
        .eq('institution_id', madrasah.id)
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        setVoiceTemplates(data);
        if (!selectedVoiceTemplateId) {
          setSelectedVoiceTemplateId(data[0].id);
        }
      } else {
        setVoiceTemplates([]);
      }
    } catch (e) {
      console.warn('Voice templates load error:', e);
    }
  };

  // Open Modal for Add Donor
  const handleOpenAddDonorModal = () => {
    setEditingDonor(null);
    setNewDonorName('');
    setNewDonorPhone('');
    setNewDonorEmail('');
    setNewDonorAddress('');
    setNewDonorType('general');
    setNewDonorPledge('');
    setNewDonorNotes('');
    setShowNewDonorModal(true);
  };

  // Open Modal for Edit Donor
  const handleOpenEditDonorModal = (donor: Donor) => {
    setEditingDonor(donor);
    setNewDonorName(donor.name || '');
    setNewDonorPhone(donor.phone || '');
    setNewDonorEmail(donor.email || '');
    setNewDonorAddress(donor.address || '');
    setNewDonorType((donor.donor_type as any) || 'general');
    setNewDonorPledge(donor.monthly_pledge_amount ? String(donor.monthly_pledge_amount) : '');
    setNewDonorNotes(donor.notes || '');
    setShowNewDonorModal(true);
  };

  // Create or Update Donor
  const handleSaveDonor = async () => {
    if (!newDonorName.trim()) {
      showToast(lang === 'bn' ? 'দাতার নাম দিন' : 'Please provide donor name', 'error');
      return;
    }
    if (!madrasah?.id) return;

    try {
      if (editingDonor) {
        // Update Existing Donor
        const updatedDonorRecord: Donor = {
          ...editingDonor,
          name: newDonorName.trim(),
          phone: newDonorPhone.trim(),
          email: newDonorEmail.trim(),
          address: newDonorAddress.trim(),
          donor_type: newDonorType,
          monthly_pledge_amount: newDonorPledge ? parseFloat(newDonorPledge) : undefined,
          notes: newDonorNotes.trim(),
        };

        const { error: updateErr } = await supabase
          .from('sponsors')
          .update({
            name: newDonorName.trim(),
            phone: newDonorPhone.trim() || 'N/A',
            email: newDonorEmail.trim() || null,
            address: newDonorAddress.trim() || null,
            donor_type: newDonorType,
            monthly_pledge_amount: newDonorPledge ? parseFloat(newDonorPledge) : null,
            notes: newDonorNotes.trim() || null,
          })
          .eq('id', editingDonor.id);

        if (updateErr) {
          console.warn('Sponsors table update warning:', updateErr);
        }

        const updated = donors.map((d) => (d.id === editingDonor.id ? updatedDonorRecord : d));
        setDonors(updated);
        localStorage.setItem(`donors_${madrasah.id}`, JSON.stringify(updated));

        if (selectedDonorForProfile?.id === editingDonor.id) {
          setSelectedDonorForProfile(updatedDonorRecord);
        }

        showToast(lang === 'bn' ? 'দাতার তথ্য আপডেট হয়েছে!' : 'Donor profile updated successfully!');
      } else {
        // Create New Donor
        const newId = crypto.randomUUID();
        const donorRecord: Donor = {
          id: newId,
          institution_id: madrasah.id,
          name: newDonorName.trim(),
          phone: newDonorPhone.trim(),
          email: newDonorEmail.trim(),
          address: newDonorAddress.trim(),
          donor_type: newDonorType,
          monthly_pledge_amount: newDonorPledge ? parseFloat(newDonorPledge) : undefined,
          notes: newDonorNotes.trim(),
          status: 'active',
          created_at: new Date().toISOString(),
        };

        const { error: sponsorErr } = await supabase.from('sponsors').insert({
          id: newId,
          institution_id: madrasah.id,
          name: newDonorName.trim(),
          phone: newDonorPhone.trim() || 'N/A',
          email: newDonorEmail.trim() || null,
          address: newDonorAddress.trim() || null,
          donor_type: newDonorType,
          monthly_pledge_amount: newDonorPledge ? parseFloat(newDonorPledge) : null,
          notes: newDonorNotes.trim() || null,
        });

        if (sponsorErr) {
          console.warn('Sponsors table insert warning:', sponsorErr);
        }

        const updated = [donorRecord, ...donors];
        setDonors(updated);
        localStorage.setItem(`donors_${madrasah.id}`, JSON.stringify(updated));

        showToast(lang === 'bn' ? 'নতুন দাতা সফলভাবে যুক্ত হয়েছে!' : 'Donor added successfully!');
      }

      setShowNewDonorModal(false);
      setEditingDonor(null);

      // Reset Form
      setNewDonorName('');
      setNewDonorPhone('');
      setNewDonorEmail('');
      setNewDonorAddress('');
      setNewDonorPledge('');
      setNewDonorNotes('');
    } catch (e) {
      console.error('Error saving donor:', e);
      showToast(lang === 'bn' ? 'দাতা তথ্য সংরক্ষণ করা যায়নি' : 'Failed to save donor', 'error');
    }
  };

  // Delete Donor
  const handleDeleteDonor = async (donor: Donor) => {
    if (
      !confirm(
        lang === 'bn'
          ? `আপনি কি নিশ্চিত যে দাতা "${donor.name}" এর তথ্য সম্পূর্ণ মুছে ফেলতে চান?`
          : `Are you sure you want to delete donor "${donor.name}"?`
      )
    ) {
      return;
    }
    if (!madrasah?.id) return;

    try {
      const { error } = await supabase.from('sponsors').delete().eq('id', donor.id);
      if (error) {
        console.warn('Sponsors delete warning:', error);
      }

      const updated = donors.filter((d) => d.id !== donor.id);
      setDonors(updated);
      localStorage.setItem(`donors_${madrasah.id}`, JSON.stringify(updated));

      if (selectedDonorForProfile?.id === donor.id) {
        setSelectedDonorForProfile(null);
      }

      showToast(lang === 'bn' ? 'দাতা মুছে ফেলা হয়েছে' : 'Donor deleted successfully');
    } catch (e) {
      console.error('Error deleting donor:', e);
      showToast(lang === 'bn' ? 'দাতা মুছে ফেলা সম্ভব হয়নি' : 'Failed to delete donor', 'error');
    }
  };

  // Toggle audio preview play/pause
  const handleToggleAudioPreview = (fileUrl?: string) => {
    if (!fileUrl) return;
    if (isPlayingPreview && previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    } else {
      if (previewAudio) previewAudio.pause();
      const audio = new Audio(fileUrl);
      audio.play().then(() => setIsPlayingPreview(true)).catch(() => setIsPlayingPreview(false));
      audio.onended = () => setIsPlayingPreview(false);
      setPreviewAudio(audio);
    }
  };

  // Open Voice Call Modal
  const handleOpenGroupVoiceCallModal = (targetDonors?: Donor[]) => {
    if (previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    }
    if (targetDonors && targetDonors.length > 0) {
      setVoiceTargetGroup('selected');
      setSelectedVoiceDonorIds(targetDonors.map((d) => d.id));
    } else {
      setVoiceTargetGroup('all');
      setSelectedVoiceDonorIds([]);
    }
    setShowGroupVoiceModal(true);
  };

  // Compute exact target donor count
  const computedTargetCount = useMemo(() => {
    const thisMonthStr = new Date().toISOString().slice(0, 7);
    if (voiceTargetGroup === 'selected') {
      return selectedVoiceDonorIds.length;
    } else if (voiceTargetGroup === 'monthly') {
      return donors.filter((d) => d.donor_type === 'monthly').length;
    } else if (voiceTargetGroup === 'unpaid_monthly') {
      return donors.filter((d) => {
        if (d.donor_type !== 'monthly') return false;
        const paidThisMonth = donations.some(
          (dn) =>
            ((dn.donor_id && dn.donor_id === d.id) || (d.phone && dn.donor_phone === d.phone)) &&
            (dn.donation_date || dn.created_at || '').startsWith(thisMonthStr)
        );
        return !paidThisMonth;
      }).length;
    } else if (voiceTargetGroup === 'general') {
      return donors.filter((d) => d.donor_type !== 'monthly' && d.donor_type !== 'permanent').length;
    }
    return donors.length;
  }, [voiceTargetGroup, selectedVoiceDonorIds, donors, donations]);

  // Send Group Voice Call Broadcast
  const handleSendGroupVoiceBroadcast = async () => {
    alert(lang === 'bn' ? 'ভয়েস কল ব্রডকাস্ট বাটন টি অফ করে রাখা হয়েছে। পরবর্তীতে নির্দেশ দিলে আবার চালু করা হবে।' : 'Voice call broadcast is disabled.');
    return;

    // Filter Donors according to target group selection
    let targetDonorsList: Donor[] = [];
    const thisMonthStr = new Date().toISOString().slice(0, 7);

    if (voiceTargetGroup === 'selected') {
      targetDonorsList = donors.filter((d) => selectedVoiceDonorIds.includes(d.id));
    } else if (voiceTargetGroup === 'monthly') {
      targetDonorsList = donors.filter((d) => d.donor_type === 'monthly');
    } else if (voiceTargetGroup === 'unpaid_monthly') {
      targetDonorsList = donors.filter((d) => {
        if (d.donor_type !== 'monthly') return false;
        const paidThisMonth = donations.some(
          (dn) =>
            ((dn.donor_id && dn.donor_id === d.id) || (d.phone && dn.donor_phone === d.phone)) &&
            (dn.donation_date || dn.created_at || '').startsWith(thisMonthStr)
        );
        return !paidThisMonth;
      });
    } else if (voiceTargetGroup === 'general') {
      targetDonorsList = donors.filter((d) => d.donor_type !== 'monthly' && d.donor_type !== 'permanent');
    } else {
      targetDonorsList = donors;
    }

    // Extract valid phone numbers
    const validPhones = targetDonorsList
      .map((d) => d.phone?.trim())
      .filter((p): p is string => !!p && p.replace(/\D/g, '').length >= 10);

    if (validPhones.length === 0) {
      showToast(
        lang === 'bn'
          ? 'নির্বাচিত গ্রুপে কোনো সঠিক মোবাইল নম্বর পাওয়া যায়নি'
          : 'No valid phone numbers found in selected group',
        'error'
      );
      return;
    }

    setSendingVoiceBroadcast(true);
    try {
      // Normalize numbers to 11-digit Bangladesh standard starting with 01
      const phoneNumbers = [...new Set(
        validPhones.map((p) => {
          let digits = p.replace(/\D/g, '');
          if (digits.length === 13 && digits.startsWith('8801')) {
            digits = digits.substring(2);
          } else if (digits.length === 10 && digits.startsWith('1')) {
            digits = '0' + digits;
          }
          return digits;
        }).filter((p) => p.length === 11 && p.startsWith('01'))
      )];

      if (phoneNumbers.length === 0) {
        showToast(
          lang === 'bn'
            ? 'দাতাদের মধ্যে কোনো সঠিক ১১ ডিজিটের মোবাইল নম্বর পাওয়া যায়নি'
            : 'No valid 11-digit mobile numbers found for selected donors',
          'error'
        );
        setSendingVoiceBroadcast(false);
        return;
      }

      const selectedVoice = voiceTemplates.find((v) => v.id === selectedVoiceTemplateId) || voiceTemplates[0];
      const voiceName = selectedVoice
        ? selectedVoice.provider_voice_name || selectedVoice.title || selectedVoice.name || selectedVoice.id
        : 'Donation Announcement';

      let senderNum = (madrasah.voice_sender_id || '01700000000').toString().replace(/\D/g, '');
      if (senderNum.length === 13 && senderNum.startsWith('8801')) senderNum = senderNum.substring(2);
      if (senderNum.length === 10 && senderNum.startsWith('1')) senderNum = '0' + senderNum;

      const requestId = crypto.randomUUID();
      const payload = {
        request_id: requestId,
        voice: voiceName,
        voice_id: selectedVoice?.id,
        voice_template_id: selectedVoice?.id,
        file_url: selectedVoice?.file_url,
        voices: selectedVoice?.file_url ? [selectedVoice.file_url] : undefined,
        sender: senderNum,
        phone_numbers: phoneNumbers,
        retry: 1,
      };

      let campaignId = requestId;

      try {
        const response = await fetch('/api/awaj/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          const result = await response.json();
          campaignId = result.broadcast?.id || result.campaign_id || result.id || requestId;
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.warn('Awaj API notice:', errorData);
        }
      } catch (apiErr) {
        console.warn('Awaj API call exception:', apiErr);
      }

      // Record in Supabase
      try {
        await supabase.from('voice_broadcasts').insert({
          institution_id: madrasah.id,
          voice_template_id: selectedVoice?.id && !selectedVoice.id.startsWith('vt_assigned_') ? selectedVoice.id : null,
          target_type: 'donors',
          target_class_name: `Donors (${voiceTargetGroup})`,
          total_numbers: phoneNumbers.length,
          status: 'sending',
          provider_campaign_id: campaignId,
        });
      } catch (e) {
        console.warn('Voice broadcast insert warning:', e);
      }

      showToast(
        lang === 'bn'
          ? `সফলভাবে ${phoneNumbers.length} জন দাতাকে ভয়েস কল পাঠানো শুরু হয়েছে!`
          : `Voice broadcast started for ${phoneNumbers.length} donors!`
      );
      setShowGroupVoiceModal(false);
    } catch (err: any) {
      console.error('Error sending voice call broadcast:', err);
      showToast(
        lang === 'bn'
          ? `ভয়েস কল ব্রডকাস্ট পাঠানোর সময় সমস্যা হয়েছে: ${err.message || ''}`
          : `Failed to send voice call broadcast: ${err.message || ''}`,
        'error'
      );
    } finally {
      setSendingVoiceBroadcast(false);
    }
  };

  // Delete donation
  const handleDeleteDonation = async (donation: Donation) => {
    if (!isAdmin) {
      showToast(lang === 'bn' ? 'আপনার ডিলিট করার অনুমতি নেই' : 'Permission denied', 'error');
      return;
    }
    if (
      !confirm(
        lang === 'bn'
          ? `আপনি কি নিশ্চিত যে #${donation.receipt_no} নম্বরের ৳${donation.amount} টাকার অনুদান রসিদটি ডিলিট করতে চান?`
          : `Are you sure you want to delete receipt #${donation.receipt_no}?`
      )
    ) {
      return;
    }

    try {
      if (donation.ledger_id) {
        try {
          await supabase.from('ledger').delete().eq('id', donation.ledger_id);
        } catch (e) {}
      }

      const updated = donations.filter((d) => d.id !== donation.id);
      setDonations(updated);
      localStorage.setItem(`donations_${madrasah?.id}`, JSON.stringify(updated));

      showToast(lang === 'bn' ? 'অনুদান রেকর্ড ডিলিট করা হয়েছে' : 'Donation deleted');
      if (triggerRefresh) triggerRefresh();
    } catch (e) {
      showToast(lang === 'bn' ? 'ডিলিট করা যায়নি' : 'Failed to delete', 'error');
    }
  };

  // Analytics & Summary Calculations
  const stats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonthStr = new Date().toISOString().slice(0, 7);

    let totalAmount = 0;
    let todayAmount = 0;
    let thisMonthAmount = 0;
    let totalReceipts = donations.length;
    const fundTotals: Record<string, number> = {};

    donations.forEach((d) => {
      const amt = Number(d.amount) || 0;
      totalAmount += amt;

      const dateStr = d.donation_date || d.created_at?.slice(0, 10) || '';
      if (dateStr === todayStr) {
        todayAmount += amt;
      }
      if (dateStr.startsWith(thisMonthStr)) {
        thisMonthAmount += amt;
      }

      fundTotals[d.fund_category] = (fundTotals[d.fund_category] || 0) + amt;
    });

    const monthlyDonorsCount = donors.filter((d) => d.donor_type === 'monthly').length;
    const generalDonorsCount = donors.filter((d) => d.donor_type !== 'monthly' && d.donor_type !== 'permanent').length;
    const permanentDonorsCount = donors.filter((d) => d.donor_type === 'permanent').length;

    return {
      totalAmount,
      todayAmount,
      thisMonthAmount,
      totalReceipts,
      totalDonors: donors.length,
      monthlyDonorsCount,
      generalDonorsCount,
      permanentDonorsCount,
      fundTotals,
    };
  }, [donations, donors]);

  // Filtered Donations
  const filteredDonations = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const thisMonthStr = new Date().toISOString().slice(0, 7);

    return donations.filter((d) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = d.donor_name.toLowerCase().includes(q);
        const matchPhone = d.donor_phone?.includes(q);
        const matchReceipt = d.receipt_no.toLowerCase().includes(q);
        const matchNote = d.prayer_request?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchReceipt && !matchNote) return false;
      }

      // Fund
      if (filterFund !== 'all' && d.fund_category !== filterFund) {
        return false;
      }

      // Payment
      if (filterPayment !== 'all' && d.payment_method !== filterPayment) {
        return false;
      }

      // Date
      const dateStr = d.donation_date || d.created_at?.slice(0, 10) || '';
      if (filterDateRange === 'today' && dateStr !== todayStr) return false;
      if (filterDateRange === 'this_month' && !dateStr.startsWith(thisMonthStr)) return false;
      if (filterDateRange === 'custom') {
        if (customStartDate && dateStr < customStartDate) return false;
        if (customEndDate && dateStr > customEndDate) return false;
      }

      return true;
    });
  }, [
    donations,
    searchQuery,
    filterFund,
    filterPayment,
    filterDateRange,
    customStartDate,
    customEndDate,
  ]);

  const filteredTotal = useMemo(() => {
    return filteredDonations.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [filteredDonations]);

  // Filtered Donors in Unified Tab
  const filteredDonorsList = useMemo(() => {
    return donors.filter((donor) => {
      // Type Filter
      if (donorFilterType === 'monthly' && donor.donor_type !== 'monthly') return false;
      if (donorFilterType === 'general' && donor.donor_type === 'monthly') return false;
      if (donorFilterType === 'permanent' && donor.donor_type !== 'permanent') return false;

      // Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = donor.name.toLowerCase().includes(q);
        const matchPhone = donor.phone?.includes(q);
        const matchAddress = donor.address?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchAddress) return false;
      }

      return true;
    });
  }, [donors, donorFilterType, searchQuery]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-32">
      {/* Toast Notification */}
      {notification.show && (
        <div
          className={`fixed top-5 right-5 z-[99999] px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-white text-xs md:text-sm font-bold animate-in slide-in-from-top-5 duration-300 ${
            notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          <CheckCircle2 size={18} />
          <span>{notification.message}</span>
        </div>
      )}

      {/* Header matching standard App Design Language */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all shadow-sm shrink-0 ${
              isDark ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
            <div>
              <h1 className={`text-lg sm:text-xl font-black font-noto leading-tight ${isDark ? 'text-slate-100' : 'text-[#1E293B]'}`}>
                {lang === 'bn' ? 'দান ও অনুদান' : 'Donations & Funds'}
              </h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                <Heart size={12} className="text-rose-500 fill-rose-500/20" />
                <span>{lang === 'bn' ? 'তহবিল ও অনুদান ব্যবস্থাপনা' : 'Donation & Fund Management'}</span>
              </p>
            </div>

            <button
              onClick={() => setActiveTab('reports')}
              className={`px-3 py-1.5 rounded-xl shadow-sm flex items-center justify-center gap-1.5 active:scale-95 transition-all text-[10px] font-black uppercase tracking-wider border cursor-pointer ${
                activeTab === 'reports'
                  ? isDark
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    : 'bg-blue-50 text-[#2563EB] border-blue-100'
                  : isDark
                  ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <PieChart size={14} />
              <span>{lang === 'bn' ? 'তহবিল রিপোর্ট' : 'Fund Reports'}</span>
            </button>
          </div>
        </div>

        {/* Top Right Actions: Refresh */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => {
              loadData();
              showToast(lang === 'bn' ? 'তথ্য রিফ্রেশ হয়েছে' : 'Data refreshed');
            }}
            className={`w-10 h-10 rounded-2xl border flex items-center justify-center active:scale-95 transition-all shadow-sm ${
              isDark
                ? 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700'
            } ${loading ? 'animate-spin' : ''}`}
            title={lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Overview Stat Cards Grid (Desktop & Mobile Friendly) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div
          className={`p-4 rounded-[1.75rem] border shadow-sm ${
            isDark ? 'bg-slate-800/90 border-slate-700/60' : 'bg-white border-slate-100'
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {lang === 'bn' ? 'চলতি মাস' : 'This Month'}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              ৳{stats.thisMonthAmount.toLocaleString()}
            </span>
          </div>
        </div>

        <div
          className={`p-4 rounded-[1.75rem] border shadow-sm ${
            isDark ? 'bg-slate-800/90 border-slate-700/60' : 'bg-white border-slate-100'
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {lang === 'bn' ? 'সর্বমোট আদায়' : 'Total Raised'}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base sm:text-xl font-black text-[#2563EB] dark:text-blue-400 font-mono">
              ৳{stats.totalAmount.toLocaleString()}
            </span>
          </div>
        </div>

        <div
          className={`col-span-2 sm:col-span-1 p-4 rounded-[1.75rem] border shadow-sm ${
            isDark ? 'bg-slate-800/90 border-slate-700/60' : 'bg-white border-slate-100'
          }`}
        >
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {lang === 'bn' ? 'দাতার সংখ্যা' : 'Registered Donors'}
          </span>
          <div className="flex items-center justify-between mt-1">
            <span className="text-base sm:text-xl font-black text-slate-800 dark:text-white font-mono">
              {stats.totalDonors} {lang === 'bn' ? 'জন' : 'donors'}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300">
              {stats.monthlyDonorsCount} {lang === 'bn' ? 'মাসিক' : 'monthly'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Responsive Tabs (Full-width 3 equal tabs, NO horizontal scrolling!) */}
      <div className="px-0.5">
        <div
          className={`flex p-1.5 rounded-[2rem] border gap-1 sm:gap-1.5 ${
            isDark ? 'bg-slate-800/80 border-slate-700/50' : 'bg-slate-100/80 border-slate-200/50'
          }`}
        >
          <button
            onClick={() => setActiveTab('entry')}
            className={`flex-1 py-3 px-1 sm:px-3 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-[1.5rem] transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
              activeTab === 'entry'
                ? isDark
                  ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50'
                  : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Plus size={15} className="shrink-0" />
            <span className="truncate">{lang === 'bn' ? 'নতুন দান গ্রহণ' : 'New Entry'}</span>
          </button>

          <button
            onClick={() => setActiveTab('management')}
            className={`flex-1 py-3 px-1 sm:px-3 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-[1.5rem] transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
              activeTab === 'management'
                ? isDark
                  ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50'
                  : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Users size={15} className="shrink-0" />
            <span className="truncate">{lang === 'bn' ? 'দানের তথ্য ও দাতা' : 'Donations & Donors'}</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex-1 py-3 px-1 sm:px-3 text-[11px] sm:text-xs font-black uppercase tracking-wider rounded-[1.5rem] transition-all duration-300 flex items-center justify-center gap-1 sm:gap-2 cursor-pointer ${
              activeTab === 'reports'
                ? isDark
                  ? 'bg-slate-900 text-blue-400 shadow-sm border border-slate-700/50'
                : 'bg-white text-[#2563EB] shadow-sm border border-slate-200/50'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <PieChart size={15} className="shrink-0" />
            <span className="truncate">{lang === 'bn' ? 'রিপোর্ট' : 'Reports'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        {/* ===================== TAB 1: NEW DONATION ENTRY ===================== */}
        {activeTab === 'entry' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Main Entry Form (Col 8) */}
            <div
              className={`lg:col-span-8 p-5 sm:p-7 rounded-[2rem] sm:rounded-[2.5rem] border shadow-bubble ${
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
              } space-y-5`}
            >
              <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-slate-700/60">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black ${
                      isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-[#2563EB]'
                    }`}
                  >
                    <Heart size={20} />
                  </div>
                  <div>
                    <h2 className={`text-base font-black font-noto ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                      {lang === 'bn' ? 'নতুন দান গ্রহণ ও রসিদ তৈরি' : 'Record Donation & Issue Receipt'}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {lang === 'bn' ? 'সঠিক তথ্য পূরণ করে রসিদ সংরক্ষণ বা প্রিন্ট করুন' : 'Fill details and print official receipt'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">
                    {lang === 'bn' ? 'রসিদ নং' : 'Receipt'}
                  </span>
                  <span className="text-xs sm:text-sm font-black font-mono text-[#2563EB] dark:text-blue-400">
                    #{receiptNo}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                {/* Donor Name with Auto-Suggest */}
                <div className="relative">
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1 pl-1">
                    {lang === 'bn' ? 'দাতার নাম *' : 'Donor Name *'}
                  </label>
                  <input
                    type="text"
                    value={donorName}
                    onChange={(e) => {
                      setDonorName(e.target.value);
                      setShowDonorSuggestions(true);
                    }}
                    onFocus={() => setShowDonorSuggestions(true)}
                    placeholder={lang === 'bn' ? 'যেমন: হাজী মো: রফিকুল ইসলাম' : 'e.g. Haji Md. Rafiq'}
                    className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />

                  {/* Autocomplete dropdown */}
                  {showDonorSuggestions && filteredDonorSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                      <div className="p-2 text-[10px] font-bold uppercase text-slate-400 bg-slate-50 dark:bg-slate-900/50">
                        {lang === 'bn' ? 'পূর্ববর্তী দাতা থেকে বাছাই করুন:' : 'Select existing donor:'}
                      </div>
                      {filteredDonorSuggestions.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => selectDonor(d)}
                          className="w-full text-left p-3 hover:bg-blue-50 dark:hover:bg-blue-500/10 flex items-center justify-between text-xs transition-all cursor-pointer"
                        >
                          <div>
                            <span className="font-black text-slate-800 dark:text-white block">{d.name}</span>
                            <span className="text-[11px] text-slate-400">{d.phone || d.address || 'পূর্ববর্তী দাতা'}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {d.donor_type === 'monthly' ? 'মাসিক' : 'সাধারণ'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Donor Phone */}
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1 pl-1">
                    {lang === 'bn' ? 'মোবাইল নম্বর (এসএমএস এর জন্য)' : 'Mobile Phone'}
                  </label>
                  <input
                    type="tel"
                    value={donorPhone}
                    onChange={(e) => setDonorPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                {/* Donor Address */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1 pl-1">
                    {lang === 'bn' ? 'দাতার ঠিকানা / এলাকা (ঐচ্ছিক)' : 'Address / Area (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={donorAddress}
                    onChange={(e) => setDonorAddress(e.target.value)}
                    placeholder={lang === 'bn' ? 'গ্রাম/মহল্লা, ডাকঘর, জেলা' : 'Village, Town, District'}
                    className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                {/* Fund Category */}
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1 pl-1">
                    {lang === 'bn' ? 'অনুদানের খাত *' : 'Fund Category *'}
                  </label>
                  <select
                    value={fundCategory}
                    onChange={(e) => setFundCategory(e.target.value)}
                    className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {fundCategories.map((f) => (
                      <option key={f.id} value={f.id}>
                        {lang === 'bn' ? f.nameBn : f.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1 pl-1">
                    {lang === 'bn' ? 'টাকার পরিমাণ (৳) *' : 'Amount (৳) *'}
                  </label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className={`w-full p-3.5 rounded-2xl border text-sm sm:text-base font-black text-[#2563EB] dark:text-blue-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                  {amount && !isNaN(Number(amount)) && Number(amount) > 0 && (
                    <p className="text-[10px] text-slate-400 font-bold mt-1 pl-1">
                      কথায়: {numberToBanglaWords(Number(amount))}
                    </p>
                  )}
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1 pl-1">
                    {lang === 'bn' ? 'পরিশোধের মাধ্যম' : 'Payment Method'}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {lang === 'bn' ? m.nameBn : m.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Donation Date */}
                <div>
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1 pl-1">
                    {lang === 'bn' ? 'অনুদানের তারিখ' : 'Date'}
                  </label>
                  <input
                    type="date"
                    value={donationDate}
                    onChange={(e) => setDonationDate(e.target.value)}
                    className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                {/* Prayer / Intention */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black text-slate-600 dark:text-slate-300 mb-1 pl-1">
                    {lang === 'bn' ? 'দোয়ার নিয়ত / উদ্দেশ্য (ঐচ্ছিক)' : 'Prayer Request / Intention (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={prayerRequest}
                    onChange={(e) => setPrayerRequest(e.target.value)}
                    placeholder={lang === 'bn' ? 'যেমন: মরহুম পিতা-মাতার মাগফিরাত কামনায়, সুস্থতার জন্য' : 'e.g. For parents forgiveness, health'}
                    className={`w-full p-3.5 rounded-2xl border text-xs sm:text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                      isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Toggles & Options */}
              <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                {donorPhone && (
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sendSms}
                      onChange={(e) => setSendSms(e.target.checked)}
                      className="w-4 h-4 rounded text-[#2563EB] focus:ring-blue-500 border-slate-300 shrink-0"
                    />
                    <span className="text-xs sm:text-sm font-bold">
                      {lang === 'bn' ? 'এসএমএস রসিদ পাঠান' : 'Send SMS Receipt'}
                    </span>
                  </label>
                )}

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isMonthlyDonor}
                    onChange={(e) => setIsMonthlyDonor(e.target.checked)}
                    className="w-4 h-4 rounded text-[#2563EB] focus:ring-blue-500 border-slate-300"
                  />
                  <span className="text-xs sm:text-sm font-bold">
                    {lang === 'bn'
                      ? 'মাসিক দাতা হিসেবে তালিকাভুক্ত'
                      : 'Enroll as Monthly Donor'}
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmitDonation(true)}
                  className="w-full sm:flex-1 py-3.5 px-5 rounded-2xl bg-[#2563EB] hover:bg-blue-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Printer size={18} />
                  <span>
                    {saving
                      ? lang === 'bn'
                        ? 'সংরক্ষণ হচ্ছে...'
                        : 'Saving...'
                      : lang === 'bn'
                      ? 'জমা করুন ও রসিদ প্রিন্ট করুন'
                      : 'Save & Print Receipt'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleSubmitDonation(false)}
                  className={`w-full sm:w-auto py-3.5 px-6 rounded-2xl border font-black text-xs sm:text-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                    isDark
                      ? 'bg-slate-700 border-slate-600 hover:bg-slate-600 text-white'
                      : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800'
                  }`}
                >
                  {lang === 'bn' ? 'শুধু জমা করুন' : 'Save Only'}
                </button>
              </div>
            </div>

            {/* Right Side Shortcuts & Recent Records (Col 4) */}
            <div className="lg:col-span-4 space-y-4">
              {/* Quick Fund Breakdown Card */}
              <div
                className={`p-5 rounded-[2rem] border shadow-bubble ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                } space-y-3.5`}
              >
                <h3 className={`text-xs sm:text-sm font-black font-noto flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                  <PieChart size={16} className="text-[#2563EB]" />
                  <span>{lang === 'bn' ? 'আজকের অনুদান সংগ্রহ' : "Today's Collection"}</span>
                </h3>

                <div
                  className={`p-3.5 rounded-2xl border text-center ${
                    isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50/60 border-blue-100'
                  }`}
                >
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    {lang === 'bn' ? 'আজকের মোট জমা' : "Today's Total"}
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-[#2563EB] dark:text-blue-400 font-mono">
                    ৳ {stats.todayAmount.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  {fundCategories.slice(0, 5).map((f) => {
                    const amt = stats.fundTotals[f.id] || 0;
                    return (
                      <div
                        key={f.id}
                        className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-700/50 text-[11px]"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${f.color} shrink-0`}></div>
                          <span className="text-slate-600 dark:text-slate-300 font-medium truncate">
                            {lang === 'bn' ? f.nameBn : f.nameEn}
                          </span>
                        </div>
                        <span className="font-black text-slate-800 dark:text-white font-mono shrink-0">
                          ৳ {amt.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Receipts */}
              <div
                className={`p-5 rounded-[2rem] border shadow-bubble ${
                  isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                } space-y-3`}
              >
                <div className="flex items-center justify-between">
                  <h3 className={`text-xs sm:text-sm font-black font-noto flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    <Clock size={16} className="text-[#2563EB]" />
                    <span>{lang === 'bn' ? 'সাম্প্রতিক রসিদসমূহ' : 'Recent Receipts'}</span>
                  </h3>
                  <button
                    onClick={() => {
                      setActiveTab('management');
                      setMgmtSubTab('history');
                    }}
                    className="text-[11px] font-black text-[#2563EB] dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {lang === 'bn' ? 'সকল দেখুন' : 'View All'}
                  </button>
                </div>

                {donations.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    {lang === 'bn' ? 'এখনও কোনো অনুদান জমা হয়নি।' : 'No donations recorded yet.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {donations.slice(0, 4).map((d) => (
                      <div
                        key={d.id}
                        onClick={() => setSelectedDonationForReceipt(d)}
                        className={`p-3 rounded-2xl border flex items-center justify-between hover:border-blue-400 transition-all cursor-pointer ${
                          isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-100'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="text-xs font-black text-slate-800 dark:text-white block truncate">
                            {d.donor_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            #{d.receipt_no} • {d.donation_date || d.created_at?.slice(0, 10)}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-black text-[#2563EB] dark:text-blue-400 block font-mono">
                            ৳ {d.amount.toLocaleString()}
                          </span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#2563EB] dark:bg-blue-500/10 dark:text-blue-300">
                            রসিদ
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: MANAGEMENT (HISTORY & DONORS) ===================== */}
        {activeTab === 'management' && (
          <div className="space-y-6">
            {/* Sub-tab Switcher for Management */}
            <div className="flex items-center justify-center">
              <div className={`inline-flex p-1 rounded-xl gap-1 ${isDark ? 'bg-slate-900/50' : 'bg-slate-200/50'}`}>
                <button
                  onClick={() => setMgmtSubTab('history')}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                    mgmtSubTab === 'history'
                      ? isDark ? 'bg-slate-800 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  {lang === 'bn' ? 'অনুদানের তালিকা' : 'Donation History'}
                </button>
                <button
                  onClick={() => setMgmtSubTab('donors')}
                  className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                    mgmtSubTab === 'donors'
                      ? isDark ? 'bg-slate-800 text-blue-400 shadow-sm' : 'bg-white text-blue-600 shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                  }`}
                >
                  {lang === 'bn' ? 'দাতাদের তালিকা' : 'Donor List'}
                </button>
              </div>
            </div>

            {/* Content for Management Tab */}
            {mgmtSubTab === 'history' ? (
              <div className="space-y-4">
                {/* Search & Filters for History */}
                <div className={`p-4 rounded-[2rem] border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} shadow-bubble`}>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5 relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder={lang === 'bn' ? 'দাতার নাম, মোবাইল বা রসিদ নং দিয়ে খুঁজুন...' : 'Search by name, phone or receipt...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-bold outline-none transition-all ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                        }`}
                      />
                    </div>
                    <div className="md:col-span-3">
                      <select
                        value={filterFund}
                        onChange={(e) => setFilterFund(e.target.value)}
                        className={`w-full px-4 py-2.5 rounded-xl border text-xs font-bold outline-none transition-all ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      >
                        <option value="all">{lang === 'bn' ? 'সকল খাত' : 'All Funds'}</option>
                        {fundCategories.map(f => <option key={f.id} value={f.id}>{lang === 'bn' ? f.nameBn : f.nameEn}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-4 flex gap-2">
                      <select
                        value={filterDateRange}
                        onChange={(e) => setFilterDateRange(e.target.value as any)}
                        className={`flex-1 px-4 py-2.5 rounded-xl border text-xs font-bold outline-none transition-all ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      >
                        <option value="all">{lang === 'bn' ? 'সকল সময়' : 'All Time'}</option>
                        <option value="today">{lang === 'bn' ? 'আজকের' : 'Today'}</option>
                        <option value="this_month">{lang === 'bn' ? 'চলতি মাস' : 'This Month'}</option>
                        <option value="custom">{lang === 'bn' ? 'নির্দিষ্ট সময়' : 'Custom'}</option>
                      </select>
                      {filterDateRange === 'custom' && (
                        <div className="flex gap-2">
                          <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="p-2.5 rounded-xl border text-[10px] font-bold" />
                          <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="p-2.5 rounded-xl border text-[10px] font-bold" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Donation Table */}
                <div className={`overflow-hidden rounded-[2rem] border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} shadow-bubble`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className={`${isDark ? 'bg-slate-900/50' : 'bg-slate-50'} border-b border-slate-100 dark:border-slate-700`}>
                          <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                          <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'দাতার তথ্য' : 'Donor'}</th>
                          <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'খাত' : 'Fund'}</th>
                          <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</th>
                          <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">{lang === 'bn' ? 'অ্যাকশন' : 'Action'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {filteredDonations.length === 0 ? (
                          <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 font-bold text-xs">{lang === 'bn' ? 'কোনো অনুদান পাওয়া যায়নি' : 'No donations found'}</td></tr>
                        ) : (
                          filteredDonations.map((dn) => (
                            <tr key={dn.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                              <td className="px-5 py-4 whitespace-nowrap">
                                <div className="text-[11px] font-black text-slate-800 dark:text-slate-200">{new Date(dn.donation_date).toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US')}</div>
                                <div className="text-[9px] font-bold text-slate-400">#{dn.receipt_no}</div>
                              </td>
                              <td className="px-5 py-4">
                                <div className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[150px]">{dn.donor_name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{dn.donor_phone || '-'}</div>
                              </td>
                              <td className="px-5 py-4">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                  {fundCategories.find(f => f.id === dn.fund_category)?.nameBn || dn.fund_category}
                                </span>
                              </td>
                              <td className="px-5 py-4 font-black text-xs text-emerald-600 dark:text-emerald-400 font-mono">৳{dn.amount.toLocaleString()}</td>
                              <td className="px-5 py-4">
                                <div className="flex gap-2">
                                  <button onClick={() => setSelectedDonationForReceipt(dn)} className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 hover:scale-110 transition-all"><Printer size={14} /></button>
                                  {isAdmin && <button onClick={() => handleDeleteDonation(dn)} className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 hover:scale-110 transition-all"><Trash2 size={14} /></button>}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              /* Donors Tab Content */
              <div className="space-y-4">
                 {/* Search & Filters for Donors */}
                 <div className={`p-4 rounded-[2rem] border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} shadow-bubble`}>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-8 relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder={lang === 'bn' ? 'দাতার নাম, মোবাইল বা ঠিকানা দিয়ে খুঁজুন...' : 'Search by name, phone or address...'}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-bold outline-none transition-all ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                        }`}
                      />
                    </div>
                    <div className="md:col-span-4 flex flex-wrap gap-2">
                      <select
                        value={donorFilterType}
                        onChange={(e) => setDonorFilterType(e.target.value as any)}
                        className={`flex-1 min-w-[100px] px-3 py-2.5 rounded-xl border text-xs font-bold outline-none transition-all ${
                          isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      >
                        <option value="all">{lang === 'bn' ? 'সকল দাতা' : 'All Donors'}</option>
                        <option value="monthly">{lang === 'bn' ? 'মাসিক নিয়মিত' : 'Monthly'}</option>
                        <option value="general">{lang === 'bn' ? 'সাধারণ দাতা' : 'General'}</option>
                        <option value="permanent">{lang === 'bn' ? 'স্থায়ী সদস্য' : 'Permanent'}</option>
                      </select>

                      <button
                        onClick={() => handleOpenGroupVoiceCallModal()}
                        className="px-3 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all shadow-sm cursor-pointer shrink-0"
                        title={lang === 'bn' ? 'একসাথে ভয়েস কল পাঠান' : 'Group Voice Call'}
                      >
                        <Mic size={15} />
                        <span>{lang === 'bn' ? 'একসাথে ভয়েস কল' : 'Group Voice Call'}</span>
                      </button>

                      <button
                        onClick={handleOpenAddDonorModal}
                        className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 active:scale-95 transition-all shadow-sm cursor-pointer shrink-0"
                      >
                        <UserPlus size={15} />
                        <span>{lang === 'bn' ? 'নতুন দাতা' : 'Add Donor'}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDonorsList.length === 0 ? (
                    <div className="col-span-full py-20 text-center text-slate-400 font-bold text-xs">{lang === 'bn' ? 'কোনো দাতা পাওয়া যায়নি' : 'No donors found'}</div>
                  ) : (
                    filteredDonorsList.map((donor) => {
                      const donorDonationsList = donations.filter(
                        (dn) => (dn.donor_id && dn.donor_id === donor.id) || (donor.phone && dn.donor_phone === donor.phone)
                      );
                      const totalDonated = donorDonationsList.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
                      const thisMonthStr = new Date().toISOString().slice(0, 7);
                      const paidThisMonth =
                        donor.donor_type === 'monthly' &&
                        donorDonationsList.some((dn) => (dn.donation_date || dn.created_at || '').startsWith(thisMonthStr));

                      return (
                        <div
                          key={donor.id}
                          className={`p-5 rounded-[2rem] border transition-all duration-200 hover:shadow-lg ${
                            isDark
                              ? 'bg-slate-800/90 border-slate-700/80 hover:border-blue-500/50'
                              : 'bg-white border-slate-200/80 hover:border-blue-300'
                          } flex flex-col justify-between space-y-4 relative overflow-hidden`}
                        >
                          {/* Top Header Row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                                {donor.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-sm font-black text-slate-900 dark:text-white truncate font-noto">
                                  {donor.name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      donor.donor_type === 'monthly'
                                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                        : donor.donor_type === 'permanent'
                                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                        : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                    }`}
                                  >
                                    {donor.donor_type === 'monthly'
                                      ? 'মাসিক দাতা'
                                      : donor.donor_type === 'permanent'
                                      ? 'স্থায়ী সদস্য'
                                      : 'সাধারণ দাতা'}
                                  </span>

                                  {donor.donor_type === 'monthly' && (
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        paidThisMonth
                                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                                      }`}
                                    >
                                      {paidThisMonth ? 'পরিশোধিত' : 'বকেয়া'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Action icons (Edit & Delete) */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleOpenEditDonorModal(donor)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 dark:bg-slate-700 dark:hover:bg-blue-900/50 dark:text-slate-300 dark:hover:text-blue-300 transition-all cursor-pointer"
                                title={lang === 'bn' ? 'এডিট করুন' : 'Edit'}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteDonor(donor)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 dark:bg-slate-700 dark:hover:bg-rose-900/50 dark:text-slate-300 dark:hover:text-rose-300 transition-all cursor-pointer"
                                title={lang === 'bn' ? 'মুছে ফেলুন' : 'Delete'}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Details Box */}
                          <div className="space-y-2 text-xs">
                            {donor.phone ? (
                              <div className="flex items-center gap-2">
                                <a
                                  href={`tel:${donor.phone}`}
                                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                >
                                  <PhoneCall size={13} className="text-emerald-500" />
                                  <span>{donor.phone}</span>
                                </a>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 italic">ফোন নম্বর পাওয়া যায়নি</div>
                            )}

                            {donor.address && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                <MapPin size={12} className="text-slate-400 shrink-0" />
                                <span className="truncate">{donor.address}</span>
                              </div>
                            )}

                            {/* Stats row */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60">
                                <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                                  {lang === 'bn' ? 'মোট অনুদান' : 'Total Donated'}
                                </span>
                                <span className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono">
                                  ৳ {totalDonated.toLocaleString()}
                                </span>
                              </div>

                              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60">
                                <span className="text-[10px] font-bold text-slate-400 block mb-0.5">
                                  {donor.monthly_pledge_amount
                                    ? lang === 'bn'
                                      ? 'মাসিক অঙ্গীকার'
                                      : 'Pledge'
                                    : lang === 'bn'
                                    ? 'দান সংখ্যা'
                                    : 'Entries'}
                                </span>
                                <span className="text-sm font-black text-purple-600 dark:text-purple-400 font-mono">
                                  {donor.monthly_pledge_amount
                                    ? `৳ ${donor.monthly_pledge_amount.toLocaleString()}`
                                    : `${donorDonationsList.length} ${lang === 'bn' ? 'টি' : 'times'}`}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Action Buttons */}
                          <div className="pt-3 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap items-center gap-1.5">
                            {donor.phone && (
                              <a
                                href={`tel:${donor.phone}`}
                                className="flex-1 py-2 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center justify-center gap-1 transition-all shadow-sm"
                              >
                                <PhoneCall size={13} />
                                <span>{lang === 'bn' ? 'কল' : 'Call'}</span>
                              </a>
                            )}

                            {donor.phone && (
                              <button
                                onClick={() => handleOpenGroupVoiceCallModal([donor])}
                                className="flex-1 py-2 px-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-black flex items-center justify-center gap-1 transition-all shadow-sm cursor-pointer"
                              >
                                <Mic size={13} />
                                <span>{lang === 'bn' ? 'ভয়েস কল' : 'Voice'}</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                selectDonor(donor);
                                setActiveTab('entry');
                              }}
                              className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                              <Plus size={13} />
                              <span>{lang === 'bn' ? 'দান' : 'Donate'}</span>
                            </button>

                            <button
                              onClick={() => setSelectedDonorForProfile(donor)}
                              className="py-2 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                              title={lang === 'bn' ? 'প্রোফাইল দেখুন' : 'View Profile'}
                            >
                              <User size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================== TAB 4: FUND REPORTS ===================== */}
        {activeTab === 'reports' && (
          <div className="space-y-5">
            <div
              className={`p-5 sm:p-7 rounded-[2rem] sm:rounded-[2.5rem] border shadow-bubble ${
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
              } space-y-5`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4 border-slate-100 dark:border-slate-700/60">
                <div>
                  <h2 className={`text-base sm:text-lg font-black font-noto flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                    <PieChart size={18} className="text-[#2563EB]" />
                    <span>{lang === 'bn' ? 'খাতভিত্তিক অনুদান বিশ্লেষণ ও পরিসংখ্যান' : 'Fund-wise Analytics & Reports'}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'কোন খাতে কত অনুদান জমা হয়েছে তার বিস্তারিত বিবরণ'
                      : 'Detailed breakdown of collections per fund'}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    {lang === 'bn' ? 'সর্বমোট অনুদান সংগ্রহ' : 'Lifetime Total'}
                  </span>
                  <span className="text-xl sm:text-2xl font-black text-[#2563EB] dark:text-blue-400 font-mono">
                    ৳ {stats.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {fundCategories.map((fund) => {
                  const fundAmount = stats.fundTotals[fund.id] || 0;
                  const percentage =
                    stats.totalAmount > 0
                      ? Math.round((fundAmount / stats.totalAmount) * 100)
                      : 0;
                  const count = donations.filter((d) => d.fund_category === fund.id).length;

                  return (
                    <div
                      key={fund.id}
                      className={`p-4 rounded-2xl border ${
                        isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-slate-50 border-slate-200'
                      } space-y-2.5`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${fund.color}`}></div>
                          <h4 className="text-xs font-black text-slate-800 dark:text-white font-noto">
                            {lang === 'bn' ? fund.nameBn : fund.nameEn}
                          </h4>
                        </div>
                        <span className="text-xs font-black text-slate-400 font-mono">{percentage}%</span>
                      </div>

                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${fund.color} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-0.5">
                        <span className="text-slate-400 text-[11px]">{count} টি রসিদ</span>
                        <span className="font-black text-slate-900 dark:text-white text-xs sm:text-sm font-mono">
                          ৳ {fundAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===================== MODALS ===================== */}

      {/* Money Receipt Modal */}
      {selectedDonationForReceipt && (
        <DonationReceiptModal
          donation={selectedDonationForReceipt}
          madrasah={madrasah}
          lang={lang}
          onClose={() => setSelectedDonationForReceipt(null)}
        />
      )}

      {/* Donor Profile Modal */}
      {selectedDonorForProfile && (
        <DonorProfileModal
          donor={selectedDonorForProfile}
          donations={donations}
          madrasah={madrasah}
          lang={lang}
          onClose={() => setSelectedDonorForProfile(null)}
          onNewDonation={(d) => {
            selectDonor(d);
            setActiveTab('entry');
          }}
          onViewReceipt={(d) => setSelectedDonationForReceipt(d)}
          onEditDonor={(d) => handleOpenEditDonorModal(d)}
          onDeleteDonor={(d) => handleDeleteDonor(d)}
        />
      )}

      {/* Add / Edit Donor Modal */}
      {showNewDonorModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-[2.5rem] border shadow-bubble p-5 sm:p-7 space-y-5 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3.5 border-slate-100 dark:border-slate-800">
              <h3 className={`text-base font-black font-noto ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                {editingDonor
                  ? lang === 'bn'
                    ? 'দাতার তথ্য সংশোধন করুন'
                    : 'Edit Donor Profile'
                  : lang === 'bn'
                  ? 'নতুন দাতার তথ্য যুক্ত করুন'
                  : 'Add New Donor Profile'}
              </h3>
              <button
                onClick={() => {
                  setShowNewDonorModal(false);
                  setEditingDonor(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-black mb-1 pl-1">দাতার নাম *</label>
                <input
                  type="text"
                  value={newDonorName}
                  onChange={(e) => setNewDonorName(e.target.value)}
                  placeholder="দাতার পূর্ণ নাম"
                  className="w-full p-3 rounded-2xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black mb-1 pl-1">মোবাইল নম্বর</label>
                  <input
                    type="tel"
                    value={newDonorPhone}
                    onChange={(e) => setNewDonorPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full p-3 rounded-2xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block font-black mb-1 pl-1">ইমেইল (ঐচ্ছিক)</label>
                  <input
                    type="email"
                    value={newDonorEmail}
                    onChange={(e) => setNewDonorEmail(e.target.value)}
                    placeholder="donor@example.com"
                    className="w-full p-3 rounded-2xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-black mb-1 pl-1">ঠিকানা / এলাকা</label>
                <input
                  type="text"
                  value={newDonorAddress}
                  onChange={(e) => setNewDonorAddress(e.target.value)}
                  placeholder="ঠিকানা"
                  className="w-full p-3 rounded-2xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-black mb-1 pl-1">দাতার ধরণ</label>
                  <select
                    value={newDonorType}
                    onChange={(e) => setNewDonorType(e.target.value as any)}
                    className="w-full p-3 rounded-2xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-xs font-bold"
                  >
                    <option value="general">সাধারণ দাতা</option>
                    <option value="monthly">মাসিক নিয়মিত দাতা</option>
                    <option value="permanent">স্থায়ী / আজীবন সদস্য</option>
                    <option value="corporate">প্রাতিষ্ঠানিক অনুদানকারী</option>
                  </select>
                </div>
                <div>
                  <label className="block font-black mb-1 pl-1">মাসিক অঙ্গীকার (টাকা)</label>
                  <input
                    type="number"
                    value={newDonorPledge}
                    onChange={(e) => setNewDonorPledge(e.target.value)}
                    placeholder="টাকার পরিমাণ"
                    className="w-full p-3 rounded-2xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-xs font-black"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setShowNewDonorModal(false);
                  setEditingDonor(null);
                }}
                className="px-4 py-2.5 rounded-2xl border text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                বাতিল
              </button>
              <button
                onClick={handleSaveDonor}
                className="px-5 py-2.5 rounded-2xl bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-black shadow-sm active:scale-95 cursor-pointer"
              >
                {editingDonor ? (lang === 'bn' ? 'আপডেট করুন' : 'Update') : (lang === 'bn' ? 'সংরক্ষণ করুন' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Voice Call Modal */}
      {showGroupVoiceModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`w-full max-w-lg rounded-[2.5rem] border shadow-bubble p-5 sm:p-7 space-y-5 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b pb-3.5 border-slate-100 dark:border-slate-800">
              <h3 className={`text-base font-black font-noto flex items-center gap-2 ${isDark ? 'text-white' : 'text-[#1E3A8A]'}`}>
                <Mic className="text-purple-600 dark:text-purple-400" size={20} />
                <span>{lang === 'bn' ? 'অ্যাকাউন্টে অ্যাসাইনকৃত ভয়েস কল সিলেকশন' : 'Assigned Voice Call Selection'}</span>
              </h3>
              <button
                onClick={() => {
                  if (previewAudio) previewAudio.pause();
                  setIsPlayingPreview(false);
                  setShowGroupVoiceModal(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 active:scale-95 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. Target Group Selector */}
              <div>
                <label className="block font-black mb-2 text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'প্রাপক দাতা গ্রুপ নির্বাচন করুন:' : 'Select Target Donor Audience:'}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setVoiceTargetGroup('all')}
                    className={`p-2.5 rounded-2xl border font-bold text-center text-xs transition-all cursor-pointer ${
                      voiceTargetGroup === 'all'
                        ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {lang === 'bn' ? 'সকল দাতা' : 'All Donors'} ({donors.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setVoiceTargetGroup('monthly')}
                    className={`p-2.5 rounded-2xl border font-bold text-center text-xs transition-all cursor-pointer ${
                      voiceTargetGroup === 'monthly'
                        ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {lang === 'bn' ? 'মাসিক দাতা' : 'Monthly'} ({donors.filter((d) => d.donor_type === 'monthly').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setVoiceTargetGroup('unpaid_monthly')}
                    className={`p-2.5 rounded-2xl border font-bold text-center text-xs transition-all cursor-pointer ${
                      voiceTargetGroup === 'unpaid_monthly'
                        ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {lang === 'bn' ? 'বকেয়া দাতা' : 'Unpaid'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setVoiceTargetGroup('general')}
                    className={`p-2.5 rounded-2xl border font-bold text-center text-xs transition-all cursor-pointer ${
                      voiceTargetGroup === 'general'
                        ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {lang === 'bn' ? 'সাধারণ দাতা' : 'General'}
                  </button>

                  {selectedVoiceDonorIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setVoiceTargetGroup('selected')}
                      className={`p-2.5 rounded-2xl border font-bold text-center text-xs transition-all cursor-pointer ${
                        voiceTargetGroup === 'selected'
                          ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {lang === 'bn' ? 'নির্দিষ্ট দাতা' : 'Selected'} ({selectedVoiceDonorIds.length})
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Voice Record Dropdown Selector (Under Target Group) */}
              <div>
                <label className="block font-black mb-1.5 text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'অনুমোদিত ভয়েস বার্তা নির্বাচন করুন:' : 'Select Approved Voice Message:'}
                </label>
                
                {voiceTemplates.length === 0 ? (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
                    {lang === 'bn'
                      ? 'যোগাযোগ > ভয়েস কল টেবে কোনো অনুমোদিত ভয়েস বার্তা পাওয়া যায়নি। নতুন ভয়েস রেকর্ড বা আপলোড করুন।'
                      : 'No approved voice messages found in Communication > Voice tab. Please add or upload a voice.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedVoiceTemplateId}
                      onChange={(e) => setSelectedVoiceTemplateId(e.target.value)}
                      className="w-full p-3 rounded-2xl border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 outline-none text-xs font-bold text-slate-900 dark:text-white cursor-pointer shadow-sm focus:border-purple-500"
                    >
                      {voiceTemplates.map((vt) => (
                        <option key={vt.id} value={vt.id}>
                          {vt.title || vt.name || 'ভয়েস বার্তা'} ({vt.duration || '30'}s)
                        </option>
                      ))}
                    </select>

                    {/* Audio Listen Preview Button */}
                    {(() => {
                      const currentVt = voiceTemplates.find((v) => v.id === selectedVoiceTemplateId) || voiceTemplates[0];
                      if (!currentVt?.file_url) return null;
                      return (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                          <span className="font-bold text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 truncate">
                            <Volume2 size={14} className="text-purple-600 flex-shrink-0" />
                            <span className="truncate">{currentVt.title || 'অডিও রেকর্ড বার্তা'}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleAudioPreview(currentVt.file_url)}
                            className="px-3 py-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 dark:bg-purple-900/50 dark:hover:bg-purple-800/50 text-purple-700 dark:text-purple-300 font-bold text-[11px] flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer"
                          >
                            {isPlayingPreview ? (
                              <>
                                <Square size={12} className="fill-current" />
                                <span>থামান</span>
                              </>
                            ) : (
                              <>
                                <Play size={12} className="fill-current" />
                                <span>প্লে করে শুনুন</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Cost Breakdown Info */}
              <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 flex items-center justify-between text-purple-900 dark:text-purple-200">
                <div>
                  <span className="text-[11px] font-bold block opacity-80">
                    {lang === 'bn' ? 'মোট প্রাপক সংখ্যা ও আনুমানিক কল খরচ:' : 'Recipients & Estimated Call Cost:'}
                  </span>
                  <span className="text-sm font-black font-mono">
                    {computedTargetCount} জন দাতা • ৳ {((madrasah?.voice_rate || 0.45) * computedTargetCount).toFixed(2)}
                  </span>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100">
                  {lang === 'bn' ? 'স্বয়ংক্রিয় ভয়েস কল' : 'Automated Voice'}
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  if (previewAudio) previewAudio.pause();
                  setIsPlayingPreview(false);
                  setShowGroupVoiceModal(false);
                }}
                disabled={sendingVoiceBroadcast}
                className="px-4 py-2.5 rounded-2xl border text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                {lang === 'bn' ? 'বাতিল' : 'Cancel'}
              </button>

              <button
                onClick={handleSendGroupVoiceBroadcast}
                disabled={true}
                className="px-5 py-2.5 rounded-2xl bg-slate-400 text-white text-xs font-black shadow-sm cursor-not-allowed opacity-70 flex items-center gap-2"
              >
                <Mic size={15} />
                <span>
                  {lang === 'bn' ? 'ভয়েস ব্রডকাস্ট অফ আছে' : 'Voice Broadcast Off'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Donations;
