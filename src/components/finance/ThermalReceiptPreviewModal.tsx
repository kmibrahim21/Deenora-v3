import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, 
  Bluetooth, 
  Usb, 
  Check, 
  AlertCircle, 
  X, 
  Download, 
  RefreshCw, 
  Settings2, 
  CheckCircle2, 
  Smartphone,
  Copy,
  Loader2,
  FileText
} from 'lucide-react';
import { thermalPrinterService, ThermalPrintOptions } from '../../utils/thermalPrinter';
import { FeeReceiptTemplate } from '../pdf/FeeReceiptTemplate';
import { generateFeeReceiptPDF_Universal } from '../../utils/pdfGenerator';

interface ThermalReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any;
  month: string;
  madrasah: any;
  lang?: 'en' | 'bn';
  receiptId?: string;
  paymentDetails?: {
    paidAmount?: number;
    discount?: number;
    previousDue?: number;
    currentDue?: number;
    paymentMethod?: string;
    collectorName?: string;
    transactionDate?: string;
    feeItems?: Array<{ name: string; amount: number }>;
  };
}

export const ThermalReceiptPreviewModal: React.FC<ThermalReceiptPreviewModalProps> = ({
  isOpen,
  onClose,
  student,
  month,
  madrasah,
  lang = 'bn',
  receiptId: initialReceiptId,
  paymentDetails
}) => {
  const isBangla = lang === 'bn';
  const receiptContainerRef = useRef<HTMLDivElement>(null);

  // Print Configuration State
  const [paperSize, setPaperSize] = useState<'58mm' | '80mm'>('58mm');
  const [copies, setCopies] = useState<number>(1);
  const [printLogo, setPrintLogo] = useState<boolean>(true);
  const [printBranding, setPrintBranding] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Printer Connection State
  const [printerStatus, setPrinterStatus] = useState<{
    isConnected: boolean;
    name: string;
    type: string;
  }>({ isConnected: false, name: '', type: 'none' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const receiptId = React.useMemo(() => {
    return initialReceiptId || `#REC-${Date.now().toString().slice(-6)}`;
  }, [initialReceiptId]);

  // Merge payment details into student object safely
  const mergedStudent = React.useMemo(() => {
    if (!student) return null;
    const base = { ...student };
    if (paymentDetails) {
      if (paymentDetails.paidAmount !== undefined) base.total_paid = paymentDetails.paidAmount;
      if (paymentDetails.discount !== undefined) base.discount = paymentDetails.discount;
      if (paymentDetails.currentDue !== undefined) base.balance_due = paymentDetails.currentDue;
      if (paymentDetails.feeItems && paymentDetails.feeItems.length > 0) {
        base.fee_items = paymentDetails.feeItems;
      }
      base.payment_method = paymentDetails.paymentMethod || base.payment_method;
      base.collector_name = paymentDetails.collectorName || base.collector_name;
      base.transaction_date = paymentDetails.transactionDate || base.transaction_date;
      base.previous_due = paymentDetails.previousDue;
    }
    return base;
  }, [student, paymentDetails]);

  // Check initial connection status on modal open
  useEffect(() => {
    if (isOpen) {
      updatePrinterStatus();
      setStatusMessage(null);
    }
  }, [isOpen]);

  const updatePrinterStatus = () => {
    const active = thermalPrinterService.getActivePrinter();
    setPrinterStatus(active);
  };

  const handleConnectBluetooth = async () => {
    setIsConnecting(true);
    setStatusMessage(null);
    try {
      const res = await thermalPrinterService.connectBluetooth();
      if (res.success) {
        updatePrinterStatus();
        setStatusMessage({
          type: 'success',
          text: isBangla ? `ব্লুটুথ প্রিন্টার (${res.name}) সংযুক্ত হয়েছে!` : `Bluetooth Printer (${res.name}) Connected!`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || (isBangla ? 'ব্লুটুথ প্রিন্টার কানেক্ট করা সম্ভব হয়নি।' : 'Bluetooth connection failed.')
        });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'Bluetooth error' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectUsb = async () => {
    setIsConnecting(true);
    setStatusMessage(null);
    try {
      const res = await thermalPrinterService.connectUsb();
      if (res.success) {
        updatePrinterStatus();
        setStatusMessage({
          type: 'success',
          text: isBangla ? `USB প্রিন্টার (${res.name}) সংযুক্ত হয়েছে!` : `USB Printer (${res.name}) Connected!`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || (isBangla ? 'USB প্রিন্টার কানেক্ট করা সম্ভব হয়নি।' : 'USB connection failed.')
        });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message || 'USB error' });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await thermalPrinterService.disconnect();
    updatePrinterStatus();
    setStatusMessage({
      type: 'info',
      text: isBangla ? 'প্রিন্টার সংযোগ বিচ্ছিন্ন করা হয়েছে।' : 'Printer disconnected.'
    });
  };

  const handleTestPrint = async () => {
    setIsPrinting(true);
    setStatusMessage(null);
    try {
      const res = await thermalPrinterService.printTest();
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: isBangla ? 'টেস্ট প্রিন্ট সফলভাবে পাঠানো হয়েছে!' : 'Test print sent successfully!'
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: res.message || (isBangla ? 'টেস্ট প্রিন্ট ব্যর্থ হয়েছে।' : 'Test print failed.')
        });
      }
    } catch (e: any) {
      setStatusMessage({ type: 'error', text: e.message });
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!receiptContainerRef.current) return;
    setIsPrinting(true);
    setStatusMessage(null);

    const options: ThermalPrintOptions = {
      paperSize,
      copies,
      printLogo,
      printBranding,
      cutPaper: true
    };

    try {
      // 1. If Direct Bluetooth / USB or Android Bridge is connected
      if (thermalPrinterService.isConnected()) {
        const res = await thermalPrinterService.printReceiptElement(receiptContainerRef.current, options);
        if (res.success) {
          setStatusMessage({
            type: 'success',
            text: isBangla ? 'রসিদ সফলভাবে প্রিন্ট হয়েছে!' : 'Receipt printed successfully!'
          });
          setTimeout(() => {
            onClose();
          }, 1500);
          return;
        } else {
          setStatusMessage({
            type: 'error',
            text: res.message || (isBangla ? 'প্রিন্ট ব্যর্থ হয়েছে।' : 'Print failed.')
          });
        }
      } else {
        // 2. Standard Web Print Fallback for 58mm / 80mm
        await generateFeeReceiptPDF_Universal(
          mergedStudent,
          month,
          {
            ...madrasah,
            config_json: {
              ...madrasah?.config_json,
              features: {
                ...madrasah?.config_json?.features,
                printer_paper_size: paperSize
              }
            }
          },
          lang,
          undefined,
          true // isPrintMode = true
        );

        setStatusMessage({
          type: 'info',
          text: isBangla ? 'প্রিন্ট ডায়ালগ ওপেন হয়েছে।' : 'Print dialog opened.'
        });
      }
    } catch (err: any) {
      console.error('Print receipt error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || (isBangla ? 'প্রিন্ট করতে সমস্যা হয়েছে।' : 'Failed to print receipt.')
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      await generateFeeReceiptPDF_Universal(
        mergedStudent,
        month,
        {
          ...madrasah,
          config_json: {
            ...madrasah?.config_json,
            features: {
              ...madrasah?.config_json?.features,
              printer_paper_size: paperSize
            }
          }
        },
        lang,
        undefined,
        false // isPrintMode = false (download PDF)
      );
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen || !mergedStudent) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full overflow-hidden flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Printer size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white font-noto flex items-center gap-2">
                  {isBangla ? 'থার্মাল রসিদ প্রিন্ট' : 'Thermal Receipt Print'}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                    {paperSize} (XP-P502A)
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {mergedStudent.student_name} • {month}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-xl border transition-all ${
                  showSettings
                    ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                }`}
                title="Print Settings"
              >
                <Settings2 size={18} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Body: Two Column (Preview & Controls) */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: 58mm Thermal Preview Canvas */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center">
              <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <FileText size={14} />
                {isBangla ? 'রসিদ প্রিভিউ (৫8 মিমি)' : 'Receipt Preview (58mm)'}
              </div>

              {/* Thermal Receipt Paper Visual Shell */}
              <div className="w-full flex justify-center p-3 bg-slate-100 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner overflow-x-auto">
                <div
                  ref={receiptContainerRef}
                  className="bg-white text-black shadow-lg rounded-sm transition-all duration-300 overflow-hidden font-noto"
                  style={{
                    width: paperSize === '58mm' ? '384px' : '576px',
                    maxWidth: '100%',
                    padding: '12px 14px'
                  }}
                >
                  {/* Clean 58mm Thermal Layout */}
                  {/* 1. Header & Logo */}
                  <div className="flex flex-col items-center justify-center text-center pb-2 border-b border-dashed border-black">
                    {printLogo && madrasah?.logo_url && (
                      <img
                        src={madrasah.logo_url}
                        alt="Logo"
                        className="h-10 w-10 object-contain mb-1 grayscale contrast-200"
                        crossOrigin="anonymous"
                      />
                    )}
                    <h1 className="text-base font-black leading-tight tracking-tight text-black">
                      {madrasah?.name || 'Institution Name'}
                    </h1>
                    {madrasah?.address && (
                      <p className="text-[10px] font-bold text-slate-800 leading-tight mt-0.5">
                        {madrasah.address}
                      </p>
                    )}
                    {madrasah?.phone && (
                      <p className="text-[10px] font-bold text-slate-800 leading-tight">
                        মোবাইল: {madrasah.phone}
                      </p>
                    )}
                  </div>

                  {/* 2. Receipt Badge */}
                  <div className="flex justify-center my-2">
                    <span className="border border-black px-3 py-0.5 rounded text-[11px] font-black tracking-wider uppercase text-black">
                      {isBangla ? 'ফি আদায় রসিদ' : 'FEE PAYMENT RECEIPT'}
                    </span>
                  </div>

                  {/* 3. Meta Details */}
                  <div className="text-[11px] font-bold leading-relaxed pb-2 border-b border-dashed border-black space-y-0.5">
                    <div className="flex justify-between">
                      <span>{isBangla ? 'রসিদ নং:' : 'Receipt No:'} {receiptId}</span>
                      <span>
                        {new Date().toLocaleDateString(isBangla ? 'bn-BD' : 'en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-black text-[12px] truncate max-w-[65%]">
                        {isBangla ? 'নাম:' : 'Name:'} {mergedStudent.student_name}
                      </span>
                      <span>
                        {isBangla ? 'রোল:' : 'Roll:'} {mergedStudent.roll || '-'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="truncate max-w-[65%]">
                        {isBangla ? 'শ্রেণি:' : 'Class:'} {mergedStudent.class_name || mergedStudent.classes?.class_name || '-'}
                      </span>
                      <span className="font-black text-black">
                        {isBangla ? 'মাস:' : 'Month:'} {month}
                      </span>
                    </div>
                    {mergedStudent.section && (
                      <div className="flex justify-between">
                        <span>{isBangla ? 'শাখা:' : 'Section:'} {mergedStudent.section}</span>
                      </div>
                    )}
                  </div>

                  {/* 4. Table of Fees */}
                  <table className="w-full my-2 text-[11px]">
                    <thead>
                      <tr className="border-b border-dashed border-black">
                        <th className="py-1 text-left font-black">{isBangla ? 'বিবরণ' : 'Description'}</th>
                        <th className="py-1 text-right font-black">{isBangla ? 'পরিমাণ' : 'Amount'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dashed divide-slate-300">
                      {(mergedStudent.fee_items || [
                        { name: isBangla ? 'মাসিক বেতন ও অন্যান্য' : 'Monthly Fee', amount: Number(mergedStudent.total_payable || mergedStudent.total_paid) }
                      ]).map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-1 pr-1 font-bold leading-tight align-top">{item.name}</td>
                          <td className="py-1 pl-1 text-right font-bold align-top whitespace-nowrap">
                            ৳{Number(item.amount).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* 5. Totals & Dues Breakdown */}
                  <div className="border-t border-dashed border-black pt-1.5 space-y-1 text-[11px] font-bold">
                    {Number(mergedStudent.discount) > 0 && (
                      <div className="flex justify-between text-slate-800">
                        <span>{isBangla ? 'ছাড় (Discount):' : 'Discount:'}</span>
                        <span>-৳{Number(mergedStudent.discount).toLocaleString()}</span>
                      </div>
                    )}
                    {mergedStudent.previous_due !== undefined && Number(mergedStudent.previous_due) > 0 && (
                      <div className="flex justify-between text-slate-800">
                        <span>{isBangla ? 'পূর্বের বকেয়া:' : 'Previous Due:'}</span>
                        <span>৳{Number(mergedStudent.previous_due).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-[13px] border-t border-black pt-1">
                      <span>{isBangla ? 'মোট জমা (Paid):' : 'Total Paid:'}</span>
                      <span>৳{Number(mergedStudent.total_paid || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-black text-[12px] border-t border-dotted border-black pt-1">
                      <span>{isBangla ? 'বর্তমান বকেয়া (Due):' : 'Current Due:'}</span>
                      <span>৳{Math.max(0, Number(mergedStudent.balance_due || 0)).toLocaleString()}</span>
                    </div>
                    {mergedStudent.payment_method && (
                      <div className="flex justify-between text-[10px] text-slate-700 pt-0.5">
                        <span>{isBangla ? 'পেমেন্ট মাধ্যম:' : 'Payment Method:'}</span>
                        <span className="uppercase">{mergedStudent.payment_method}</span>
                      </div>
                    )}
                  </div>

                  {/* 6. Footer & Signatures */}
                  <div className="mt-4 pt-2 border-t border-dashed border-black text-center space-y-1.5">
                    <div className="flex justify-between items-end pt-3 pb-1 text-[9px] font-bold">
                      <div className="text-center w-24 border-t border-black pt-0.5">
                        {mergedStudent.collector_name ? (
                          <span className="block truncate">{mergedStudent.collector_name}</span>
                        ) : (
                          <span>{isBangla ? 'আদায়কারী' : 'Collector'}</span>
                        )}
                      </div>
                      <div className="text-center w-24 border-t border-black pt-0.5">
                        <span>{isBangla ? 'অনুমোদনকারী' : 'Authorized'}</span>
                      </div>
                    </div>

                    <p className="text-[11px] font-black tracking-widest uppercase mt-1">
                      {isBangla ? '*** ধন্যবাদ ***' : '*** THANK YOU ***'}
                    </p>

                    {printBranding && (
                      <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest pt-1">
                        Printed via Deenora POS Engine
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Printer Settings, Connection & Action Panel */}
            <div className="lg:col-span-6 space-y-4">
              {/* Status Alert Banner */}
              {statusMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3.5 rounded-2xl flex items-start gap-2.5 text-xs font-bold ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                      : statusMessage.type === 'error'
                      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20'
                      : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20'
                  }`}
                >
                  {statusMessage.type === 'success' && <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />}
                  {statusMessage.type === 'error' && <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />}
                  {statusMessage.type === 'info' && <RefreshCw size={16} className="shrink-0 mt-0.5 text-blue-600" />}
                  <span className="flex-1">{statusMessage.text}</span>
                </motion.div>
              )}

              {/* Printer Connection Card */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {isBangla ? 'প্রিন্টার স্ট্যাটাস' : 'Printer Status'}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black ${
                      printerStatus.isConnected
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        printerStatus.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                      }`}
                    />
                    {printerStatus.isConnected
                      ? isBangla
                        ? `সংযুক্ত: ${printerStatus.name}`
                        : `Connected: ${printerStatus.name}`
                      : isBangla
                      ? 'প্রিন্টার সংযুক্ত নেই'
                      : 'Not Connected'}
                  </span>
                </div>

                {/* Connection Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={handleConnectBluetooth}
                    disabled={isConnecting || isPrinting}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold text-xs flex items-center justify-center gap-2 hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm active:scale-98 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <Loader2 size={16} className="animate-spin text-blue-600" />
                    ) : (
                      <Bluetooth size={16} className="text-blue-600" />
                    )}
                    {isBangla ? 'Bluetooth কানেক্ট' : 'Connect Bluetooth'}
                  </button>

                  <button
                    onClick={handleConnectUsb}
                    disabled={isConnecting || isPrinting}
                    className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-bold text-xs flex items-center justify-center gap-2 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm active:scale-98 disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <Loader2 size={16} className="animate-spin text-indigo-600" />
                    ) : (
                      <Usb size={16} className="text-indigo-600" />
                    )}
                    {isBangla ? 'USB / OTG কানেক্ট' : 'Connect USB / OTG'}
                  </button>
                </div>

                {/* Connected Printer Tools */}
                {printerStatus.isConnected && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      onClick={handleTestPrint}
                      disabled={isPrinting}
                      className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                    >
                      {isPrinting ? <Loader2 size={12} className="animate-spin" /> : <Printer size={12} />}
                      {isBangla ? 'টেস্ট প্রিন্ট দিন' : 'Test Print'}
                    </button>

                    {printerStatus.type !== 'native_bridge' && (
                      <button
                        onClick={handleDisconnect}
                        className="text-rose-600 dark:text-rose-400 font-bold hover:underline"
                      >
                        {isBangla ? 'ডিসকানেক্ট' : 'Disconnect'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Print Settings Section */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isBangla ? 'প্রিন্ট সেটিংস' : 'Print Settings'}
                </h4>

                {/* Paper Size & Copies */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      {isBangla ? 'পেপার সাইজ' : 'Paper Size'}
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-200/60 dark:bg-slate-900 p-1 rounded-xl">
                      <button
                        onClick={() => setPaperSize('58mm')}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                          paperSize === '58mm'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        58mm
                      </button>
                      <button
                        onClick={() => setPaperSize('80mm')}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                          paperSize === '80mm'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        80mm
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      {isBangla ? 'কপি সংখ্যা' : 'Copies'}
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-200/60 dark:bg-slate-900 p-1 rounded-xl">
                      <button
                        onClick={() => setCopies(1)}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                          copies === 1
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        ১ কপি
                      </button>
                      <button
                        onClick={() => setCopies(2)}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all ${
                          copies === 2
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        ২ কপি
                      </button>
                    </div>
                  </div>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={printLogo}
                      onChange={(e) => setPrintLogo(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    {isBangla ? 'লোগো প্রিন্ট' : 'Print Logo'}
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={printBranding}
                      onChange={(e) => setPrintBranding(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    {isBangla ? 'Deenora ব্র্যান্ডিং' : 'Deenora Branding'}
                  </label>
                </div>
              </div>

              {/* Main Print & Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  onClick={handlePrintReceipt}
                  disabled={isPrinting}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/25 active:scale-98 transition-all disabled:opacity-50"
                >
                  {isPrinting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Printer size={18} />
                  )}
                  {isBangla ? '🖨️ রসিদ প্রিন্ট করুন' : '🖨️ Print Receipt'}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDownloadPDF}
                    disabled={isDownloading}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98"
                  >
                    {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    {isBangla ? 'PDF ডাউনলোড' : 'Download PDF'}
                  </button>

                  <button
                    onClick={onClose}
                    className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs transition-all active:scale-98"
                  >
                    {isBangla ? 'বন্ধ করুন' : 'Close'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
