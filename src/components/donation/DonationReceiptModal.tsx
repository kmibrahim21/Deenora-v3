import React, { useRef } from 'react';
import { X, Printer, Download, CheckCircle2, Heart, Share2 } from 'lucide-react';
import { Donation, Institution, Language } from 'types';
import { numberToBanglaWords, toBanglaDigits } from 'utils/numberToBanglaWords';

interface DonationReceiptModalProps {
  donation: Donation;
  madrasah: Institution | null;
  lang: Language;
  onClose: () => void;
  onSendSms?: (donation: Donation) => void;
}

const fundLabels: Record<string, { bn: string; en: string }> = {
  general: { bn: 'সাধারণ অনুদান', en: 'General Donation' },
  zakat: { bn: 'যাকাত ও ফিতরা ফান্ড', en: 'Zakat & Fitra Fund' },
  lillah: { bn: 'লিল্লাহ বোর্ডিং ও এতিম তহবিল', en: 'Lillah Boarding & Orphan Fund' },
  development: { bn: 'ভবন ও মাদরাসা উন্নয়ন তহবিল', en: 'Building & Development Fund' },
  orphan: { bn: 'এতিম ও দুঃস্থ সহায়তা', en: 'Orphan & Poor Support' },
  ramadan: { bn: 'রমযান ইফতার ও খাদ্য তহবিল', en: 'Ramadan Iftar & Food Fund' },
  sadaqah: { bn: 'সদকায়ে জারিয়া', en: 'Sadaqah Jariyah' },
  mosque: { bn: 'মসজিদ ফান্ড', en: 'Mosque Fund' },
  other: { bn: 'অন্যান্য দান', en: 'Other Donation' },
};

const paymentLabels: Record<string, { bn: string; en: string }> = {
  cash: { bn: 'নগদ / ক্যাশ', en: 'Cash' },
  bkash: { bn: 'বিকাশ (bKash)', en: 'bKash' },
  nagad: { bn: 'নগদ (Nagad)', en: 'Nagad' },
  rocket: { bn: 'রকেট (Rocket)', en: 'Rocket' },
  bank: { bn: 'ব্যাংক হিসাব', en: 'Bank Account' },
  other: { bn: 'অন্যান্য', en: 'Other' },
};

