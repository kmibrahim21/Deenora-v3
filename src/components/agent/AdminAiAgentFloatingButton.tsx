import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Institution, Profile, Language } from '../../types';
import AdminAiAgentDrawer from './AdminAiAgentDrawer';
import mascotLogo from '../../assets/images/deenora_ai_logo_1791022053953.jpg';

interface AdminAiAgentFloatingButtonProps {
  madrasah: Institution | null;
  profile: Profile | null;
  lang: Language;
}

export const AdminAiAgentFloatingButton: React.FC<AdminAiAgentFloatingButtonProps> = ({
  madrasah,
  profile,
  lang
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Only show for super admins and managers
  const role = profile?.role;
  const isAuthorized = role === 'super_admin' || role === 'manager';

  if (!isAuthorized) return null;

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="relative group flex items-center gap-2 p-1.5 pr-3 sm:p-2 sm:pr-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white rounded-full shadow-lg sm:shadow-xl shadow-blue-600/35 hover:shadow-blue-600/50 active:scale-95 transition-all cursor-pointer border border-white/20 backdrop-blur-md"
          title="Deenora AI সহকারী"
          aria-label="Open AI Assistant"
        >
          {/* Subtle online status indicator */}
          <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 flex h-3 w-3 sm:h-3.5 sm:w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 sm:h-3.5 sm:w-3.5 bg-emerald-500 border-2 border-white"></span>
          </span>

          {/* 3D Mascot Icon */}
          <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden border-2 border-white/40 shadow-inner group-hover:scale-105 transition-transform shrink-0">
            <img 
              src={mascotLogo} 
              alt="Deenora AI" 
              className="w-full h-full object-cover" 
            />
          </div>

          <span className="font-black text-xs sm:text-sm font-solaiman tracking-wide">
            AI সহকারী
          </span>

          <Sparkles size={11} className="text-amber-300 animate-pulse -ml-0.5" />
        </button>
      </div>

      {/* Slide-over Drawer / Modal */}
      <AdminAiAgentDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        madrasah={madrasah}
        profile={profile}
        lang={lang}
      />
    </>
  );
};

export default AdminAiAgentFloatingButton;
