import React from 'react';
import { 
  X, 
  Check, 
  CheckCheck, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  Mic, 
  Send, 
  Users, 
  Info,
  Calendar
} from 'lucide-react';
import { ChatMessage, Conversation } from '../../types';

interface MessageInfoModalProps {
  message: ChatMessage | null;
  conversation: Conversation | null;
  isOpen: boolean;
  onClose: () => void;
  lang?: 'bn' | 'en';
  isDark?: boolean;
}

export const MessageInfoModal: React.FC<MessageInfoModalProps> = ({
  message,
  conversation,
  isOpen,
  onClose,
  lang = 'bn',
  isDark = false,
}) => {
  if (!isOpen || !message) return null;

  const createdAtDate = new Date(message.created_at);
  const formattedDate = createdAtDate.toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = createdAtDate.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isGroup = conversation?.type === 'class_group';

  // Read / Delivered mock data fallback if missing in DB
  const deliveredTime = message.delivered_at 
    ? new Date(message.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : formattedTime;

  const readTime = message.read_at 
    ? new Date(message.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : message.read_by && message.read_by.length > 0 
    ? new Date(message.read_by[0].read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // Group read list
  const readList = message.read_by || [
    { user_id: '1', user_name: 'আহমেদ হাসান', role: 'শিক্ষক', read_at: formattedTime },
    { user_id: '2', user_name: 'রহিম উল্লাহ', role: 'অভিভাবক', read_at: formattedTime },
  ];

  const deliveredList = message.delivered_to || [
    { user_id: '3', user_name: 'করিম হোসেন', role: 'অভিভাবক', delivered_at: formattedTime },
    { user_id: '4', user_name: 'হাসান মাহমুদ', role: 'শিক্ষক', delivered_at: formattedTime },
  ];

  const charCount = message.message ? message.message.length : 0;

  return (
    <div className="fixed inset-0 z-[230] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/65 backdrop-blur-xs animate-in fade-in duration-200">
      
      {/* Backdrop click to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Container */}
      <div 
        className={`relative z-10 w-full sm:max-w-md max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 duration-250 ${
          isDark ? 'text-slate-100' : 'text-slate-800'
        }`}
      >
        {/* Handle bar on mobile */}
        <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto mt-3 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="p-4 px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {lang === 'bn' ? 'মেসেজ বিবরণী (Message Info)' : 'Message Info'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {conversation?.name || (lang === 'bn' ? 'চ্যাট তথ্য' : 'Chat Details')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Scroll Area */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          
          {/* Message Preview Box */}
          <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200/80'}`}>
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium mb-2 pb-1.5 border-b border-slate-200/60 dark:border-slate-700/60">
              <span className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
                {message.message_type === 'image' ? (
                  <>
                    <ImageIcon className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'ছবি (Image)' : 'Image'}
                  </>
                ) : message.message_type === 'document' ? (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'ডকুমেন্ট (Document)' : 'Document'}
                  </>
                ) : message.message_type === 'voice' ? (
                  <>
                    <Mic className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'ভয়েস মেসেজ (Voice)' : 'Voice Message'}
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5" />
                    {lang === 'bn' ? 'টেক্সট মেসেজ' : 'Text Message'}
                  </>
                )}
              </span>

              <span>{charCount > 0 ? `${charCount} ${lang === 'bn' ? 'বর্ণ' : 'chars'}` : ''}</span>
            </div>

            <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap break-words text-slate-800 dark:text-slate-100">
              {message.message || (lang === 'bn' ? '[সংযুক্ত ফাইল/মিডিয়া]' : '[Attachment File]')}
            </p>

            <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              <span>{formattedDate}, {formattedTime}</span>
            </div>
          </div>

          {/* Delivery & Read Status Timeline */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              {lang === 'bn' ? 'স্ট্যাটাস ও সময়সীমা (Status)' : 'Status Timeline'}
            </h4>

            <div className={`p-4 rounded-2xl border space-y-4 ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200/80'}`}>
              
              {/* Sent */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {lang === 'bn' ? 'পাঠানো হয়েছে (Sent)' : 'Sent'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {formattedTime}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formattedDate}
                  </p>
                </div>
              </div>

              {/* Delivered */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {lang === 'bn' ? 'পৌঁছেছে (Delivered)' : 'Delivered'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {deliveredTime}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {formattedDate}
                  </p>
                </div>
              </div>

              {/* Read */}
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      {lang === 'bn' ? 'পড়া হয়েছে (Read)' : 'Read'}
                    </span>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                      {readTime || (lang === 'bn' ? 'এখনো দেখা হয়নি' : 'Not read yet')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {readTime ? formattedDate : (lang === 'bn' ? 'গ্রহীতা মেসেজটি দেখার অপেক্ষায়' : 'Waiting for recipient to read')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Group Chat Breakdown (Read by & Delivered to) */}
          {isGroup && (
            <div className="space-y-3 pt-2">
              {/* Read By List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {lang === 'bn' ? 'যারা পড়েছেন (Read by)' : 'Read by'} ({readList.length})
                </h4>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                  {readList.map((user) => (
                    <div key={user.user_id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {user.user_name.charAt(0)}
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{user.user_name}</p>
                          <span className="text-[10px] text-slate-400 font-medium">{user.role || 'সদস্য'}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 shrink-0">
                        {user.read_at}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivered To List */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                  {lang === 'bn' ? 'যাদের কাছে পৌঁছেছে (Delivered to)' : 'Delivered to'} ({deliveredList.length})
                </h4>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                  {deliveredList.map((user) => (
                    <div key={user.user_id} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0">
                          {user.user_name.charAt(0)}
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{user.user_name}</p>
                          <span className="text-[10px] text-slate-400 font-medium">{user.role || 'সদস্য'}</span>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 shrink-0">
                        {user.delivered_at}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