export const DonationReceiptModal: React.FC<DonationReceiptModalProps> = ({
  donation,
  madrasah,
  lang,
  onClose,
  onSendSms,
}) => {
  const [printType, setPrintType] = React.useState<'a4' | 'pos'>('a4');
  const printRef = useRef<HTMLDivElement>(null);

  const fundName =
    fundLabels[donation.fund_category]?.[lang === 'bn' ? 'bn' : 'en'] ||
    donation.fund_category;

  const paymentName =
    paymentLabels[donation.payment_method]?.[lang === 'bn' ? 'bn' : 'en'] ||
    donation.payment_method;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(donation.donation_date || donation.created_at);
      if (lang === 'bn') {
        return toBanglaDigits(
          `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1)
            .toString()
            .padStart(2, '0')}-${d.getFullYear()}`
        );
      }
      return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1)
        .toString()
        .padStart(2, '0')}-${d.getFullYear()}`;
    } catch (e) {
      return donation.donation_date;
    }
  }, [donation, lang]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="p-4 md:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-[#2563EB] dark:text-blue-400 flex items-center justify-center font-bold">
              <Heart size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white font-noto">
                {lang === 'bn' ? 'দান ও অনুদানের মানি রসিদ' : 'Donation Money Receipt'}
              </h3>
              <p className="text-[11px] font-bold text-slate-400">
                {lang === 'bn' ? `রসিদ নং: #${donation.receipt_no}` : `Receipt No: #${donation.receipt_no}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Print Mode Switcher */}
            <div className="hidden sm:flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => setPrintType('a4')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  printType === 'a4'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {lang === 'bn' ? 'স্ট্যান্ডার্ড ভাউচার (A4)' : 'Standard (A4)'}
              </button>
              <button
                onClick={() => setPrintType('pos')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  printType === 'pos'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {lang === 'bn' ? 'থার্মাল স্লিপ (POS)' : 'Thermal (POS)'}
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Printer size={16} />
              <span>{lang === 'bn' ? 'প্রিন্ট / ডাউনলোড' : 'Print / Download'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Receipt Body Container */}
        <div className="p-4 md:p-8 overflow-y-auto flex-1 flex justify-center bg-slate-100/60 dark:bg-slate-950/60 print:p-0 print:bg-white">
          {/* A4 Standard Voucher View */}
          {printType === 'a4' && (
            <div
              ref={printRef}
              className="w-full max-w-2xl bg-white text-slate-800 p-6 md:p-8 rounded-2xl border-2 border-emerald-700 shadow-lg relative print:shadow-none print:border-2 print:border-emerald-800 print:rounded-none print:w-full print:max-w-none print:m-0"
              style={{ minHeight: '480px' }}
            >
              {/* Islamic Decorative Corners */}
              <div className="absolute top-2 left-2 text-emerald-600 text-xs select-none">❖</div>
              <div className="absolute top-2 right-2 text-emerald-600 text-xs select-none">❖</div>
              <div className="absolute bottom-2 left-2 text-emerald-600 text-xs select-none">❖</div>
              <div className="absolute bottom-2 right-2 text-emerald-600 text-xs select-none">❖</div>

              {/* Watermark Logo / Calligraphy Background */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none overflow-hidden select-none">
                <Heart size={360} />
              </div>

              {/* Header */}
              <div className="text-center border-b-2 border-emerald-700 pb-3 mb-4">
                <p className="text-[13px] font-arabic text-emerald-800 font-bold mb-1">
                  بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
                </p>
                <div className="flex items-center justify-center gap-3">
                  {madrasah?.logo_url && (
                    <img
                      src={madrasah.logo_url}
                      alt="Logo"
                      className="w-12 h-12 object-contain rounded-full border border-slate-200"
                    />
                  )}
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-emerald-900 font-noto tracking-tight">
                      {madrasah?.name || 'দ্বীনিয়া মাদরাসা ও এতিমখানা'}
                    </h2>
                    <p className="text-xs text-slate-600 font-medium">
                      {madrasah?.address || 'ঠিকানা: মাদরাসা প্রাঙ্গণ'}
                    </p>
                    {madrasah?.phone && (
                      <p className="text-[11px] text-slate-500 font-medium">
                        মোবাইল: {madrasah.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="inline-block mt-2 px-4 py-0.5 bg-emerald-800 text-white text-xs font-black rounded-full uppercase tracking-wider">
                  {lang === 'bn' ? 'দান ও অনুদানের মানি রসিদ' : 'Donation Money Receipt'}
                </div>
              </div>

              {/* Receipt Info Meta Row */}
              <div className="flex justify-between items-center text-xs font-bold border-b border-slate-200 pb-2 mb-4">
                <div>
                  <span className="text-slate-500">রসিদ নং / Receipt No: </span>
                  <span className="text-emerald-900 font-black font-mono">
                    #{donation.receipt_no}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">তারিখ / Date: </span>
                  <span className="text-slate-800 font-black">{formattedDate}</span>
                </div>
              </div>

              {/* Receipt Main Details */}
              <div className="space-y-3 text-xs md:text-sm">
                <div className="flex items-start border-b border-dashed border-slate-200 pb-2">
                  <span className="w-36 shrink-0 text-slate-600 font-bold">
                    সম্মানিত দাতার নাম:
                  </span>
                  <span className="font-black text-slate-900 text-sm md:text-base flex-1">
                    {donation.donor_name}
                  </span>
                </div>

                {donation.donor_phone && (
                  <div className="flex items-center border-b border-dashed border-slate-200 pb-2">
                    <span className="w-36 shrink-0 text-slate-600 font-bold">
                      মোবাইল নম্বর:
                    </span>
                    <span className="font-bold text-slate-800 font-mono">
                      {donation.donor_phone}
                    </span>
                  </div>
                )}

                {donation.donor_address && (
                  <div className="flex items-start border-b border-dashed border-slate-200 pb-2">
                    <span className="w-36 shrink-0 text-slate-600 font-bold">
                      দাতার ঠিকানা:
                    </span>
                    <span className="text-slate-800 font-medium">
                      {donation.donor_address}
                    </span>
                  </div>
                )}

                <div className="flex items-center border-b border-dashed border-slate-200 pb-2">
                  <span className="w-36 shrink-0 text-slate-600 font-bold">
                    অনুদানের খাত:
                  </span>
                  <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    {fundName}
                  </span>
                </div>

                <div className="flex items-center border-b border-dashed border-slate-200 pb-2">
                  <span className="w-36 shrink-0 text-slate-600 font-bold">
                    পরিশোধের মাধ্যম:
                  </span>
                  <span className="font-bold text-slate-800">{paymentName}</span>
                </div>

                {donation.prayer_request && (
                  <div className="flex items-start border-b border-dashed border-slate-200 pb-2 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                    <span className="w-36 shrink-0 text-amber-900 font-bold">
                      দোয়া / নিয়ত:
                    </span>
                    <span className="text-amber-950 font-medium italic">
                      "{donation.prayer_request}"
                    </span>
                  </div>
                )}

                {/* Amount Box */}
                <div className="my-4 p-3 bg-emerald-50 rounded-xl border border-emerald-300 flex flex-col sm:flex-row items-center justify-between gap-2">
                  <div>
                    <span className="text-xs text-slate-600 font-bold">
                      কথায় (In Words):{' '}
                    </span>
                    <span className="font-black text-emerald-950 text-xs md:text-sm">
                      {numberToBanglaWords(donation.amount)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-lg border border-emerald-400 shadow-sm shrink-0">
                    <span className="text-xs font-bold text-slate-500">মোট টাকা:</span>
                    <span className="text-lg md:text-xl font-black text-emerald-700">
                      ৳ {donation.amount.toLocaleString()} /-
                    </span>
                  </div>
                </div>

                {/* Quranic Verse / Dua */}
                <p className="text-[11px] text-center text-slate-500 italic pt-1">
                  "আল্লাহ তা'আলা আপনার দানকে কবুল ও উত্তম প্রতিদান দান করুন। আমীন।"
                </p>
              </div>

              {/* Signatures */}
              {(() => {
                const sigUrl = madrasah?.signature_url || madrasah?.config_json?.signature_url;
                return (
                  <div className="mt-12 pt-4 flex justify-between items-end text-xs font-bold text-slate-700 border-t border-slate-200">
                    <div className="text-center">
                      <div className="w-32 border-b border-slate-400 mb-1"></div>
                      <span>আদায়কারী / ক্যাশিয়ার</span>
                    </div>
                    {sigUrl ? (
                      <div className="text-center">
                        <img
                          src={sigUrl}
                          alt="Signature"
                          className="h-8 mx-auto object-contain"
                        />
                        <div className="w-32 border-b border-slate-400 mb-1"></div>
                        <span>মুহতামিম / সভাপতি</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-32 border-b border-slate-400 mb-1"></div>
                        <span>মুহতামিম / সভাপতি</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* POS Thermal Slip View (80mm) */}
          {printType === 'pos' && (
            <div
              ref={printRef}
              className="w-full max-w-[320px] bg-white text-slate-900 p-4 rounded-xl border border-slate-300 shadow font-mono text-xs print:shadow-none print:border-none print:w-[80mm] print:p-0 print:m-0"
            >
              <div className="text-center pb-2 border-b border-dashed border-slate-400 mb-2">
                <p className="text-[10px] font-bold">بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ</p>
                <h2 className="text-sm font-black mt-1 font-noto">
                  {madrasah?.name || 'মাদরাসা'}
                </h2>
                <p className="text-[10px] text-slate-600">{madrasah?.address}</p>
                {madrasah?.phone && (
                  <p className="text-[10px] text-slate-600">ফোন: {madrasah.phone}</p>
                )}
                <div className="text-[11px] font-black border border-slate-400 px-2 py-0.5 rounded my-1.5 inline-block">
                  মানি রসিদ (MONEY RECEIPT)
                </div>
              </div>

              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-400 pb-2 mb-2">
                <div className="flex justify-between">
                  <span>রসিদ নং:</span>
                  <span className="font-bold font-mono">#{donation.receipt_no}</span>
                </div>
                <div className="flex justify-between">
                  <span>তারিখ:</span>
                  <span>{formattedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>দাতার নাম:</span>
                  <span className="font-bold text-right">{donation.donor_name}</span>
                </div>
                {donation.donor_phone && (
                  <div className="flex justify-between">
                    <span>ফোন:</span>
                    <span>{donation.donor_phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>খাত:</span>
                  <span className="font-bold">{fundName}</span>
                </div>
                <div className="flex justify-between">
                  <span>মাধ্যম:</span>
                  <span>{paymentName}</span>
                </div>
                {donation.prayer_request && (
                  <div className="pt-1">
                    <span className="font-bold">দোয়া/নিয়ত: </span>
                    <span className="italic">{donation.prayer_request}</span>
                  </div>
                )}
              </div>

              <div className="border-b-2 border-slate-800 pb-2 mb-2 text-center">
                <div className="text-xs text-slate-600 font-bold mb-1">মোট অনুদান:</div>
                <div className="text-xl font-black">৳ {donation.amount.toLocaleString()} /-</div>
                <div className="text-[10px] text-slate-600 mt-1">
                  {numberToBanglaWords(donation.amount)}
                </div>
              </div>

              <p className="text-[10px] text-center text-slate-600 italic mb-6">
                জাযাকাল্লাহু খাইরান। আল্লাহ আপনার দান কবুল করুন।
              </p>

              <div className="flex justify-between items-end text-[10px] pt-4">
                <div className="text-center">
                  <div className="w-16 border-b border-slate-400 mb-0.5"></div>
                  <span>আদায়কারী</span>
                </div>
                <div className="text-center">
                  <div className="w-16 border-b border-slate-400 mb-0.5"></div>
                  <span>কর্তৃপক্ষ</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
