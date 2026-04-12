
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Institution, Language, Profile, AcademicYear, UserRole } from '../types';
import { useAuth } from '../hooks/useAuth';

interface MadrasahContextType {
  madrasah: Institution | null;
  profile: Profile | null;
  session: any;
  activeYear: AcademicYear | null;
  loading: boolean;
  authError: string | null;
  lang: Language;
  setLang: (lang: Language) => void;
  triggerRefresh: () => void;
  handleLogout: () => void;
  role: UserRole;
  userId: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  dataVersion: number;
  statusModal: {
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  };
  setStatusModal: (modal: {
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }) => void;
}

const MadrasahContext = createContext<MadrasahContextType | undefined>(undefined);

export const MadrasahProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    session,
    profile,
    madrasah,
    activeYear,
    loading,
    authError,
    handleLogout,
    refreshMadrasah,
  } = useAuth();

  const [lang, setLangState] = useState<Language>(
    () => (localStorage.getItem("app_lang") as Language) || "bn",
  );
  const [dataVersion, setDataVersion] = useState(0);
  const [statusModal, setStatusModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    show: false,
    type: "success",
    title: "",
    message: "",
  });

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("app_lang", newLang);
  }, []);

  const triggerRefresh = useCallback(() => {
    setDataVersion((prev) => prev + 1);
    refreshMadrasah();
  }, [refreshMadrasah]);

  const role = profile?.role || "accountant";
  const userId = session?.user?.id || null;
  const isAdmin = role === "madrasah_admin" || role === "super_admin";
  const isSuperAdmin = role === "super_admin";

  const value = useMemo(() => ({
    madrasah,
    profile,
    session,
    activeYear,
    loading,
    authError,
    lang,
    setLang,
    triggerRefresh,
    handleLogout,
    role,
    userId,
    isAdmin,
    isSuperAdmin,
    dataVersion,
    statusModal,
    setStatusModal,
  }), [
    madrasah,
    profile,
    session,
    activeYear,
    loading,
    authError,
    lang,
    setLang,
    triggerRefresh,
    handleLogout,
    role,
    userId,
    isAdmin,
    isSuperAdmin,
    dataVersion,
    statusModal,
  ]);

  return (
    <MadrasahContext.Provider value={value}>
      {children}
    </MadrasahContext.Provider>
  );
};

export const useMadrasah = () => {
  const context = useContext(MadrasahContext);
  if (context === undefined) {
    throw new Error('useMadrasah must be used within a MadrasahProvider');
  }
  return context;
};
