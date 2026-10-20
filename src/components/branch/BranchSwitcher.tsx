import React, { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Check, Plus, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { Institution, Language } from 'types';
import { BranchManagementModal } from './BranchManagementModal';

interface BranchItem {
  id: string;
  name: string;
  isMain: boolean;
  address: string;
  phone: string;
  institution_type: string;
  studentCount: number;
  teacherCount: number;
}

interface BranchSwitcherProps {
  madrasah: Institution | null;
  lang: Language;
  activeBranchId: string | null;
  onSwitchBranch: (branchId: string) => void;
  compact?: boolean;
}

export const BranchSwitcher: React.FC<BranchSwitcherProps> = ({
  madrasah,
  lang,
  activeBranchId,
  onSwitchBranch,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isDark = madrasah?.theme === 'dark';

  const fetchBranches = async () => {
    if (!madrasah?.id) return;
    setLoading(true);
    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get-branches',
          institutionId: madrasah.id
        })
      });
      const data = await res.json();
      if (res.ok && data.branches) {
        setBranches(data.branches);
      }
    } catch (e) {
      console.error('Error fetching branches in switcher:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, [madrasah?.id]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentActiveId = activeBranchId || madrasah?.id;
  const currentBranch = branches.find(b => b.id === currentActiveId) || {
    id: madrasah?.id || '',
    name: madrasah?.name || 'Main Campus',
    isMain: !(madrasah?.config_json as any)?.parent_institution_id
  };

  const hasMultiple = branches.length > 1;

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) fetchBranches();
          }}
          className={`flex items-center gap-2 rounded-xl transition-all font-noto ${
            compact 
              ? 'px-2.5 py-1 text-xs border' 
              : 'px-3.5 py-2 text-sm border shadow-sm'
          } ${
            isDark 
              ? 'bg-slate-800/80 border-slate-700/80 hover:bg-slate-800 text-slate-200' 
              : 'bg-white/90 border-slate-200 hover:bg-white text-slate-800'
          }`}
          title={lang === 'bn' ? 'শাখা পরিবর্তন ও পরিচালনা' : 'Switch Branch'}
        >
          <Building2 size={compact ? 14 : 16} className="text-blue-500 shrink-0" />
          <span className="font-bold truncate max-w-[150px] md:max-w-[220px]">
            {currentBranch.name}
          </span>
          {hasMultiple && (
            <span className="px-1.5 py-0.2 text-[10px] font-black rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
              {branches.length}
            </span>
          )}
          <ChevronDown size={compact ? 12 : 14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div 
            className={`absolute left-0 mt-2 w-72 md:w-80 rounded-2xl border shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-100 text-slate-800'
            }`}
          >
            <div className={`p-3 border-b text-xs flex items-center justify-between font-bold ${
              isDark ? 'bg-slate-800/50 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-500'
            }`}>
              <span>{lang === 'bn' ? 'শাখা নির্বাচন করুন' : 'Select Branch'}</span>
              <span className="text-[10px] tabular-nums font-mono text-slate-400">{branches.length} Campus</span>
            </div>

            <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
              {loading && branches.length === 0 ? (
                <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                  <Loader2 size={16} className="animate-spin text-blue-500" />
                  <span>{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</span>
                </div>
              ) : (
                branches.map((b) => {
                  const isSelected = b.id === currentActiveId;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        if (!isSelected) {
                          onSwitchBranch(b.id);
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-3 ${
                        isSelected 
                          ? isDark 
                            ? 'bg-blue-600/20 text-blue-400' 
                            : 'bg-blue-50 text-blue-700 font-bold'
                          : isDark 
                            ? 'hover:bg-slate-800 text-slate-300' 
                            : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold truncate block">{b.name}</span>
                          {b.isMain && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black">
                              {lang === 'bn' ? 'মূল' : 'Main'}
                            </span>
                          )}
                        </div>
                        {b.address && (
                          <span className="text-[10px] text-slate-400 truncate block mt-0.5">{b.address}</span>
                        )}
                      </div>
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 tabular-nums shrink-0 font-medium">
                          {b.studentCount} {lang === 'bn' ? 'ছাত্র' : 'st'}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Bottom Action: Manage Branches */}
            <div className={`p-2 border-t flex flex-col gap-1 ${isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-100 bg-slate-50/50'}`}>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setShowManageModal(true);
                }}
                className="w-full py-2 px-3 rounded-xl text-xs font-bold text-blue-600 hover:text-blue-500 hover:bg-blue-500/10 dark:text-blue-400 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus size={14} />
                <span>{lang === 'bn' ? 'শাখা ও ক্যাম্পাস পরিচালনা' : 'Manage & Add Branches'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <BranchManagementModal
        isOpen={showManageModal}
        onClose={() => {
          setShowManageModal(false);
          fetchBranches();
        }}
        madrasah={madrasah}
        lang={lang}
        activeBranchId={activeBranchId}
        onSwitchBranch={onSwitchBranch}
      />
    </>
  );
};
