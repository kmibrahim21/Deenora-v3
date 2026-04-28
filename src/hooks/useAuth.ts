
import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabase';
import { OfflineService } from 'services/OfflineService';
import { Profile, Institution, AcademicYear } from 'types';
import { isValidUUID } from '../utils/validation';
import { hardReload } from '../utils/reloadUtils';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [madrasah, setMadrasah] = useState<Institution | null>(null);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchActiveYear = async (institutionId: string) => {
    if (!isValidUUID(institutionId)) return;
    try {
      const { data: year } = await supabase
        .from('academic_years')
        .select('*')
        .eq('institution_id', institutionId)
        .eq('status', 'active')
        .maybeSingle();
      
      if (year) {
        setActiveYear(year);
      }
    } catch (err) {
      console.error("Error fetching active year:", err);
    }
  };

  const fetchUserProfile = async (userId: string, email?: string, retryCount = 0) => {
    if (!isValidUUID(userId)) {
      setLoading(false);
      return;
    }
    
    const userEmail = email?.trim().toLowerCase();
    const superAdminEmails = [
      'kmibrahim@gmail.com',
      'thedevomix@gmail.com',
      'ibrahimkhan269596@gmail.com',
      'admin@deenora.com'
    ];
    const isSuperAdminEmail = superAdminEmails.includes(userEmail || '');

    try {
      console.log(`Fetching profile for user: ${userId} (Attempt ${retryCount + 1}/5)`);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) {
        throw profileError;
      }

      if (profileData) {
        const finalProfile = isSuperAdminEmail 
          ? { ...profileData, role: 'super_admin' as const } 
          : profileData;
          
        setProfile(finalProfile);
        OfflineService.setCache('user_profile', finalProfile);
        
        if (isValidUUID(finalProfile.institution_id)) {
          const { data: institutionData, error: mError } = await supabase
            .from('institutions')
            .select('*')
            .eq('id', finalProfile.institution_id)
            .maybeSingle();

          if (mError) throw mError;
          
          if (institutionData) {
            if (finalProfile.role === 'super_admin') {
              institutionData.theme = localStorage.getItem('super_admin_theme') || 'default';
            }
            setMadrasah(institutionData);
            OfflineService.setCache('profile', institutionData);
            await fetchActiveYear(institutionData.id);
          }
        } else if (finalProfile.role === 'super_admin') {
          const localTheme = localStorage.getItem('super_admin_theme') || 'default';
          setMadrasah({
            id: 'super_admin',
            name: 'Super Admin',
            institution_type: 'system',
            theme: localTheme,
            config_json: { modules: {} },
            is_active: true,
            status: 'active',
            balance: 0,
            sms_balance: 0,
            is_super_admin: true,
            created_at: new Date().toISOString()
          } as Institution);
        }
      } else {
        if (isSuperAdminEmail) {
          await supabase.rpc('bootstrap_super_admin', { p_uid: userId, p_email: userEmail });
          return fetchUserProfile(userId, email, 0);
        }
        setAuthError("প্রোফাইল খুঁজে পাওয়া যায়নি। (Profile not found)");
      }
    } catch (err: any) {
      const isNetworkError = 
        err?.message?.toLowerCase().includes('fetch') || 
        err?.message?.toLowerCase().includes('network') ||
        err?.message?.toLowerCase().includes('load') ||
        !navigator.onLine;

      if (isNetworkError && retryCount < 4) {
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 2000));
        return fetchUserProfile(userId, email, retryCount + 1);
      }

      // Try cache fallback
      const cachedMadrasah = OfflineService.getCache('profile');
      const cachedProfile = OfflineService.getCache('user_profile');
      if (cachedMadrasah || cachedProfile) {
        if (cachedMadrasah) setMadrasah(cachedMadrasah);
        if (cachedProfile) setProfile(cachedProfile);
        setLoading(false);
        return;
      }

      setAuthError(isNetworkError ? "ইন্টারনেট সংযোগ বিচ্ছিন্ন! (Connection failed)" : (err.message || "Unknown Error"));
    } finally {
      setLoading(false);
    }
  };

  const refreshMadrasah = async () => {
    if (session?.user?.id) {
      await fetchUserProfile(session.user.id, session.user.email);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('teacher_session');
    OfflineService.removeCache('profile');
    OfflineService.removeCache('user_profile');
    hardReload();
  };

  useEffect(() => {
    const initializeAuth = async (retryCount = 0) => {
      // Emergency timeout
      const safetyTimeout = setTimeout(() => {
        const cachedProfile = OfflineService.getCache('user_profile');
        const cachedMadrasah = OfflineService.getCache('profile');
        if (cachedProfile || cachedMadrasah) {
          if (cachedProfile) setProfile(cachedProfile);
          if (cachedMadrasah) setMadrasah(cachedMadrasah);
          setLoading(false);
        }
      }, 8000);

      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          if ((error.message.includes('fetch') || error.message.includes('network')) && retryCount < 2) {
            clearTimeout(safetyTimeout);
            await new Promise(resolve => setTimeout(resolve, 2000));
            return initializeAuth(retryCount + 1);
          }
          if (error.message.includes('refresh token') || error.message.includes('invalid_grant')) {
            clearTimeout(safetyTimeout);
            await handleLogout();
            return;
          }
        }

        if (currentSession && currentSession.user) {
          setSession(currentSession);
          
          const teacherSessionStr = localStorage.getItem('teacher_session');
          if (teacherSessionStr) {
            try {
              const teacherData = JSON.parse(teacherSessionStr);
              const { data: latestTeacher } = await supabase.from('teachers').select('*').eq('id', teacherData.id).maybeSingle();

              if (latestTeacher && latestTeacher.is_active) {
                const profileObj = {
                  id: latestTeacher.id,
                  institution_id: latestTeacher.institution_id,
                  full_name: latestTeacher.name,
                  role: 'teacher' as const,
                  is_active: latestTeacher.is_active,
                  created_at: latestTeacher.created_at,
                  permissions: latestTeacher.permissions
                };
                setProfile(profileObj);
                OfflineService.setCache('user_profile', profileObj);
                
                if (isValidUUID(latestTeacher.institution_id)) {
                  const { data: inst } = await supabase.from('institutions').select('*').eq('id', latestTeacher.institution_id).maybeSingle();
                  if (inst) {
                    setMadrasah(inst);
                    OfflineService.setCache('profile', inst);
                  }
                }
                clearTimeout(safetyTimeout);
                setLoading(false);
                return;
              }
            } catch (e) {
              console.error("Teacher session error:", e);
            }
          }
          await fetchUserProfile(currentSession.user.id, currentSession.user.email);
        } else {
          const hasAuthToken = !!localStorage.getItem('madrasah_auth_token');
          if (!hasAuthToken) localStorage.removeItem('teacher_session');
        }
      } catch (err) {
        console.error("Init Auth error:", err);
      } finally {
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !session) {
        setSession(null); setMadrasah(null); setProfile(null);
        localStorage.removeItem('teacher_session');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          setSession(session);
          if (session.user) fetchUserProfile(session.user.id, session.user.email);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let channel: any;
    if (profile?.institution_id && profile.institution_id !== 'super_admin') {
      channel = supabase.channel('institution-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'institutions', filter: `id=eq.${profile.institution_id}` },
          (payload) => setMadrasah(payload.new as Institution)
        ).subscribe();
    }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [profile?.institution_id]);

  return { session, profile, madrasah, activeYear, loading, authError, handleLogout, refreshMadrasah };
};
