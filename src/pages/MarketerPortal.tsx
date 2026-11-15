import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Banknote,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  LogOut,
  TrendingUp,
  Clock,
  FileText,
  Phone,
  Mail,
  UserCheck,
  ShieldCheck,
  Copy,
  Check,
  User,
  Sparkles,
  ArrowUpRight,
  X,
  Percent,
  Wallet
} from 'lucide-react';
import { supabase } from '../supabase';
import { Profile, Language } from '../types';

interface MarketerPortalProps {
  profile: Profile | null;
  onLogout: () => void;
  lang: Language;
  setLang?: (l: Language) => void;
}

interface AssignedInstitution {
  id: string;
  name: string;
  phone?: string;
  institute_code?: string;
  created_at: string;
  status: string;
  is_active: boolean;
  subscription_end?: string;
  custom_subscription_fee?: number | null;
  config_json?: {
    institute_code?: string;
    package_name?: string;
    package_rate?: number;
    subscription_type?: string;
    paid_months?: string[];
    due_amount?: number;
    marketer_id?: string;
    marketer_name?: string;
    marketer_commission_rate?: number;
    marketer_base_deduction?: number;
  };
}

interface SubTransaction {
  id: string;
  institution_id: string;
  institution_name?: string;
  institute_code?: string;
  amount: number;
  gross_amount?: number;
  base_deduction?: number;
  commissionable_amount?: number;
  commission_rate?: number;
  marketer_commission?: number;
  company_share?: number;
  transaction_id: string;
  sender_phone?: string;
  description: string;
  status: string;
  created_at: string;
  approved_at?: string;
  module?: string;
  metadata?: any;
}

