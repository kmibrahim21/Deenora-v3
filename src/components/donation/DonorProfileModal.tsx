import React from 'react';
import {
  X,
  User,
  Phone,
  MapPin,
  Calendar,
  Heart,
  Receipt,
  Plus,
  Send,
  PhoneCall,
  CheckCircle2,
  Clock,
  Edit2,
  Trash2
} from 'lucide-react';
import { Donor, Donation, Institution, Language } from 'types';
import { toBanglaDigits } from 'utils/numberToBanglaWords';

interface DonorProfileModalProps {
  donor: Donor;
  donations: Donation[];
  madrasah: Institution | null;
  lang: Language;
  onClose: () => void;
  onNewDonation: (donor: Donor) => void;
  onViewReceipt: (donation: Donation) => void;
  onEditDonor?: (donor: Donor) => void;
  onDeleteDonor?: (donor: Donor) => void;
}

export const DonorProfileModal: React.FC<DonorProfileModalProps> = ({
  donor,
  donations,
  madrasah,
  lang,
  onClose,
  onNewDonation,
  onViewReceipt,
  onEditDonor,
  onDeleteDonor,
}) => {
  const isDark = madrasah?.theme === 'dark';

  // Filter donations specific to this donor (by donor_id or exact matching phone/name)
  const donorDonations = React.useMemo(() => {
    return donations.filter(
      (d) =>
        (d.donor_id && d.donor_id === donor.id) ||
        (donor.phone && d.donor_phone === donor.phone) ||
        (!donor.phone && d.donor_name.toLowerCase() === donor.name.toLowerCase())
    );
  }, [donations, donor]);

  const totalDonated = React.useMemo(() => {
    return donorDonations.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  }, [donorDonations]);

  const donorTypeLabel = {
    general: lang === 'bn' ? 'সাধারণ দাতা' : 'General Donor',
    monthly: lang === 'bn' ? 'মাসিক নিয়মিত দাতা' : 'Monthly Donor',
    permanent: lang === 'bn' ? 'স্থায়ী দাতা / আজীবন সদস্য' : 'Lifetime Member',
    corporate: lang === 'bn' ? 'প্রাতিষ্ঠানিক অনুদানকারী' : 'Corporate / Org',
  }[donor.donor_type || 'general'];

  return (
    <div className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header Profile Banner */}
        <div className="bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] p-6 text-white relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center font-black text-2xl border border-white/30 shrink-0">
              {donor.name.charAt(0)}
            </div>
            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-black font-noto">{donor.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-white/20 backdrop-blur-md border border-white/30">
                  {donorTypeLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-blue-100 mt-2">
                {donor.phone && (
                  <div className="flex items-center gap-1">
                    <Phone size={13} />
                    <span className="font-mono">{donor.phone}</span>
                  </div>
                )}
                {donor.address && (
                  <div className="flex items-center gap-1">
                    <MapPin size={13} />
                    <span>{donor.address}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 mt-4 pt-3 border-t border-white/15">
            {donor.phone && (
              <a
                href={`tel:${donor.phone}`}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-sm"
              >
                <PhoneCall size={14} />
                <span>{lang === 'bn' ? 'কল' : 'Call'}</span>
              </a>
            )}
            {onEditDonor && (
              <button
                onClick={() => {
                  onClose();
                  onEditDonor(donor);
                }}
                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Edit2 size={14} />
                <span>{lang === 'bn' ? 'এডিট' : 'Edit'}</span>
              </button>
            )}
            {onDeleteDonor && (
              <button
                onClick={() => {
                  onClose();
                  onDeleteDonor(donor);
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500/80 hover:bg-rose-500 text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 size={14} />
                <span>{lang === 'bn' ? 'ডিলিট' : 'Delete'}</span>
              </button>
            )}
            <button
              onClick={() => {
                onClose();
                onNewDonation(donor);
              }}
              className="px-4 py-1.5 rounded-xl bg-white text-[#1E3A8A] hover:bg-blue-50 text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={14} />
              <span>{lang === 'bn' ? 'নতুন দান গ্রহণ' : 'New Donation'}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50 dark:bg-slate-900/50">
          {/* Contribution Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
              <span className="text-[11px] font-bold text-slate-400 block mb-1">
                {lang === 'bn' ? 'সর্বমোট দান' : 'Total Donated'}
              </span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                ৳ {totalDonated.toLocaleString()}
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
              <span className="text-[11px] font-bold text-slate-400 block mb-1">
                {lang === 'bn' ? 'মোট অনুদান সংখ্যা' : 'Donations Count'}
              </span>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                {donorDonations.length} {lang === 'bn' ? 'বার' : 'times'}
              </span>
            </div>

            {donor.monthly_pledge_amount ? (
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center col-span-2 sm:col-span-1">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">
                  {lang === 'bn' ? 'মাসিক অঙ্গীকার' : 'Monthly Pledge'}
                </span>
                <span className="text-xl font-black text-purple-600 dark:text-purple-400">
                  ৳ {donor.monthly_pledge_amount.toLocaleString()}
                </span>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center col-span-2 sm:col-span-1">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">
                  {lang === 'bn' ? 'দাতার স্ট্যাটাস' : 'Status'}
                </span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 mt-1">
                  <CheckCircle2 size={16} />
                  {lang === 'bn' ? 'সক্রিয়' : 'Active'}
                </span>
              </div>
            )}
          </div>

          {/* Donation History Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800 dark:text-white font-noto flex items-center gap-2">
                <Receipt size={16} className="text-emerald-600" />
                <span>{lang === 'bn' ? 'অনুদানের ইতিহাস' : 'Donation History'}</span>
              </h3>
              <span className="text-xs text-slate-400 font-bold">
                {donorDonations.length} {lang === 'bn' ? 'টি এন্ট্রি' : 'entries'}
              </span>
            </div>

            {donorDonations.length === 0 ? (
              <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-400 text-xs">
                {lang === 'bn'
                  ? 'এই দাতার এখনও কোনো অনুদানের রেকর্ড নেই।'
                  : 'No donation records found for this donor yet.'}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700/50 shadow-sm">
                {donorDonations.map((d) => (
                  <div
                    key={d.id}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800 dark:text-white">
                          ৳ {d.amount.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          {d.fund_category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                        <span>রসিদ: #{d.receipt_no}</span>
                        <span>•</span>
                        <span>{d.donation_date || d.created_at.slice(0, 10)}</span>
                        {d.prayer_request && (
                          <>
                            <span>•</span>
                            <span className="italic text-slate-500">"{d.prayer_request}"</span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => onViewReceipt(d)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Receipt size={14} />
                      <span>{lang === 'bn' ? 'রসিদ' : 'Receipt'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
