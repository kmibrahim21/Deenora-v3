import React, { useState, useEffect, useRef } from 'react';
import { 
  CreditCard, 
  Smartphone, 
  ChevronRight, 
  ChevronLeft, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { Institution, Language, Transaction, SystemSettings } from '../types';

interface PaymentCheckoutProps {
  lang: Language;
  madrasah: Institution;
  module: 'sms' | 'voice' | 'subscription';
  initialAmount?: number;
  fixedAmount?: number;
  onSuccess: (trx: Transaction) => void;
  onCancel: () => void;
  metadata?: any;
}

type CheckoutStep = 'amount' | 'method' | 'number' | 'pay' | 'verify' | 'success' | 'failed';

const PaymentCheckout: React.FC<PaymentCheckoutProps> = ({ 
  lang, 
  madrasah, 
  module, 
  initialAmount = 0, 
  fixedAmount,
  onSuccess, 
  onCancel,
  metadata = {}
}) => {
  const effectiveAmount = fixedAmount || initialAmount;
  const [step, setStep] = useState<CheckoutStep>('amount');
  const [amount, setAmount] = useState(effectiveAmount > 0 ? effectiveAmount.toString() : '');

  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'test' | null>(null);
  const [senderPhone, setSenderPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingTrx, setPendingTrx] = useState<Transaction | null>(null);
  const [adminBkash, setAdminBkash] = useState('');
  const [adminNagad, setAdminNagad] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const pollingInterval = useRef<any>(null);

  const storageKey = `pending_payment_${madrasah?.id}_${module}`;

  // Keep amount in sync with fixedAmount if provided, especially for subscription
  useEffect(() => {
    if (fixedAmount && fixedAmount > 0 && step === 'amount' && !pendingTrx) {
      setAmount(fixedAmount.toString());
    }
  }, [fixedAmount, step, pendingTrx]);

  // Restore pending payment on mount
  useEffect(() => {
    const restorePendingPayment = async () => {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.pendingTrx?.id) {
            const { data, error } = await supabase
              .from('transactions')
              .select('*')
              .eq('id', parsed.pendingTrx.id)
              .single();

            if (data) {
              if (data.status === 'pending') {
                setAmount(parsed.amount || '');
                setPaymentMethod(parsed.paymentMethod || null);
                setSenderPhone(parsed.senderPhone || '');
                setPendingTrx(data as Transaction);
                setStep(parsed.step || 'pay');
              } else if (data.status === 'approved') {
                setAmount(parsed.amount || '');
                setPaymentMethod(parsed.paymentMethod || null);
                setSenderPhone(parsed.senderPhone || '');
                setPendingTrx(data as Transaction);
                setStep('success');
              } else {
                localStorage.removeItem(storageKey);
              }
            } else {
              localStorage.removeItem(storageKey);
            }
          }
        } catch (err) {
          console.error('Error restoring pending payment:', err);
          localStorage.removeItem(storageKey);
        }
      }
    };

    restorePendingPayment();
  }, [madrasah?.id, module, storageKey]);

  // Save to localStorage when step/pendingTrx/etc changes
  useEffect(() => {
    if (step === 'pay' || step === 'verify') {
      if (pendingTrx) {
        localStorage.setItem(storageKey, JSON.stringify({
          step,
          pendingTrx,
          paymentMethod,
          senderPhone,
          amount
        }));
      }
    } else if (step === 'success' || step === 'failed' || step === 'amount') {
      localStorage.removeItem(storageKey);
    }
  }, [step, pendingTrx, paymentMethod, senderPhone, amount, storageKey]);

  const handleCancelTransaction = async () => {
    if (pendingTrx) {
      try {
        setIsProcessing(true);
        await supabase
          .from('transactions')
          .update({ 
            status: 'cancelled',
            description: lang === 'bn' ? 'গ্রাহক দ্বারা পেমেন্ট বাতিল করা হয়েছে।' : 'Payment cancelled by the user.'
          })
          .eq('id', pendingTrx.id);
      } catch (err) {
        console.error('Error cancelling transaction in supabase:', err);
      }
    }
    
    localStorage.removeItem(storageKey);
    
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    setPendingTrx(null);
    setStep('amount');
    setIsProcessing(false);
  };

  useEffect(() => {
    const fetchAdminSettings = async () => {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('*')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .single();

        if (data) {
          setAdminBkash(data.bkash_number || '');
          setSystemSettings(data as any);
          // @ts-ignore
          setAdminNagad(data.nagad_number || data.bkash_number || '');
        }
      } catch (err) {
        console.error('Error fetching admin settings:', err);
      }
    };
    fetchAdminSettings();
  }, []);

  useEffect(() => {
    let intervalId: any;
    
    if ((step === 'verify' || step === 'pay') && pendingTrx?.id) {
      console.log('[PaymentCheckout] Starting polling for transaction:', pendingTrx.id);
      
      const poll = async () => {
        try {
          const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', pendingTrx.id)
            .single();
          
          if (error) {
            console.error('[PaymentCheckout] Polling error:', error);
            return;
          }
          
          if (data) {
            const currentStatus = data.status?.toLowerCase();
            console.log('[PaymentCheckout] Transaction status:', currentStatus);
            
            if (currentStatus === 'approved') {
              console.log('[PaymentCheckout] Transaction APPROVED! Switching to success step.');
              if (intervalId) clearInterval(intervalId);
              setPendingTrx(data as Transaction);
              setStep('success');
            } else if (currentStatus === 'rejected') {
              console.log('[PaymentCheckout] Transaction REJECTED.');
              if (intervalId) clearInterval(intervalId);
              setStep('failed');
              const reason = data.description || '';
              setError(reason || (lang === 'bn' ? 'পেমেন্ট বাতিল করা হয়েছে।' : 'Your payment has been rejected.'));
            }
          }
        } catch (err) {
          console.error('[PaymentCheckout] Polling exception:', err);
        }
      };

      // Initial poll
      poll();
      
      // Start interval
      intervalId = setInterval(poll, 3000);
    }

    return () => {
      if (intervalId) {
        console.log('[PaymentCheckout] Cleaning up polling interval');
        clearInterval(intervalId);
      }
    };
  }, [step, pendingTrx?.id, lang]);

  const normalizePhone = (phone: string) => {
    let clean = phone.replace(/[^\d]/g, '');
    if (clean.startsWith('880')) {
      clean = clean.substring(2);
    } else if (clean.startsWith('0')) {
      // Keep as is
    } else if (clean.length === 10) {
      clean = '0' + clean;
    }
    return clean;
  };

  const handleCreateSession = async () => {
    if (!paymentMethod || !senderPhone || !amount) return;
    setIsProcessing(true);
    setError(null);

    const normalizedSender = normalizePhone(senderPhone);
    if (normalizedSender.length !== 11) {
      setError(lang === 'bn' ? 'সঠিক ১১ ডিজিটের নম্বর দিন' : 'Enter a valid 11-digit number');
      setIsProcessing(false);
      return;
    }

    try {
      const isSubscription = module === 'subscription';
      const parsedAmount = parseInt(amount);

      let smsCount = null;
      if (module === 'sms' && systemSettings) {
        const providerConfig = (systemSettings.sms_provider_config as any) || {};
        const defaultType = providerConfig.default_type || 'non_masking';
        
        // Calculate rate: Prefer specific masking/non-masking rate from provider config, then institution-specific sms_rate, then global system default
        const isMaskingAccount = !!madrasah.reve_client_id;
        const instSmsType = isMaskingAccount ? 'masking' : ((madrasah as any).sms_type || defaultType);
        
        let rate = 0;
        if (instSmsType === 'masking' && providerConfig.masking_rate) {
          rate = Number(providerConfig.masking_rate);
        } else if (instSmsType === 'non_masking' && providerConfig.non_masking_rate) {
          rate = Number(providerConfig.non_masking_rate);
        }
        
        if (!rate || rate <= 0) {
          rate = Number(madrasah.sms_rate);
          if (!rate || rate <= 0) {
            // Ultimate fallback
            rate = Number(systemSettings.sms_rate || 0.5);
          }
        }
        
        smsCount = Math.ceil(parsedAmount / rate);
      }

      const { data, error } = await supabase.from('transactions').insert({
        institution_id: madrasah.id,
        amount: parsedAmount,
        transaction_id: `PENDING_${Date.now()}`,
        description: isSubscription 
          ? `Subscription Payment via ${paymentMethod.toUpperCase()}`
          : `${module.toUpperCase()} Recharge via ${paymentMethod.toUpperCase()}`,
        type: 'credit',
        status: 'pending',
        module: module,
        sender_phone: normalizedSender,
        sms_count: smsCount,
        metadata: { 
          ...metadata,
          payment_method: paymentMethod,
          sender_number: normalizedSender,
          checkout_session: true,
          requested_amount: parsedAmount,
          expected_amount: fixedAmount || metadata?.expected_amount,
          sms_type: module === 'sms' ? (systemSettings?.sms_provider_config?.default_type || 'non_masking') : undefined
        }
      }).select().single();

      if (error) throw error;
      
      setPendingTrx(data as Transaction);
      setStep('pay');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyNumber = (num: string) => {
    const cleanNum = num.replace(/[^0-9]/g, '');
    navigator.clipboard.writeText(cleanNum);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenApp = () => {
    if (paymentMethod === 'bkash') {
      window.location.href = 'bkash://';
      setTimeout(() => {
        window.location.href = 'intent://#Intent;scheme=bkash;package=com.bKash.customerapp;end';
      }, 500);
    } else if (paymentMethod === 'nagad') {
      window.location.href = 'intent://#Intent;scheme=nagad;package=com.konasl.nagad;end';
    }
  };

  const renderProgress = () => {
    const steps = [
      { id: 'amount', label: lang === 'bn' ? 'পরিমাণ' : 'Amount' },
      { id: 'method', label: lang === 'bn' ? 'পদ্ধতি' : 'Method' },
      { id: 'number', label: lang === 'bn' ? 'নম্বর' : 'Number' },
      { id: 'pay', label: lang === 'bn' ? 'পেমেন্ট' : 'Payment' }
    ];

    const activeIdx = step === 'success' || step === 'failed' 
      ? 4 
      : (step === 'pay' || step === 'verify')
        ? 3 
        : steps.findIndex(s => s.id === step);

    return (
      <div className="flex items-center justify-between px-2 mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-200 -z-10" />
        {steps.map((s, idx) => (
          <div key={s.id} className="flex flex-col items-center gap-1.5">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 ${
              idx <= activeIdx ? 'bg-[#2563EB] text-white' : 'bg-white border-2 border-slate-200 text-slate-400'
            }`}>
              {idx < activeIdx ? <CheckCircle2 size={12} /> : idx + 1}
            </div>
            <span className={`text-[8px] font-black uppercase tracking-tighter ${
              idx <= activeIdx ? 'text-[#2563EB]' : 'text-slate-400'
            }`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-[500px] flex flex-col max-w-md mx-auto bg-white rounded-[2.5rem] shadow-premium overflow-hidden border border-slate-100">
      {/* Header */}
      <div className="bg-[#2563EB] p-8 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <CreditCard size={120} />
        </div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight leading-none mb-1">
              {lang === 'bn' ? 'পেমেন্ট' : 'Payment'}
            </h2>
            <p className="text-blue-100 text-[10px] font-bold uppercase tracking-widest opacity-80">
              {module === 'subscription'
                ? (lang === 'bn' ? 'নিরাপদে সাবস্ক্রিপশন ফি পরিশোধ করুন' : 'Pay your subscription securely')
                : (lang === 'bn' ? 'নিরাপদে অ্যাকাউন্ট রিচার্জ করুন' : 'Recharge your account securely')}
            </p>
          </div>
          <button onClick={onCancel} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
            <AlertCircle size={20} />
          </button>
        </div>
      </div>

      <div className="p-8 flex-1 flex flex-col">
        {step !== 'success' && step !== 'failed' && renderProgress()}

        <AnimatePresence mode="wait">
          {step === 'amount' && (
            <motion.div 
              key="amount"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 flex-1 flex flex-col"
            >
              <div className="text-center space-y-4 pt-4">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                  {module === 'subscription'
                    ? (lang === 'bn' ? 'সাবস্ক্রিপশন ফি' : 'Subscription Fee')
                    : (lang === 'bn' ? 'রিচার্জের পরিমাণ' : 'Recharge Amount')}
                </label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-300">৳</span>
                  <input 
                    type="number" 
                    className={`w-full h-24 pl-14 pr-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-black text-5xl text-center text-[#2563EB] focus:border-[#2563EB] focus:bg-white transition-all outline-none ${module === 'subscription' ? 'cursor-not-allowed opacity-90' : ''}`} 
                    value={amount} 
                    onChange={(e) => module !== 'subscription' && setAmount(e.target.value)} 
                    readOnly={module === 'subscription'}
                    placeholder="0" 
                    autoFocus
                  />
                </div>
                {module !== 'subscription' ? (
                  <>
                    <p className={`text-xs font-bold transition-colors ${(!amount || parseInt(amount) < 50) ? 'text-rose-500' : 'text-emerald-600'}`}>
                      {lang === 'bn' ? '* সর্বনিম্ন রিচার্জ ৫০ টাকা' : '* Minimum recharge 50 Taka'}
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {[100, 200, 500, 1000].map(val => (
                        <button 
                          key={val}
                          onClick={() => setAmount(val.toString())}
                          className="py-2 rounded-xl border border-slate-100 bg-slate-50 text-[10px] font-black text-slate-600 hover:border-[#2563EB] hover:text-[#2563EB] transition-all"
                        >
                          +{val}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {lang === 'bn' ? '* সাবস্ক্রিপশন ফি পরিবর্তনযোগ্য নয়' : '* Subscription fee is not editable'}
                  </p>
                )}
              </div>
              <div className="mt-auto pt-8">
                <button 
                  onClick={() => setStep('method')}
                  disabled={!amount || parseInt(amount) <= 0 || (module !== 'subscription' && parseInt(amount) < 50)}
                  className="w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg disabled:opacity-40 active:scale-95 transition-all"
                >
                  {lang === 'bn' ? 'এগিয়ে যান' : 'Continue'} <ArrowRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'method' && (
            <motion.div 
              key="method"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 flex-1 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setStep('amount')} className="text-slate-400"><ChevronLeft size={20} /></button>
                <h3 className="text-lg font-black text-slate-800">{lang === 'bn' ? 'পেমেন্ট পদ্ধতি নির্বাচন করুন' : 'Select Payment Method'}</h3>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={() => setPaymentMethod('bkash')}
                  className={`w-full p-6 rounded-[2rem] border-2 transition-all flex items-center gap-6 text-left group ${
                    paymentMethod === 'bkash' ? 'border-[#D12053] bg-[#D12053]/5' : 'border-slate-100 hover:border-[#D12053]/30'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                    paymentMethod === 'bkash' ? 'bg-[#D12053] text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-[#D12053]/10'
                  }`}>
                    <Smartphone size={28} />
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-slate-800">bKash</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pay using bKash Send Money</p>
                  </div>
                </button>

                <button 
                  onClick={() => setPaymentMethod('nagad')}
                  className={`w-full p-6 rounded-[2rem] border-2 transition-all flex items-center gap-6 text-left group ${
                    paymentMethod === 'nagad' ? 'border-[#F7941D] bg-[#F7941D]/5' : 'border-slate-100 hover:border-[#F7941D]/30'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                    paymentMethod === 'nagad' ? 'bg-[#F7941D] text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-[#F7941D]/10'
                  }`}>
                    <Smartphone size={28} />
                  </div>
                  <div>
                    <h4 className="font-black text-lg text-slate-800">Nagad</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pay using Nagad Send Money</p>
                  </div>
                </button>


              </div>

              <div className="mt-auto pt-8">
                <button 
                  onClick={() => setStep('number')}
                  disabled={!paymentMethod}
                  className="w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg disabled:opacity-40 active:scale-95 transition-all"
                >
                  {lang === 'bn' ? 'এগিয়ে যান' : 'Continue'} <ArrowRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {step === 'number' && (
            <motion.div 
              key="number"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8 flex-1 flex flex-col"
            >
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => setStep('method')} className="text-slate-400"><ChevronLeft size={20} /></button>
                <h3 className="text-lg font-black text-slate-800">
                  {lang === 'bn' ? `আপনার ${paymentMethod === 'bkash' ? 'বিকাশ' : paymentMethod === 'nagad' ? 'নগদ' : 'টেস্ট'} নম্বর দিন` : `Enter Your ${paymentMethod === 'bkash' ? 'bKash' : paymentMethod === 'nagad' ? 'Nagad' : 'Test'} Number`}
                </h3>
              </div>

              <div className="space-y-4 pt-4 text-center">
                <p className="text-[11px] font-bold text-slate-400 italic">
                  {lang === 'bn' ? '* যে নম্বর থেকে আপনি টাকা পাঠাবেন সেই নম্বরটি দিন' : '* Enter the number you will send money from'}
                </p>
                <div className="relative">
                  <input 
                    type="tel" 
                    className="w-full h-20 px-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] font-black text-3xl text-center text-[#2563EB] focus:border-[#2563EB] focus:bg-white transition-all outline-none" 
                    value={senderPhone} 
                    onChange={(e) => setSenderPhone(e.target.value)} 
                    placeholder="01XXXXXXXXX" 
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="flex items-center justify-center gap-2 text-red-500 font-black text-[10px] uppercase">
                    <AlertCircle size={14} /> {error}
                  </div>
                )}
              </div>

              <div className="mt-auto pt-8">
                <button 
                  onClick={handleCreateSession}
                  disabled={isProcessing || senderPhone.length < 11}
                  className="w-full h-16 bg-[#2563EB] text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg disabled:opacity-40 active:scale-95 transition-all"
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : (lang === 'bn' ? 'এগিয়ে যান' : 'Continue')} <ArrowRight size={20} />
                </button>
              </div>
            </motion.div>
          )}

          {(step === 'pay' || step === 'verify') && (
            <motion.div 
              key="pay"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6 flex-1 flex flex-col"
            >
              <div className="bg-slate-50 rounded-[2rem] p-6 border border-slate-100 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'টাকার পরিমাণ' : 'Amount'}</span>
                  <span className="text-2xl font-black text-[#2563EB]">৳{amount}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'আপনার নম্বর' : 'Your Number'}</span>
                  <span className="text-sm font-black text-slate-700">{senderPhone}</span>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'টাকা পাঠান (Send Money)' : 'Send Money To'}</span>
                  <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
                    <span className="text-lg font-black text-slate-800">{paymentMethod === 'bkash' ? adminBkash : paymentMethod === 'nagad' ? adminNagad : '01700000000 (Test Wallet)'}</span>
                    <button 
                      onClick={() => handleCopyNumber(paymentMethod === 'bkash' ? adminBkash : paymentMethod === 'nagad' ? adminNagad : '01700000000')}
                      className={`p-2 rounded-lg transition-all ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                    >
                      {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Modern live status / loader card */}
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-[2rem] p-6 space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-emerald-100 flex items-center justify-center">
                      <Loader2 className="animate-spin text-emerald-500" size={28} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-lg">
                      <ShieldCheck size={14} />
                    </div>
                  </div>
                  <div className="text-center space-y-1">
                    <h4 className="text-sm font-black text-slate-800">
                      {lang === 'bn' ? 'পেমেন্ট যাচাই করা হচ্ছে' : 'Verifying Payment'}
                    </h4>
                    <p className="text-[11px] font-bold text-slate-400 max-w-[280px]">
                      {lang === 'bn' 
                        ? 'আপনার নম্বর থেকে টাকা পাওয়ার সাথে সাথে পেমেন্টটি অটোমেটিক সফল হয়ে যাবে। অনুগ্রহ করে অপেক্ষা করুন...' 
                        : 'Your payment will be automatically verified once received from your number. Please wait...'}
                    </p>
                  </div>
                </div>

                {/* Gateway open or simulate buttons */}
                <div className="flex flex-col gap-2">
                  {paymentMethod !== 'test' ? (
                    <button 
                      onClick={handleOpenApp}
                      className={`w-full h-14 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-base transition-all active:scale-95 ${
                        paymentMethod === 'bkash' ? 'bg-[#D12053]' : 'bg-[#F7941D]'
                      }`}
                    >
                      {lang === 'bn' ? `${paymentMethod === 'bkash' ? 'বিকাশ' : 'নগদ'} অ্যাপ ওপেন করুন` : `Open ${paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} App`}
                      <ExternalLink size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        setIsProcessing(true);
                        try {
                          // @ts-ignore
                          const supabaseUrl = supabase.supabaseUrl || 'https://wafcgdcgqkmsngwqhded.supabase.co';
                          // @ts-ignore
                          const supabaseKey = supabase.supabaseKey || '';
                          const response = await fetch(`${supabaseUrl}/functions/v1/verify-payment`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'apikey': supabaseKey,
                              'Authorization': `Bearer ${supabaseKey}`
                            },
                            body: JSON.stringify({
                              amount: parseFloat(amount),
                              transaction_id: `TEST_${Date.now()}`,
                              sender_phone: senderPhone,
                              payment_method: 'TEST'
                            })
                          });
                          const resData = await response.json();
                          if (!response.ok) {
                            throw new Error(resData.error || resData.details || 'Test verification failed');
                          }
                          // Polling will detect the approval
                        } catch (err: any) {
                          setError(err.message);
                          setStep('failed');
                        } finally {
                          setIsProcessing(false);
                        }
                      }}
                      disabled={isProcessing}
                      className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-full shadow-md flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
                    >
                      {isProcessing ? <Loader2 className="animate-spin text-white" size={14} /> : null}
                      {lang === 'bn' ? 'সিমুলেট গেটওয়ে এসএমএস (টেস্ট)' : 'Simulate Gateway SMS (Test)'}
                    </button>
                  )}
                  <button 
                    onClick={handleCancelTransaction}
                    disabled={isProcessing}
                    className="w-full h-14 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100 font-black rounded-full flex items-center justify-center gap-2 text-sm transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={14} /> : null}
                    {lang === 'bn' ? 'পেমেন্ট বাতিল করুন' : 'Cancel Payment'}
                  </button>
                </div>

                <p className="text-[10px] font-bold text-slate-400 text-center px-4 italic">
                  {paymentMethod === 'test'
                    ? (lang === 'bn' ? '* টেস্ট মোড সক্রিয়। সিমুলেট বাটনে ক্লিক করুন।' : '* Test mode active. Click the simulate button.')
                    : (lang === 'bn' ? `* অনুগ্রহ করে আপনার ${paymentMethod === 'bkash' ? 'বিকাশ' : 'নগদ'} অ্যাপ অথবা ডায়াল কোড দিয়ে সেন্ড মানি করুন। কোনো TrxID দেয়ার প্রয়োজন নেই।` : `* Please send money using your ${paymentMethod === 'bkash' ? 'bKash' : 'Nagad'} app or USSD dial code. No TrxID required.`)}
                </p>
              </div>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center py-8"
            >
              <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 mb-6 animate-bounce">
                <CheckCircle2 size={48} />
              </div>
              <h3 className="text-3xl font-black text-slate-800 mb-2">{lang === 'bn' ? 'পেমেন্ট সফল!' : 'Payment Successful!'}</h3>
              <p className="text-slate-400 font-bold mb-8 max-w-[280px]">
                {lang === 'bn' ? `আপনার ৳${amount} পেমেন্ট সফলভাবে যাচাই করা হয়েছে।` : `Your payment of ৳${amount} has been verified successfully.`}
              </p>
              
              <div className="w-full bg-slate-50 rounded-[2rem] p-6 border border-slate-100 space-y-3 mb-8">
                <div className="flex justify-between text-[10px] font-black border-b border-slate-200/50 pb-2">
                  <span className="text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</span>
                  <span className="text-emerald-600">৳{amount}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black border-b border-slate-200/50 pb-2">
                  <span className="text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'পেমেন্ট পদ্ধতি' : 'Payment Method'}</span>
                  <span className="text-slate-700 uppercase">{pendingTrx?.metadata?.payment_method || paymentMethod || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black border-b border-slate-200/50 pb-2">
                  <span className="text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'প্রেরক নম্বর' : 'Sender Number'}</span>
                  <span className="text-slate-700">{pendingTrx?.sender_phone || senderPhone || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black border-b border-slate-200/50 pb-2">
                  <span className="text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'ট্রানজেকশন আইডি' : 'Transaction ID'}</span>
                  <span className="text-blue-600 font-mono tracking-tight">{pendingTrx?.transaction_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black">
                  <span className="text-slate-400 uppercase tracking-widest">{lang === 'bn' ? 'সময়' : 'Verified Time'}</span>
                  <span className="text-slate-700">
                    {pendingTrx?.approved_at 
                      ? new Date(pendingTrx.approved_at).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-US') 
                      : (lang === 'bn' ? 'এইমাত্র' : 'Just now')}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => pendingTrx && onSuccess(pendingTrx)}
                className="w-full h-16 bg-emerald-600 text-white font-black rounded-full shadow-premium flex items-center justify-center gap-3 text-lg transition-all active:scale-95"
              >
                {lang === 'bn' ? 'সম্পন্ন করুন' : 'Done'}
              </button>
            </motion.div>
          )}

          {step === 'failed' && (
            <motion.div 
              key="failed"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center py-8"
            >
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-6">
                <AlertCircle size={48} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">{lang === 'bn' ? 'পেমেন্ট প্রত্যাখ্যান করা হয়েছে' : 'Payment Rejected'}</h3>
              <p className="text-slate-400 font-bold mb-8 px-4">
                {error || (lang === 'bn' ? 'পেমেন্ট তথ্য পেমেন্ট রিকোয়েস্টের সাথে মেলেনি।' : 'The payment information does not match your payment request.')}
              </p>
              
              <div className="grid grid-cols-2 gap-4 w-full">
                <button 
                  onClick={() => setStep('pay')}
                  className="h-14 bg-slate-100 text-slate-600 font-black rounded-full flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
                >
                  {lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Try Again'}
                </button>
                <button 
                  onClick={() => setStep('amount')}
                  className="h-14 bg-[#2563EB] text-white font-black rounded-full flex items-center justify-center gap-2 text-sm transition-all active:scale-95 shadow-premium"
                >
                  {lang === 'bn' ? 'তথ্য পরিবর্তন' : 'Back to Start'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Footer */}
      <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secure Checkout</span>
        </div>
        <div className="w-[1px] h-3 bg-slate-300" />
        <div className="flex items-center gap-1.5">
          <History size={14} className="text-[#2563EB]" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Automated System</span>
        </div>
      </div>
    </div>
  );
};

export default PaymentCheckout;