export const MarketerPortal: React.FC<MarketerPortalProps> = ({
  profile,
  onLogout,
  lang,
  setLang
}) => {
  const [institutions, setInstitutions] = useState<AssignedInstitution[]>([]);
  const [transactions, setTransactions] = useState<SubTransaction[]>([]);
  const [commissionConfig, setCommissionConfig] = useState<{
    commission_rate: number;
    base_deduction: number;
  }>({
    commission_rate: Number(profile?.permissions?.commission_rate ?? 30),
    base_deduction: Number(profile?.permissions?.base_deduction ?? 100)
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'institutions' | 'collections' | 'profile'>('institutions');
  const [copiedTrxId, setCopiedTrxId] = useState<string | null>(null);

  // Filters for Institution Directory
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');

  // Filters for Commission & Collection Statement
  const [collectionFilter, setCollectionFilter] = useState<'today' | 'month' | 'all'>('month');
  const [collectionSearch, setCollectionSearch] = useState<string>('');

  const currentMonthKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }, []);

  const currentMonthDisplay = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-US', {
      month: 'long',
      year: 'numeric'
    });
  }, [lang]);

  const todayDateKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const defaultRate = Number(commissionConfig.commission_rate ?? profile?.permissions?.commission_rate ?? 30);
  const defaultDeduction = Number(commissionConfig.base_deduction ?? profile?.permissions?.base_deduction ?? 100);

  // Deterministic helper for any transaction's commission breakdown
  const getTxBreakdown = (tx: SubTransaction) => {
    const gross = Number(tx.gross_amount ?? tx.amount) || 0;
    const deduction = tx.base_deduction !== undefined ? Number(tx.base_deduction) : defaultDeduction;
    const rate = tx.commission_rate !== undefined ? Number(tx.commission_rate) : defaultRate;
    const commissionable = tx.commissionable_amount !== undefined
      ? Number(tx.commissionable_amount)
      : (gross > deduction ? Number((gross - deduction).toFixed(2)) : 0);
    const marketerShare = tx.marketer_commission !== undefined
      ? Number(tx.marketer_commission)
      : (gross > deduction ? Number(((commissionable * rate) / 100).toFixed(2)) : 0);
    const companyShare = tx.company_share !== undefined
      ? Number(tx.company_share)
      : Number((gross - marketerShare).toFixed(2));

    return {
      gross,
      deduction,
      commissionable,
      rate,
      marketerShare,
      companyShare
    };
  };

  const fetchDashboardData = async (isManualRefresh = false) => {
    if (!profile?.id) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch('/api/admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'get_marketer_dashboard',
            marketer_id: profile.id
          })
        });

        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            if (result.commission_config) {
              setCommissionConfig({
                commission_rate: Number(result.commission_config.commission_rate ?? 30),
                base_deduction: Number(result.commission_config.base_deduction ?? 100)
              });
            }
            setInstitutions(result.institutions || []);
            setTransactions(result.transactions || []);
            return;
          }
        }
      }

      // Client-side fallback if API is unreachable
      const fallbackRate = Number(profile?.permissions?.commission_rate ?? 30);
      const fallbackDed = Number(profile?.permissions?.base_deduction ?? 100);
      setCommissionConfig({ commission_rate: fallbackRate, base_deduction: fallbackDed });

      const { data: allInsts } = await supabase
        .from('institutions')
        .select('id, name, phone, institute_code, created_at, status, is_active, subscription_end, custom_subscription_fee, config_json')
        .eq('is_super_admin', false)
        .neq('name', 'SYSTEM_GLOBAL_INTERNAL')
        .order('created_at', { ascending: false });

      const instRuleMap = new Map<string, { rate: number; deduction: number }>();

      const assigned = (allInsts || []).filter((inst: any) => {
        let cfg = inst.config_json;
        if (typeof cfg === 'string') {
          try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
        }
        return cfg?.marketer_id === profile.id;
      }).map((inst: any) => {
        let cfg = inst.config_json;
        if (typeof cfg === 'string') {
          try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
        }
        const instRate = cfg?.marketer_commission_rate !== undefined && cfg?.marketer_commission_rate !== null
          ? Number(cfg.marketer_commission_rate)
          : fallbackRate;
        const instDed = cfg?.marketer_base_deduction !== undefined && cfg?.marketer_base_deduction !== null
          ? Number(cfg.marketer_base_deduction)
          : fallbackDed;
        instRuleMap.set(inst.id, { rate: instRate, deduction: instDed });

        return {
          ...inst,
          institute_code: inst.institute_code || cfg?.institute_code || '',
          config_json: {
            ...(cfg || {}),
            marketer_commission_rate: instRate,
            marketer_base_deduction: instDed
          }
        };
      });

      setInstitutions(assigned);

      const instIds = assigned.map((i: any) => i.id);
      if (instIds.length > 0) {
        const { data: txData } = await supabase
          .from('transactions')
          .select('id, institution_id, amount, transaction_id, sender_phone, description, status, created_at, approved_at, module, metadata')
          .in('institution_id', instIds)
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(1000);

        const instMap = new Map<string, { name: string; code: string }>();
        assigned.forEach((i: any) => instMap.set(i.id, { name: i.name, code: i.institute_code || '' }));

        const subTx = (txData || [])
          .filter((t: any) => {
            const desc = (t.description || '').toLowerCase();
            return (
              t.module === 'subscription' ||
              desc.includes('subscription') ||
              desc.includes('package') ||
              desc.includes('renew') ||
              desc.includes('প্যাকেজ') ||
              desc.includes('সাবস্ক্রিপশন')
            );
          })
          .map((t: any) => {
            const gross = Number(t.amount) || 0;
            const rule = instRuleMap.get(t.institution_id) || { rate: fallbackRate, deduction: fallbackDed };
            const commAmt = gross > rule.deduction ? Number((gross - rule.deduction).toFixed(2)) : 0;
            const mShare = gross > rule.deduction ? Number(((commAmt * rule.rate) / 100).toFixed(2)) : 0;
            return {
              ...t,
              institution_name: instMap.get(t.institution_id)?.name || 'Unknown Institution',
              institute_code: instMap.get(t.institution_id)?.code || '',
              gross_amount: gross,
              base_deduction: rule.deduction,
              commissionable_amount: commAmt,
              commission_rate: rule.rate,
              marketer_commission: mShare,
              company_share: Number((gross - mShare).toFixed(2))
            };
          });

        setTransactions(subTx);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Error loading Marketer Portal data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [profile?.id]);

  // Helper to check if an institution has paid for the current month
  const isInstitutionPaidThisMonth = (inst: AssignedInstitution): boolean => {
    const paidMonths = inst.config_json?.paid_months || [];
    if (Array.isArray(paidMonths) && paidMonths.includes(currentMonthKey)) {
      return true;
    }
    const hasTxThisMonth = transactions.some(tx => {
      if (tx.institution_id !== inst.id) return false;
      const rawDate = tx.approved_at || tx.created_at || '';
      const dObj = new Date(rawDate);
      if (isNaN(dObj.getTime())) return false;
      const y = dObj.getFullYear();
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}` === currentMonthKey;
    });
    return hasTxThisMonth;
  };

  // Map last payment per institution
  const lastPaymentByInstitution = useMemo(() => {
    const map = new Map<string, SubTransaction>();
    transactions.forEach(tx => {
      if (!map.has(tx.institution_id)) {
        map.set(tx.institution_id, tx);
      }
    });
    return map;
  }, [transactions]);

  // Top 4 Metrics & Commission Calculation
  const metrics = useMemo(() => {
    const totalPortals = institutions.length;

    let todayCollection = 0;
    let todayCommission = 0;
    let monthCollection = 0;
    let monthCommission = 0;
    let lifetimeCollection = 0;
    let lifetimeCommission = 0;

    transactions.forEach(tx => {
      const { gross, marketerShare } = getTxBreakdown(tx);
      lifetimeCollection = Number((lifetimeCollection + gross).toFixed(2));
      lifetimeCommission = Number((lifetimeCommission + marketerShare).toFixed(2));

      const rawDate = tx.approved_at || tx.created_at || '';
      const dObj = new Date(rawDate);
      if (!isNaN(dObj.getTime())) {
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        const localDateStr = `${y}-${m}-${d}`;
        const localMonthStr = `${y}-${m}`;

        if (localDateStr === todayDateKey) {
          todayCollection = Number((todayCollection + gross).toFixed(2));
          todayCommission = Number((todayCommission + marketerShare).toFixed(2));
        }
        if (localMonthStr === currentMonthKey) {
          monthCollection = Number((monthCollection + gross).toFixed(2));
          monthCommission = Number((monthCommission + marketerShare).toFixed(2));
        }
      }
    });

    const unpaidCount = institutions.filter(inst => !isInstitutionPaidThisMonth(inst)).length;
    const paidCount = totalPortals - unpaidCount;
    const paidPercentage = totalPortals > 0 ? Math.round((paidCount / totalPortals) * 100) : 0;

    return {
      totalPortals,
      todayCollection,
      todayCommission,
      monthCollection,
      monthCommission,
      lifetimeCollection,
      lifetimeCommission,
      unpaidCount,
      paidCount,
      paidPercentage
    };
  }, [institutions, transactions, todayDateKey, currentMonthKey, defaultRate, defaultDeduction]);

  // Filtered Institutions
  const filteredInstitutions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return institutions.filter(inst => {
      const code = (inst.institute_code || inst.config_json?.institute_code || '').toLowerCase();
      const name = (inst.name || '').toLowerCase();
      const phone = (inst.phone || '').toLowerCase();
      const matchesQuery = !q || name.includes(q) || code.includes(q) || phone.includes(q);
      if (!matchesQuery) return false;

      if (statusFilter !== 'all') {
        const isPaid = isInstitutionPaidThisMonth(inst);
        if (statusFilter === 'paid' && !isPaid) return false;
        if (statusFilter === 'unpaid' && isPaid) return false;
      }
      return true;
    });
  }, [institutions, searchQuery, statusFilter, transactions]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const q = collectionSearch.trim().toLowerCase();
    return transactions.filter(tx => {
      const rawDate = tx.approved_at || tx.created_at || '';
      const dObj = new Date(rawDate);
      if (!isNaN(dObj.getTime())) {
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        const localDateStr = `${y}-${m}-${d}`;
        const localMonthStr = `${y}-${m}`;

        if (collectionFilter === 'today' && localDateStr !== todayDateKey) return false;
        if (collectionFilter === 'month' && localMonthStr !== currentMonthKey) return false;
      }

      if (!q) return true;
      const instName = (tx.institution_name || '').toLowerCase();
      const code = (tx.institute_code || '').toLowerCase();
      const trxId = (tx.transaction_id || '').toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      return instName.includes(q) || code.includes(q) || trxId.includes(q) || desc.includes(q);
    });
  }, [transactions, collectionFilter, collectionSearch, todayDateKey, currentMonthKey]);

  // Statement Totals for Filtered Transactions
  const statementTotals = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, tx) => {
        const b = getTxBreakdown(tx);
        acc.gross = Number((acc.gross + b.gross).toFixed(2));
        acc.deduction = Number((acc.deduction + (b.gross > b.deduction ? b.deduction : b.gross)).toFixed(2));
        acc.commissionable = Number((acc.commissionable + b.commissionable).toFixed(2));
        acc.marketerShare = Number((acc.marketerShare + b.marketerShare).toFixed(2));
        return acc;
      },
      { gross: 0, deduction: 0, commissionable: 0, marketerShare: 0 }
    );
  }, [filteredTransactions, defaultRate, defaultDeduction]);

  const formatAmount = (num: number) => {
    return num.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSubscriptionFeeDisplay = (inst: AssignedInstitution) => {
    const customFee = inst.custom_subscription_fee;
    const pkgRate = inst.config_json?.package_rate;
    const fee = customFee !== null && customFee !== undefined && Number(customFee) > 0
      ? Number(customFee)
      : (Number(pkgRate) || 0);
    const subType = inst.config_json?.subscription_type === 'yearly'
      ? (lang === 'bn' ? 'বাৎসরিক' : 'Yearly')
      : (lang === 'bn' ? 'মাসিক' : 'Monthly');

    if (fee <= 0) {
      return lang === 'bn' ? 'নির্ধারিত নয়' : 'Not Set';
    }
    return `৳ ${formatAmount(fee)} (${subType})`;
  };

  const handleCopyTrx = (trxId: string) => {
    if (!trxId) return;
    navigator.clipboard?.writeText(trxId);
    setCopiedTrxId(trxId);
    setTimeout(() => setCopiedTrxId(null), 1800);
  };

  const marketerInitial = (profile?.full_name || 'M').trim().charAt(0).toUpperCase();

  return (
    <div className="flex-1 h-full w-full overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#F4F7FB] text-slate-900 pb-28 md:pb-16 font-noto selection:bg-blue-600 selection:text-white">
      {/* Top Sticky App Bar */}
      <header className="bg-gradient-to-r from-[#0F265C] via-[#1E3A8A] to-[#2563EB] text-white sticky top-0 z-40 shadow-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          {/* Left: Brand & Marketer Identity */}
          <div
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-3 min-w-0 cursor-pointer group"
          >
            <div className="relative shrink-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center font-black text-base sm:text-lg text-white shadow-inner group-hover:scale-105 transition-transform">
                {marketerInitial}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#1E3A8A]" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-white/15 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-blue-100">
                  Deenora Marketer
                </span>
                <ShieldCheck size={13} className="text-emerald-300 shrink-0" />
              </div>
              <h1 className="text-sm sm:text-lg font-black tracking-tight truncate mt-0.5">
                {profile?.full_name || (lang === 'bn' ? 'মার্কেটার পোর্টাল' : 'Marketer Portal')}
              </h1>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {setLang && (
              <button
                onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
                className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-[11px] sm:text-xs font-black tracking-wider uppercase transition-all active:scale-95"
              >
                {lang === 'bn' ? 'EN' : 'বাংলা'}
              </button>
            )}
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing || loading}
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-all active:scale-95 disabled:opacity-50"
              title={lang === 'bn' ? 'রিফ্রেশ করুন' : 'Refresh'}
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onLogout}
              className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl bg-rose-500/90 hover:bg-rose-600 text-white font-black text-[11px] sm:text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
            >
              <LogOut size={14} />
              <span className="hidden xs:inline sm:inline">{lang === 'bn' ? 'লগআউট' : 'Logout'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
        {/* Responsive Marketer Profile, Commission Rate Badge & Monthly Progress Hero Banner */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/70 shadow-sm relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-blue-50/80 pointer-events-none" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Marketer Info & Commission Rate Badge */}
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <UserCheck size={24} />
              </div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-xl font-black text-[#1E3A8A] truncate">
                    {profile?.full_name || (lang === 'bn' ? 'মার্কেটার প্রোফাইল' : 'Marketer Profile')}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                    {lang === 'bn' ? 'সক্রিয়' : 'Active'}
                  </span>
                </div>

                {/* Commission Rate Badge */}
                <div className="inline-flex flex-wrap items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200/80 text-purple-800 text-[11px] sm:text-xs font-black">
                  <Percent size={13} className="text-purple-600 shrink-0" />
                  <span>
                    {lang === 'bn'
                      ? `কমিশন রেট: ${formatAmount(defaultRate)}% (প্রতি পেমেন্টে ৳${formatAmount(defaultDeduction)} সফটওয়্যার ফি বাদ প্রযোজ্য)`
                      : `Commission Rate: ${defaultRate}% (৳${defaultDeduction} software base fee deducted per payment)`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
                  {profile?.permissions?.mobile && (
                    <span className="inline-flex items-center gap-1.5 text-slate-600">
                      <Phone size={12} className="text-[#2563EB]" />
                      {profile.permissions.mobile}
                    </span>
                  )}
                  {profile?.email && (
                    <span className="inline-flex items-center gap-1.5 truncate max-w-[240px] sm:max-w-none">
                      <Mail size={12} className="text-[#2563EB]" />
                      {profile.email}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Monthly Collection Progress Bar */}
            <div className="bg-slate-50 rounded-2xl p-3.5 sm:px-5 sm:py-3.5 border border-slate-100 lg:min-w-[320px]">
              <div className="flex items-center justify-between text-xs font-black mb-1.5">
                <span className="text-slate-500">
                  {lang === 'bn' ? `কালেকশন অগ্রগতি (${currentMonthDisplay})` : `Collection Progress (${currentMonthDisplay})`}
                </span>
                <span className="text-[#2563EB]">
                  {formatAmount(metrics.paidPercentage)}% ({formatAmount(metrics.paidCount)}/{formatAmount(metrics.totalPortals)})
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2563EB] to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, metrics.paidPercentage))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-1.5">
                <span>{lang === 'bn' ? `পরিশোধিত: ${formatAmount(metrics.paidCount)} টি` : `Paid: ${metrics.paidCount}`}</span>
                <span className="text-rose-500">{lang === 'bn' ? `বকেয়া: ${formatAmount(metrics.unpaidCount)} টি` : `Unpaid: ${metrics.unpaidCount}`}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Key Summary Cards (Mobile 2x2 Grid, Desktop 4-Column) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: মোট প্রতিষ্ঠান (Assigned Institutions) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('institutions');
              setStatusFilter('all');
            }}
            className="text-left bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/70 shadow-sm hover:border-blue-300 active:scale-[0.98] transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-[11px] sm:text-xs font-black text-slate-500 leading-snug">
                {lang === 'bn' ? 'মোট প্রতিষ্ঠান' : 'Assigned Institutions'}
              </span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0 group-hover:bg-[#2563EB] group-hover:text-white transition-colors">
                <Building2 size={18} />
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <div className="text-xl sm:text-3xl font-black text-[#1E3A8A] tabular-nums leading-tight">
                {formatAmount(metrics.totalPortals)} <span className="text-xs sm:text-sm font-bold text-slate-400">{lang === 'bn' ? 'টি' : ''}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] sm:text-[11px] font-black">
                <span className="text-emerald-600">
                  {lang === 'bn' ? `পেইড: ${formatAmount(metrics.paidCount)}` : `Paid: ${metrics.paidCount}`}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-rose-500">
                  {lang === 'bn' ? `আনপেইড: ${formatAmount(metrics.unpaidCount)}` : `Unpaid: ${metrics.unpaidCount}`}
                </span>
              </div>
            </div>
          </button>

          {/* Card 2: চলতি মাসের মোট কালেকশন (This Month's Collection) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('collections');
              setCollectionFilter('month');
            }}
            className="text-left bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/70 shadow-sm hover:border-indigo-300 active:scale-[0.98] transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-[11px] sm:text-xs font-black text-slate-500 leading-snug">
                {lang === 'bn' ? 'চলতি মাসের মোট কালেকশন' : "This Month's Collection"}
              </span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <div className="text-xl sm:text-3xl font-black text-indigo-600 tabular-nums leading-tight">
                ৳ {formatAmount(metrics.monthCollection)}
              </div>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 mt-1.5 truncate">
                {lang === 'bn'
                  ? `আজকের পেমেন্ট: ৳ ${formatAmount(metrics.todayCollection)}`
                  : `Today: ৳ ${formatAmount(metrics.todayCollection)}`}
              </p>
            </div>
          </button>

          {/* Card 3: আমার কমিশন/আয় (Total Earnings) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('collections');
              setCollectionFilter('month');
            }}
            className="text-left bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-emerald-200/90 shadow-sm hover:border-emerald-400 active:scale-[0.98] transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-[11px] sm:text-xs font-black text-emerald-800 leading-snug">
                {lang === 'bn' ? 'আমার কমিশন / আয়' : 'My Commission / Earnings'}
              </span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs shadow-emerald-600/20">
                <Wallet size={18} />
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <div className="text-xl sm:text-3xl font-black text-emerald-600 tabular-nums leading-tight">
                ৳ {formatAmount(metrics.monthCommission)}
              </div>
              <p className="text-[10px] sm:text-[11px] font-black text-emerald-700/80 mt-1.5 truncate">
                {lang === 'bn'
                  ? `সর্বমোট আয়: ৳ ${formatAmount(metrics.lifetimeCommission)}`
                  : `Lifetime: ৳ ${formatAmount(metrics.lifetimeCommission)}`}
              </p>
            </div>
          </button>

          {/* Card 4: বকেয়া তালিকা ও ফলো-আপ (Unpaid / Due List) */}
          <button
            type="button"
            onClick={() => {
              setActiveTab('institutions');
              setStatusFilter('unpaid');
            }}
            className="text-left bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/70 shadow-sm hover:border-rose-300 active:scale-[0.98] transition-all flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between gap-2 w-full">
              <span className="text-[11px] sm:text-xs font-black text-slate-500 leading-snug">
                {lang === 'bn' ? 'বকেয়া প্রতিষ্ঠান (ফলো-আপ)' : 'Due / Unpaid List'}
              </span>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <AlertCircle size={18} />
              </div>
            </div>
            <div className="mt-3 sm:mt-4">
              <div className="text-xl sm:text-3xl font-black text-rose-600 tabular-nums leading-tight">
                {formatAmount(metrics.unpaidCount)} <span className="text-xs sm:text-sm font-bold text-rose-400">{lang === 'bn' ? 'টি' : ''}</span>
              </div>
              <p className="text-[10px] sm:text-[11px] font-bold text-rose-500 mt-1.5 flex items-center gap-1">
                <ArrowUpRight size={11} />
                {lang === 'bn' ? 'বকেয়া তালিকা দেখুন' : 'View unpaid list'}
              </p>
            </div>
          </button>
        </div>

        {/* Desktop & Tablet Segmented Navigation Bar */}
        <div className="hidden md:flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/70 shadow-sm">
          <button
            onClick={() => setActiveTab('institutions')}
            className={`px-5 py-3 rounded-xl font-black text-sm flex items-center gap-2.5 transition-all ${
              activeTab === 'institutions'
                ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Building2 size={17} />
            <span>{lang === 'bn' ? 'প্রতিষ্ঠান ও বকেয়া তালিকা' : 'Institutions & Due List'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] ${
              activeTab === 'institutions' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {formatAmount(institutions.length)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('collections')}
            className={`px-5 py-3 rounded-xl font-black text-sm flex items-center gap-2.5 transition-all ${
              activeTab === 'collections'
                ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText size={17} />
            <span>{lang === 'bn' ? 'পেমেন্ট ও কমিশন স্টেটমেন্ট' : 'Payment & Commission Statement'}</span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] ${
              activeTab === 'collections' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {formatAmount(transactions.length)}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`px-5 py-3 rounded-xl font-black text-sm flex items-center gap-2.5 transition-all ${
              activeTab === 'profile'
                ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <User size={17} />
            <span>{lang === 'bn' ? 'আমার প্রোফাইল ও কমিশন নিয়ম' : 'My Profile & Commission Rules'}</span>
          </button>
        </div>

        {/* Main View Area */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 sm:p-16 border border-slate-200/70 shadow-sm flex flex-col items-center justify-center text-slate-400">
            <RefreshCw size={32} className="animate-spin text-[#2563EB] mb-3" />
            <p className="text-xs font-black uppercase tracking-widest">
              {lang === 'bn' ? 'ডাটা লোড হচ্ছে...' : 'Loading Marketer Data...'}
            </p>
          </div>
        ) : activeTab === 'institutions' ? (
          /* TAB 1: INSTITUTION DIRECTORY & UNPAID FOLLOW-UP LIST */
          <div className="space-y-4">
            {/* Search & Filter Control Card */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/70 shadow-sm space-y-3.5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#1E3A8A]">
                    {statusFilter === 'unpaid'
                      ? (lang === 'bn' ? 'বকেয়া প্রতিষ্ঠানের তালিকা (চলতি মাস)' : 'Unpaid Institutions List (Current Month)')
                      : (lang === 'bn' ? 'অ্যাসাইনকৃত প্রতিষ্ঠান তালিকা' : 'Assigned Institutions Directory')}
                  </h3>
                  <p className="text-[11px] sm:text-xs font-bold text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? `মোট ${formatAmount(filteredInstitutions.length)} টি প্রতিষ্ঠান দেখানো হচ্ছে`
                      : `Showing ${filteredInstitutions.length} institutions`}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative flex-1 sm:min-w-[250px]">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={lang === 'bn' ? 'নাম, কোড বা ফোন নম্বর খুঁজুন...' : 'Search name, code, phone...'}
                      className="w-full h-11 pl-10 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-[#2563EB] transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Status Filter Pills */}
                  <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl shrink-0">
                    {[
                      { id: 'all', label: lang === 'bn' ? `সকল (${formatAmount(institutions.length)})` : `All (${institutions.length})` },
                      { id: 'paid', label: lang === 'bn' ? `পরিশোধিত (${formatAmount(metrics.paidCount)})` : `Paid (${metrics.paidCount})` },
                      { id: 'unpaid', label: lang === 'bn' ? `বকেয়া (${formatAmount(metrics.unpaidCount)})` : `Due (${metrics.unpaidCount})` }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setStatusFilter(tab.id as any)}
                        className={`px-2.5 sm:px-3 py-2 rounded-lg text-[11px] font-black transition-all text-center ${
                          statusFilter === tab.id
                            ? tab.id === 'unpaid'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-white text-[#1E3A8A] shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {filteredInstitutions.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-200/70 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Building2 size={28} />
                </div>
                <h4 className="text-sm font-black text-slate-700">
                  {lang === 'bn' ? 'কোনো প্রতিষ্ঠান পাওয়া যায়নি' : 'No Institutions Found'}
                </h4>
                <p className="text-xs font-bold text-slate-400 mt-1 max-w-sm mx-auto">
                  {lang === 'bn'
                    ? 'আপনার নামে এখনো কোনো প্রতিষ্ঠান অ্যাসাইন করা হয়নি অথবা সার্চ ফিল্টারের সাথে মিলেনি।'
                    : 'No institutions match your current filter criteria.'}
                </p>
              </div>
            ) : (
              <>
                {/* MOBILE CARD LIST (Visible on Mobile < md) */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {filteredInstitutions.map(inst => {
                    const code = inst.institute_code || inst.config_json?.institute_code || '';
                    const isPaid = isInstitutionPaidThisMonth(inst);
                    const lastTx = lastPaymentByInstitution.get(inst.id);
                    const instRate = Number(inst.config_json?.marketer_commission_rate ?? defaultRate);

                    return (
                      <div
                        key={inst.id}
                        className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3.5"
                      >
                        {/* Top Row: Avatar, Name/Code, and Status Badge */}
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] font-black text-sm flex items-center justify-center shrink-0">
                              {inst.name?.[0] || 'M'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {code && (
                                  <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#2563EB] font-mono text-[10px] font-black border border-blue-100">
                                    #{code}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-black border border-purple-100">
                                  কমিশন: {formatAmount(instRate)}%
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                  <Calendar size={10} /> {formatDate(inst.created_at)}
                                </span>
                              </div>
                              <h4 className="font-black text-[#1E3A8A] text-sm leading-snug mt-1 break-words">
                                {inst.name}
                              </h4>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                                <CheckCircle2 size={11} className="text-emerald-600" />
                                {lang === 'bn' ? 'পরিশোধিত' : 'Paid'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black">
                                <AlertCircle size={11} className="text-rose-600" />
                                {lang === 'bn' ? 'বকেয়া' : 'Unpaid'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Middle Info Grid: Fee & Last Payment */}
                        <div className="grid grid-cols-2 gap-2.5 bg-slate-50/90 p-3 rounded-xl border border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">
                              {lang === 'bn' ? 'সাবস্ক্রিপশন ফি' : 'Subscription Fee'}
                            </span>
                            <span className="font-black text-slate-700 mt-0.5 block">
                              {getSubscriptionFeeDisplay(inst)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 block">
                              {lang === 'bn' ? 'সর্বশেষ পেমেন্ট ও কমিশন' : 'Last Payment & Earned'}
                            </span>
                            {lastTx ? (
                              <span className="font-black text-emerald-600 mt-0.5 block">
                                ৳ {formatAmount(Number(lastTx.amount) || 0)}{' '}
                                <span className="text-purple-600 text-[10px]">
                                  (আয়: ৳{formatAmount(getTxBreakdown(lastTx).marketerShare)})
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 block">
                                  {formatDate(lastTx.approved_at || lastTx.created_at)}
                                </span>
                              </span>
                            ) : (
                              <span className="font-bold text-slate-400 mt-0.5 block text-[11px]">
                                {lang === 'bn' ? 'কোনো রেকর্ড নেই' : 'None'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Row: Phone & Quick Call Button */}
                        {inst.phone && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                              <Phone size={13} className="text-slate-400" />
                              {inst.phone}
                            </span>
                            <a
                              href={`tel:${inst.phone}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#2563EB] font-black text-[11px] transition-colors active:scale-95"
                            >
                              <Phone size={12} />
                              {lang === 'bn' ? 'কল করুন' : 'Call Now'}
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP TABLE (Visible on md+) */}
                <div className="hidden md:block bg-white rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          <th className="py-4 px-6">{lang === 'bn' ? 'প্রতিষ্ঠানের নাম ও কোড' : 'Institution Name & Code'}</th>
                          <th className="py-4 px-4">{lang === 'bn' ? 'যোগদানের তারিখ' : 'Joined Date'}</th>
                          <th className="py-4 px-4">{lang === 'bn' ? 'সাবস্ক্রিপশন ফি' : 'Subscription Fee'}</th>
                          <th className="py-4 px-4">{lang === 'bn' ? 'কমিশন রেট' : 'Commission %'}</th>
                          <th className="py-4 px-4">{lang === 'bn' ? 'চলতি মাসের অবস্থা' : 'Current Month Status'}</th>
                          <th className="py-4 px-6 text-right">{lang === 'bn' ? 'সর্বশেষ পেমেন্ট ও আয়' : 'Last Payment & Earned'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredInstitutions.map(inst => {
                          const code = inst.institute_code || inst.config_json?.institute_code || '';
                          const isPaid = isInstitutionPaidThisMonth(inst);
                          const lastTx = lastPaymentByInstitution.get(inst.id);
                          const instRate = Number(inst.config_json?.marketer_commission_rate ?? defaultRate);

                          return (
                            <tr key={inst.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-4 px-6">
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] font-black text-sm flex items-center justify-center shrink-0 mt-0.5">
                                    {inst.name?.[0] || 'M'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {code && (
                                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#2563EB] font-mono text-[11px] font-black border border-blue-100">
                                          #{code}
                                        </span>
                                      )}
                                      <span className="font-black text-[#1E3A8A] text-sm">
                                        {inst.name}
                                      </span>
                                    </div>
                                    {inst.phone && (
                                      <a
                                        href={`tel:${inst.phone}`}
                                        className="text-xs font-bold text-slate-400 hover:text-[#2563EB] mt-0.5 inline-flex items-center gap-1 transition-colors"
                                      >
                                        <Phone size={11} /> {inst.phone}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </td>

                              <td className="py-4 px-4 font-bold text-slate-600 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <Calendar size={14} className="text-slate-400" />
                                  <span>{formatDate(inst.created_at)}</span>
                                </div>
                              </td>

                              <td className="py-4 px-4 font-black text-slate-700 whitespace-nowrap">
                                {getSubscriptionFeeDisplay(inst)}
                              </td>

                              <td className="py-4 px-4 whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-black">
                                  {formatAmount(instRate)}%
                                </span>
                              </td>

                              <td className="py-4 px-4 whitespace-nowrap">
                                {isPaid ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black">
                                    <CheckCircle2 size={13} className="text-emerald-600" />
                                    {lang === 'bn' ? 'পরিশোধিত' : 'Paid'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black">
                                    <AlertCircle size={13} className="text-rose-600" />
                                    {lang === 'bn' ? 'বকেয়া / Due' : 'Unpaid / Due'}
                                  </span>
                                )}
                              </td>

                              <td className="py-4 px-6 text-right whitespace-nowrap">
                                {lastTx ? (
                                  <div>
                                    <span className="font-black text-slate-800">
                                      ৳ {formatAmount(Number(lastTx.amount) || 0)}
                                    </span>
                                    <span className="ml-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black">
                                      +৳ {formatAmount(getTxBreakdown(lastTx).marketerShare)}
                                    </span>
                                    <span className="block text-[11px] font-bold text-slate-400">
                                      {formatDate(lastTx.approved_at || lastTx.created_at)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs font-bold text-slate-400">
                                    {lang === 'bn' ? 'কোনো পেমেন্ট নেই' : 'No payments yet'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : activeTab === 'collections' ? (
          /* TAB 2: TRANSPARENT PAYMENT & COMMISSION STATEMENT */
          <div className="space-y-4">
            {/* Filter Header & Live Commission Summary Bar */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200/70 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#1E3A8A]">
                    {lang === 'bn' ? 'প্রতিষ্ঠান ভিত্তিক পেমেন্ট ও কমিশন স্টেটমেন্ট' : 'Institution Payment & Commission Statement'}
                  </h3>
                  <p className="text-[11px] sm:text-xs font-bold text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? `প্রতিটি পেমেন্ট থেকে ৳${formatAmount(defaultDeduction)} সফটওয়্যার ফি বাদে অবশিষ্ট টাকার উপর আপনার নির্ধারিত কমিশন হিসাব`
                      : `Transparent commission breakdown after deducting ৳${defaultDeduction} base software cost per payment`}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative flex-1 sm:min-w-[240px]">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={collectionSearch}
                      onChange={e => setCollectionSearch(e.target.value)}
                      placeholder={lang === 'bn' ? 'প্রতিষ্ঠান বা TrxID খুঁজুন...' : 'Search institution or TrxID...'}
                      className="w-full h-11 pl-10 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-[#2563EB] transition-all"
                    />
                    {collectionSearch && (
                      <button
                        onClick={() => setCollectionSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Period Filter Buttons */}
                  <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl shrink-0">
                    {[
                      { id: 'today', label: lang === 'bn' ? 'আজকের' : 'Today' },
                      { id: 'month', label: lang === 'bn' ? 'চলতি মাস' : 'This Month' },
                      { id: 'all', label: lang === 'bn' ? 'সর্বমোট' : 'All Time' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setCollectionFilter(tab.id as any)}
                        className={`px-3 py-2 rounded-lg text-[11px] font-black transition-all text-center ${
                          collectionFilter === tab.id
                            ? 'bg-white text-[#1E3A8A] shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filtered Statement Totals Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 pt-2 border-t border-slate-100">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
                  <span className="text-[10px] font-black text-slate-400 uppercase block">
                    {lang === 'bn' ? 'মোট পেমেন্ট (Gross)' : 'Gross Collection'}
                  </span>
                  <span className="text-sm sm:text-base font-black text-slate-800 mt-0.5 block">
                    ৳ {formatAmount(statementTotals.gross)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/60">
                  <span className="text-[10px] font-black text-amber-700/80 uppercase block">
                    {lang === 'bn' ? 'সফটওয়্যার খরচ কর্তন' : 'Base Cost Deducted'}
                  </span>
                  <span className="text-sm sm:text-base font-black text-amber-700 mt-0.5 block">
                    - ৳ {formatAmount(statementTotals.deduction)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200/60">
                  <span className="text-[10px] font-black text-blue-700/80 uppercase block">
                    {lang === 'bn' ? 'মোট লভ্যাংশযোগ্য টাকা' : 'Commissionable Amount'}
                  </span>
                  <span className="text-sm sm:text-base font-black text-[#2563EB] mt-0.5 block">
                    ৳ {formatAmount(statementTotals.commissionable)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-black text-emerald-700 uppercase block">
                    {lang === 'bn' ? 'আমার মোট কমিশন / আয়' : 'My Total Commission'}
                  </span>
                  <span className="text-sm sm:text-base font-black text-emerald-600 mt-0.5 block">
                    ৳ {formatAmount(statementTotals.marketerShare)}
                  </span>
                </div>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-slate-200/70 shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Clock size={28} />
                </div>
                <h4 className="text-sm font-black text-slate-700">
                  {lang === 'bn' ? 'কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি' : 'No Payment Records Found'}
                </h4>
                <p className="text-xs font-bold text-slate-400 mt-1 max-w-sm mx-auto">
                  {lang === 'bn'
                    ? 'নির্বাচিত সময়ের মধ্যে কোনো অনুমোদিত সাবস্ক্রিপশন পেমেন্ট পাওয়া যায়নি।'
                    : 'No approved subscription payments found for the selected time range.'}
                </p>
              </div>
            ) : (
              <>
                {/* MOBILE CARD LIST FOR STATEMENT (Visible on < md) */}
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {filteredTransactions.map(tx => {
                    const b = getTxBreakdown(tx);
                    return (
                      <div
                        key={tx.id}
                        className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {tx.institute_code && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#2563EB] font-mono text-[10px] font-black border border-blue-100">
                                  #{tx.institute_code}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-slate-400">
                                {formatDateTime(tx.approved_at || tx.created_at)}
                              </span>
                            </div>
                            <h4 className="font-black text-[#1E3A8A] text-sm mt-1 break-words">
                              {tx.institution_name}
                            </h4>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-black text-emerald-700 uppercase block">
                              {lang === 'bn' ? 'মার্কেটারের আয়' : 'My Share'}
                            </span>
                            <div className="text-base font-black text-emerald-600 tabular-nums">
                              + ৳ {formatAmount(b.marketerShare)}
                            </div>
                          </div>
                        </div>

                        {/* Step-by-step Transparent Formula Grid */}
                        <div className="grid grid-cols-4 gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-center">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 block">পেমেন্ট</span>
                            <span className="text-xs font-black text-slate-700">৳{formatAmount(b.gross)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-amber-600 block">সফটওয়্যার ফি</span>
                            <span className="text-xs font-black text-amber-600">-৳{formatAmount(b.gross > b.deduction ? b.deduction : b.gross)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-blue-600 block">লভ্যাংশযোগ্য</span>
                            <span className="text-xs font-black text-[#2563EB]">৳{formatAmount(b.commissionable)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-purple-600 block">কমিশন %</span>
                            <span className="text-xs font-black text-purple-700">{formatAmount(b.rate)}%</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                          <span className="text-slate-500 font-bold truncate max-w-[60%]">
                            {tx.description || (lang === 'bn' ? 'সাবস্ক্রিপশন পেমেন্ট' : 'Subscription Payment')}
                          </span>

                          {tx.transaction_id && (
                            <button
                              type="button"
                              onClick={() => handleCopyTrx(tx.transaction_id)}
                              className="inline-flex items-center gap-1 font-mono text-[10px] font-black text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 active:scale-95 transition-transform"
                            >
                              <span>TrxID: {tx.transaction_id}</span>
                              {copiedTrxId === tx.transaction_id ? (
                                <Check size={11} className="text-emerald-600" />
                              ) : (
                                <Copy size={11} className="text-slate-400" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* DESKTOP 7-COLUMN TRANSPARENT STATEMENT TABLE (Visible on md+) */}
                <div className="hidden md:block bg-white rounded-3xl border border-slate-200/70 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                          <th className="py-4 px-5">{lang === 'bn' ? 'প্রতিষ্ঠানের নাম' : 'Institution Name'}</th>
                          <th className="py-4 px-4">{lang === 'bn' ? 'পেমেন্টের তারিখ ও বিবরণ' : 'Date & Description'}</th>
                          <th className="py-4 px-4 text-right">{lang === 'bn' ? 'পেমেন্ট পরিমাণ' : 'Gross Payment'}</th>
                          <th className="py-4 px-4 text-right">{lang === 'bn' ? 'সফটওয়্যার খরচ কর্তন' : 'Base Deduction'}</th>
                          <th className="py-4 px-4 text-right">{lang === 'bn' ? 'লভ্যাংশযোগ্য টাকা' : 'Commissionable'}</th>
                          <th className="py-4 px-4 text-center">{lang === 'bn' ? 'নির্ধারিত পার্সেন্টেজ' : 'Rate (%)'}</th>
                          <th className="py-4 px-5 text-right">{lang === 'bn' ? 'মার্কেটারের আয়' : 'Marketer Share'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {filteredTransactions.map(tx => {
                          const b = getTxBreakdown(tx);
                          return (
                            <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-4 px-5">
                                <div className="flex items-center gap-2">
                                  {tx.institute_code && (
                                    <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#2563EB] font-mono text-[11px] font-black border border-blue-100">
                                      #{tx.institute_code}
                                    </span>
                                  )}
                                  <span className="font-black text-[#1E3A8A]">
                                    {tx.institution_name}
                                  </span>
                                </div>
                                {tx.transaction_id && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyTrx(tx.transaction_id)}
                                    className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] font-bold text-slate-400 hover:text-slate-600"
                                  >
                                    <span>TrxID: {tx.transaction_id}</span>
                                    {copiedTrxId === tx.transaction_id ? (
                                      <Check size={11} className="text-emerald-600" />
                                    ) : (
                                      <Copy size={11} />
                                    )}
                                  </button>
                                )}
                              </td>

                              <td className="py-4 px-4 whitespace-nowrap">
                                <span className="font-bold text-slate-700 block">
                                  {formatDateTime(tx.approved_at || tx.created_at)}
                                </span>
                                <span className="text-xs font-bold text-slate-400 block max-w-[220px] truncate">
                                  {tx.description || (lang === 'bn' ? 'সাবস্ক্রিপশন পেমেন্ট' : 'Subscription Payment')}
                                </span>
                              </td>

                              <td className="py-4 px-4 text-right font-black text-slate-800 whitespace-nowrap tabular-nums">
                                ৳ {formatAmount(b.gross)}
                              </td>

                              <td className="py-4 px-4 text-right font-black text-amber-600 whitespace-nowrap tabular-nums">
                                - ৳ {formatAmount(b.gross > b.deduction ? b.deduction : b.gross)}
                              </td>

                              <td className="py-4 px-4 text-right font-black text-[#2563EB] whitespace-nowrap tabular-nums">
                                ৳ {formatAmount(b.commissionable)}
                              </td>

                              <td className="py-4 px-4 text-center whitespace-nowrap">
                                <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-black">
                                  {formatAmount(b.rate)}%
                                </span>
                              </td>

                              <td className="py-4 px-5 text-right whitespace-nowrap">
                                <span className="inline-flex items-center px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-black text-sm tabular-nums">
                                  + ৳ {formatAmount(b.marketerShare)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* TAB 3: MARKETER PROFILE & COMMISSION FORMULA GUIDE */
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-white rounded-3xl p-5 sm:p-8 border border-slate-200/70 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left pb-5 border-b border-slate-100">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#0F265C] via-[#1E3A8A] to-[#2563EB] text-white font-black text-3xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  {marketerInitial}
                </div>
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black">
                    <Sparkles size={12} />
                    {lang === 'bn' ? 'অফিসিয়াল মার্কেটার অ্যাকাউন্ট' : 'Official Marketer Account'}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-[#1E3A8A]">
                    {profile?.full_name || 'Marketer'}
                  </h3>
                  <p className="text-xs font-bold text-slate-400">
                    {profile?.email || ''}
                  </p>
                </div>
              </div>

              {/* Commission Formula Explanation Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-purple-50/60 border border-blue-200/70 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-xs sm:text-sm font-black text-[#1E3A8A] flex items-center gap-1.5">
                    <Percent size={16} className="text-[#2563EB]" />
                    {lang === 'bn' ? 'আপনার কমিশন ও রেভিনিউ শেয়ারিং নিয়ম' : 'Your Commission & Revenue Sharing Formula'}
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#2563EB] text-white text-[11px] font-black">
                    {formatAmount(defaultRate)}% কমিশন
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-600 space-y-1.5 leading-relaxed">
                  <p>
                    ১. <strong>সফটওয়্যার খরচ কর্তন (Base Cost Deduction):</strong> প্রতিষ্ঠানের প্রতিটি পেমেন্ট থেকে প্রথমে সফটওয়্যার ও সার্ভার খরচ বাবদ <strong>৳ {formatAmount(defaultDeduction)}</strong> বাদ দেওয়া হয়।
                  </p>
                  <p>
                    ২. <strong>লভ্যাংশযোগ্য টাকা (Commissionable Amount):</strong> মোট পেমেন্ট থেকে ৳ {formatAmount(defaultDeduction)} বাদ দেওয়ার পর অবশিষ্ট টাকার উপর আপনার নির্ধারিত <strong>{formatAmount(defaultRate)}%</strong> কমিশন হিসাব হয়।
                  </p>
                  <p className="text-emerald-700 bg-white/90 p-2.5 rounded-xl border border-emerald-200/80 mt-2">
                    📌 <strong>উদাহরণ (৳৫০০ পেমেন্ট হলে):</strong> ৳৫০০ - ৳{formatAmount(defaultDeduction)} = ৳{formatAmount(Math.max(0, 500 - defaultDeduction))} লভ্যাংশযোগ্য টাকা → {formatAmount(defaultRate)}% কমিশন = <strong>৳ {formatAmount(Number(((Math.max(0, 500 - defaultDeduction) * defaultRate) / 100).toFixed(2)))} আপনার আয়</strong>।
                  </p>
                </div>
              </div>

              {/* Profile Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
                  </span>
                  <span className="text-sm font-black text-slate-800 mt-1 block">
                    {profile?.permissions?.mobile || (lang === 'bn' ? 'যুক্ত করা হয়নি' : 'Not provided')}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    {lang === 'bn' ? 'লগইন ইমেইল' : 'Login Email'}
                  </span>
                  <span className="text-sm font-black text-slate-800 mt-1 block break-all">
                    {profile?.email || '-'}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider block">
                    {lang === 'bn' ? 'সর্বমোট কালেকশন (Lifetime Gross)' : 'Lifetime Gross Collection'}
                  </span>
                  <span className="text-lg font-black text-[#1E3A8A] mt-1 block tabular-nums">
                    ৳ {formatAmount(metrics.lifetimeCollection)}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">
                    {lang === 'bn' ? 'সর্বমোট অর্জিত কমিশন (Lifetime Earnings)' : 'Lifetime Earned Commission'}
                  </span>
                  <span className="text-lg font-black text-emerald-700 mt-1 block tabular-nums">
                    ৳ {formatAmount(metrics.lifetimeCommission)}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onLogout}
                  className="w-full py-3.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-sm flex items-center justify-center gap-2 border border-rose-200 transition-all active:scale-95"
                >
                  <LogOut size={16} />
                  {lang === 'bn' ? 'অ্যাকাউন্ট থেকে লগআউট করুন' : 'Sign Out from Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar (Visible on Mobile < md) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(15,38,92,0.06)] px-3 py-2">
        <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('institutions')}
            className={`py-2 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'institutions'
                ? 'bg-blue-50 text-[#2563EB] font-black'
                : 'text-slate-400 font-bold hover:text-slate-600'
            }`}
          >
            <Building2 size={18} />
            <span className="text-[10px] leading-none">
              {lang === 'bn' ? `প্রতিষ্ঠান (${formatAmount(institutions.length)})` : `Portals (${institutions.length})`}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('collections')}
            className={`py-2 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'collections'
                ? 'bg-blue-50 text-[#2563EB] font-black'
                : 'text-slate-400 font-bold hover:text-slate-600'
            }`}
          >
            <FileText size={18} />
            <span className="text-[10px] leading-none">
              {lang === 'bn' ? 'কমিশন স্টেটমেন্ট' : 'Statement'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-2 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all ${
              activeTab === 'profile'
                ? 'bg-blue-50 text-[#2563EB] font-black'
                : 'text-slate-400 font-bold hover:text-slate-600'
            }`}
          >
            <User size={18} />
            <span className="text-[10px] leading-none">
              {lang === 'bn' ? 'প্রোফাইল ও নিয়ম' : 'Profile'}
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default MarketerPortal;
