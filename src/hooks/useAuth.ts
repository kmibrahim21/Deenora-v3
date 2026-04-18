
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

    console.log("Auth Debug:", { userId, userEmail, isSuperAdminEmail, retryCount });

    try {
      // First, get the profile
      console.log(`Fetching profile for user: ${userId} (Attempt ${retryCount + 1}/5)`);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) {
        throw profileError;
      }

      console.log("Profile data response:", profileData);

      if (profileData) {
        console.log("Profile loaded:", { id: profileData.id, role: profileData.role, institution_id: profileData.institution_id });
        // Force super_admin role for the designated email
        const finalProfile = isSuperAdminEmail 
          ? { ...profileData, role: 'super_admin' as const } 
          : profileData;
          
        setProfile(finalProfile);
        OfflineService.setCache('user_profile', finalProfile);
        
        // Then get the institution if institution_id exists and is valid
        if (isValidUUID(finalProfile.institution_id)) {
          console.log("Fetching institution for ID:", finalProfile.institution_id);
          const { data: institutionData, error: mError } = await supabase
            .from('institutions')
            .select('*')
            .eq('id', finalProfile.institution_id)
            .maybeSingle();

          if (mError) {
            console.error("Institution fetch error:", mError);
            throw mError;
          }
          
          if (institutionData) {
            console.log("Institution loaded:", { id: institutionData.id, name: institutionData.name });
            if (finalProfile.role === 'super_admin') {
              institutionData.theme = localStorage.getItem('super_admin_theme') || 'default';
            }
            setMadrasah(institutionData);
            OfflineService.setCache('profile', institutionData);
            await fetchActiveYear(institutionData.id);
          } else {
            setMadrasah(null);
          }
        } else if (finalProfile.role === 'super_admin') {
          // Super admins might not have a institution_id
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
        // If profile doesn't exist yet, it might be the trigger lagging or 
        // a manual auth user without SQL data.
        if (isSuperAdminEmail) {
          console.log("Super admin profile missing, bootstrapping...");
          await supabase.rpc('bootstrap_super_admin', { 
            p_uid: userId, 
            p_email: userEmail 
          });
          // Retry fetch once
          const { data: retryProfile } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
          if (retryProfile) {
            setProfile({ ...retryProfile, role: 'super_admin' });
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
            return;
          }
        }
        
        setAuthError("Profile not found in database. Please check if SQL triggers are running.");
      }
    } catch (err: any) {
      const isNetworkError = 
        err?.message?.toLowerCase().includes('fetch') || 
        err?.message?.toLowerCase().includes('network') ||
        err?.message?.toLowerCase().includes('load') ||
        err?.name === 'TypeError' ||
        err?.code === 'PGRST301' || // Network/timeout
        !navigator.onLine;

      // Retry logic for network errors - increased to 4 retries (Total 5 attempts)
      if (isNetworkError && retryCount < 4) {
        const delay = (retryCount + 1) * 2000;
        console.log(`Network error detected, retrying in ${delay/1000} seconds (Attempt ${retryCount + 1}/5)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchUserProfile(userId, email, retryCount + 1);
      }

      console.error("fetchUserProfile error details:", {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
        fullError: err,
        retryCount
      });
      
      // Resilience: If it's a network error and we are super admin, we can still load
      if (isSuperAdminEmail && isNetworkError) {
        console.log("Network error but super admin detected, using local fallback...");
        setProfile({
          id: userId,
          institution_id: 'super_admin',
          full_name: 'Super Admin',
          role: 'super_admin',
          is_active: true,
          created_at: new Date().toISOString()
        } as Profile);
        
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
        setLoading(false);
        return;
      }

      // Try to load from cache if network fails
      const cachedMadrasah = OfflineService.getCache('profile');
      const cachedProfile = OfflineService.getCache('user_profile');
      
      if (cachedMadrasah || cachedProfile) {
        console.log("Network error, using cached auth data...");
        if (cachedMadrasah) setMadrasah(cachedMadrasah);
        if (cachedProfile) setProfile(cachedProfile);
        
        // If we have cached data, don't show a fatal auth error for network issues
        if (isNetworkError) {
          setLoading(false);
          return;
        }
      }

      if (isNetworkError) {
        setAuthError("সার্ভারের সাথে সংযোগ করা যাচ্ছে না! দয়া করে আপনার ইন্টারনেট কানেকশন চেক করুন এবং পুনরায় চেষ্টা করুন। (Connection failed - please check your internet and reload)");
      } else {
        setAuthError(err.message || "An unknown authentication error occurred.");
      }
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
    hardReload();
  };

  useEffect(() => {
    const initializeAuth = async (retryCount = 0) => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error(`Auth session error (Attempt ${retryCount + 1}):`, error);
          const errorMessage = error.message.toLowerCase();
          
          // Retry for network issues
          const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network');
          if (isNetworkError && retryCount < 2) {
             await new Promise(resolve => setTimeout(resolve, 2000));
             return initializeAuth(retryCount + 1);
          }

          // Only force logout on definitive token errors
          const isTokenError = errorMessage.includes('refresh token') || 
                               errorMessage.includes('refresh_token_not_found') ||
                               errorMessage.includes('invalid_grant');

          if (isTokenError) {
            console.warn("Definitive token error detected, signing out...");
            await supabase.auth.signOut();
            localStorage.removeItem('madrasah_auth_token');
            localStorage.removeItem('teacher_session');
            OfflineService.removeCache('profile');
            setSession(null);
            setProfile(null);
            setMadrasah(null);
            // Don't reload immediately to avoid loops, let the UI handle the state change
            return;
          }
          
          // For other errors (like network), we might still have a session in memory or cache
          // We'll try to proceed with what we have
        }

        if (currentSession && currentSession.user) {
          setSession(currentSession);
          
          // Check if it's a teacher session
          const teacherSessionStr = localStorage.getItem('teacher_session');
          if (teacherSessionStr) {
            try {
              const teacherData = JSON.parse(teacherSessionStr);
              if (teacherData && teacherData.id) {
                // Fetch latest teacher data to get updated permissions and check active status
                try {
                  const { data: latestTeacher } = await supabase
                    .from('teachers')
                    .select('*')
                    .eq('id', teacherData.id)
                    .maybeSingle();

                  if (latestTeacher) {
                    if (!latestTeacher.is_active) {
                      localStorage.removeItem('teacher_session');
                      setProfile(null);
                      setMadrasah(null);
                      setLoading(false);
                      return;
                    }

                    setProfile({
                      id: latestTeacher.id,
                      institution_id: latestTeacher.institution_id,
                      full_name: latestTeacher.name,
                      role: 'teacher',
                      is_active: latestTeacher.is_active,
                      created_at: latestTeacher.created_at,
                      permissions: latestTeacher.permissions
                    });
                    // Update local storage too
                    localStorage.setItem('teacher_session', JSON.stringify(latestTeacher));
                    
                    // Fetch madrasah data
                    if (isValidUUID(latestTeacher.institution_id)) {
                      const { data: institutionData } = await supabase
                        .from('institutions')
                        .select('*')
                        .eq('id', latestTeacher.institution_id)
                        .maybeSingle();
                        
                      if (institutionData) {
                        setMadrasah(institutionData);
                      }
                    }
                  } else {
                    throw new Error('Teacher not found');
                  }
                } catch (fetchErr) {
                  console.log("Teacher fetch failed (likely offline), using cached session...");
                  // Fallback to stored data if fetch fails (e.g. offline)
                  setProfile({
                    id: teacherData.id,
                    institution_id: teacherData.institution_id,
                    full_name: teacherData.name,
                    role: 'teacher',
                    is_active: teacherData.is_active,
                    created_at: teacherData.created_at,
                    permissions: teacherData.permissions
                  });
                  
                  // Try to get cached madrasah
                  const cachedMadrasah = OfflineService.getCache('profile');
                  if (cachedMadrasah) {
                    setMadrasah(cachedMadrasah);
                  }
                }
                
                setLoading(false);
                return; // Skip fetching regular profile
              }
            } catch (e) {
              console.error("Error parsing teacher session:", e);
            }
          }
          
          await fetchUserProfile(currentSession.user.id, currentSession.user.email);
        } else {
          // If there's no Supabase session, we shouldn't trust teacher_session
          // because all RLS queries will fail anyway.
          const teacherSessionStr = localStorage.getItem('teacher_session');
          if (teacherSessionStr) {
            localStorage.removeItem('teacher_session');
          }
        }
      } catch (err: any) {
        console.error("Auth initialization error:", err);
        const errorMessage = (err?.message || '').toLowerCase();
        const isTokenError = errorMessage.includes('refresh token') || 
                             errorMessage.includes('refresh_token_not_found') ||
                             errorMessage.includes('invalid_grant');

        if (isTokenError) {
          localStorage.removeItem('madrasah_auth_token');
          localStorage.removeItem('teacher_session');
          OfflineService.removeCache('profile');
          setSession(null);
          setProfile(null);
          setMadrasah(null);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event:", event);
      if (event === 'SIGNED_OUT') {
        setSession(null); 
        setMadrasah(null); 
        setProfile(null);
        localStorage.removeItem('teacher_session');
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          setSession(session);
          if (session.user) {
            fetchUserProfile(session.user.id, session.user.email);
          }
        }
      } else if (session) {
        setSession(session);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let channel: any;
    if (profile?.institution_id && profile.institution_id !== 'super_admin') {
      channel = supabase
        .channel('institution-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'institutions',
            filter: `id=eq.${profile.institution_id}`,
          },
          (payload) => {
            console.log('useAuth: Received real-time update for institution:', payload.new);
            setMadrasah(payload.new as Institution);
          }
        )
        .subscribe();
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [profile?.institution_id]);

  return { session, profile, madrasah, activeYear, loading, authError, handleLogout, refreshMadrasah };
};
