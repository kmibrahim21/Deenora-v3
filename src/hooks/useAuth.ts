
import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabase';
import { OfflineService } from 'services/OfflineService';
import { Profile, Institution, AcademicYear } from 'types';
import { isValidUUID } from '../utils/validation';
import { hardReload } from '../utils/reloadUtils';
import { requestManager } from 'services/RequestManager';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [madrasah, setMadrasah] = useState<Institution | null>(null);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [selectedYearState, setSelectedYearState] = useState<AcademicYear | null>(() => {
    try {
      const saved = sessionStorage.getItem('selected_viewing_year');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const setSelectedYear = (year: AcademicYear | null) => {
    setSelectedYearState(year);
    try {
      if (year) {
        sessionStorage.setItem('selected_viewing_year', JSON.stringify(year));
      } else {
        sessionStorage.removeItem('selected_viewing_year');
      }
    } catch (e) {}
  };

  const resetToActiveYear = () => {
    setSelectedYear(activeYear);
  };

  const viewingYear = selectedYearState || activeYear;
  const isHistoricalMode = Boolean(
    viewingYear && activeYear && viewingYear.id !== activeYear.id
  );

  const fetchActiveYear = async (institutionId: string) => {
    if (!isValidUUID(institutionId)) return;
    try {
      const { data: year } = await requestManager.cachedFetch(
        'academic_years',
        (q) => q.select('id, year_name, start_date, end_date, status').eq('institution_id', institutionId).eq('status', 'active'),
        `active_year:${institutionId}`
      );
      
      if (year) {
        // Handle maybeSingle logic
        const singleYear = Array.isArray(year) ? year[0] : year;
        if (singleYear) {
          setActiveYear(singleYear);
          if (!selectedYearState) {
            setSelectedYearState(singleYear);
          }
        }
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
      // Try to load from cache immediately for instant UI
      const cachedProfile = OfflineService.getCache('user_profile');
      const cachedMadrasah = OfflineService.getCache('profile');
      
      if (cachedProfile && (cachedProfile.id === userId || isSuperAdminEmail)) {
        setProfile(cachedProfile);
        if (cachedMadrasah) {
          setMadrasah(cachedMadrasah);
          setLoading(false); // Hide splash if we have cached data
        }
      }

      // 1. Get the profile (Cached with Revalidation)
      const { data: profileData, error: profileError } = await requestManager.cachedFetch(
        'profiles',
        (q) => q.select('id, institution_id, full_name, role, is_active, created_at, permissions').eq('id', userId),
        `profile:${userId}`
      );
      
      if (profileError) throw profileError;

      // Handle maybeSingle
      const singleProfileData = Array.isArray(profileData) ? profileData[0] : profileData;

      if (singleProfileData) {
        let finalProfile = isSuperAdminEmail 
          ? { ...singleProfileData, role: 'super_admin' as const } 
          : singleProfileData;
          
        // If the user is a manager, prioritize individual manager permissions
        if (finalProfile.role === 'manager') {
          // If manager doesn't have permissions defined, fallback to global manager permissions
          if (!finalProfile.permissions || Object.keys(finalProfile.permissions).length === 0) {
            try {
              const { data: sysSettings } = await requestManager.cachedFetch(
                'system_settings',
                (q) => q.select('manager_permissions').eq('id', '00000000-0000-0000-0000-000000000001').single(),
                'global_manager_permissions'
              );
              if (sysSettings?.manager_permissions) {
                finalProfile = {
                  ...finalProfile,
                  permissions: sysSettings.manager_permissions
                };
              }
            } catch (err) {
              console.error("Error fetching global manager permissions:", err);
            }
          }
        }
          
        setProfile(finalProfile);
        OfflineService.setCache('user_profile', finalProfile);
        
        // 2. Get the institution (Cached)
        if (isValidUUID(finalProfile.institution_id)) {
          const activeBranchId = typeof window !== 'undefined' ? (sessionStorage.getItem('active_branch_id') || localStorage.getItem('active_branch_id')) : null;
          const targetInstId = (activeBranchId && isValidUUID(activeBranchId)) ? activeBranchId : finalProfile.institution_id;

          const { data: institutionData, error: mError } = await requestManager.cachedFetch(
            'institutions',
            (q) => q.select('id, name, address, phone, contact_email, logo_url, institution_type, config_json, theme, status, is_active, is_super_admin, created_at, email, balance, sms_balance, subscription_end, voice_sender_id, sms_rate, voice_rate').eq('id', targetInstId),
            `institution:${targetInstId}`
          );

          if (mError) throw mError;
          
          let singleInstitution = Array.isArray(institutionData) ? institutionData[0] : institutionData;

          // If client-side RLS query returned null for child branch, fetch via backend API fallback
          if (!singleInstitution && targetInstId !== finalProfile.institution_id) {
            try {
              const res = await fetch('/api/branches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'get-branches', institutionId: finalProfile.institution_id })
              });
              if (res.ok) {
                const bData = await res.json();
                if (bData.branches) {
                  const found = bData.branches.find((b: any) => b.id === targetInstId);
                  if (found) {
                    singleInstitution = {
                      id: found.id,
                      name: found.name,
                      address: found.address,
                      phone: found.phone,
                      contact_email: found.contact_email,
                      institution_type: found.institution_type,
                      status: found.status,
                      is_active: found.is_active,
                      balance: found.balance,
                      sms_balance: found.sms_balance,
                      voice_sender_id: found.voice_sender_id,
                      voice_rate: found.voice_rate,
                      theme: found.theme || 'default',
                      config_json: { parent_institution_id: found.isMain ? null : bData.rootId },
                      created_at: found.created_at
                    };
                  }
                }
              }
            } catch (err) {
              console.warn('API branch fallback error in useAuth:', err);
            }

            if (!singleInstitution) {
              sessionStorage.removeItem('active_branch_id');
              localStorage.removeItem('active_branch_id');
              const { data: fallbackData } = await requestManager.cachedFetch(
                'institutions',
                (q) => q.select('id, name, address, phone, contact_email, logo_url, institution_type, config_json, theme, status, is_active, is_super_admin, created_at, email, balance, sms_balance, subscription_end, voice_sender_id, sms_rate, voice_rate').eq('id', finalProfile.institution_id),
                `institution:${finalProfile.institution_id}`
              );
              singleInstitution = Array.isArray(fallbackData) ? fallbackData[0] : fallbackData;
            }
          }

          if (singleInstitution) {
            // Support branch allocated balance with parent fallback if undefined
            const parentInstId = (singleInstitution.config_json as any)?.parent_institution_id;
            if (parentInstId && isValidUUID(parentInstId)) {
              try {
                const { data: parentInst } = await supabase
                  .from('institutions')
                  .select('sms_balance, balance')
                  .eq('id', parentInstId)
                  .maybeSingle();
                if (parentInst) {
                  if (singleInstitution.sms_balance === undefined || singleInstitution.sms_balance === null) {
                    singleInstitution.sms_balance = parentInst.sms_balance || 0;
                  }
                  if (singleInstitution.balance === undefined || singleInstitution.balance === null) {
                    singleInstitution.balance = parentInst.balance || 0;
                  }
                }
              } catch (e) {
                console.error("Error fetching parent institution shared SMS balance:", e);
              }
            }

            if (finalProfile.role === 'super_admin') {
              singleInstitution.theme = localStorage.getItem('super_admin_theme') || 'default';
            }
            setMadrasah(singleInstitution);
            OfflineService.setCache('profile', singleInstitution);
            await fetchActiveYear(singleInstitution.id);
          } else {
            setMadrasah(null);
          }
        } else if (finalProfile.role === 'super_admin' || finalProfile.role === 'manager') {
          const localTheme = localStorage.getItem('super_admin_theme') || 'default';
          setMadrasah({
            id: 'super_admin',
            name: finalProfile.role === 'super_admin' ? 'Super Admin' : 'Manager',
            institution_type: 'system',
            theme: localTheme,
            config_json: { modules: {} },
            is_active: true,
            status: 'active',
            balance: 0,
            sms_balance: 0,
            is_super_admin: finalProfile.role === 'super_admin',
            created_at: new Date().toISOString()
          } as Institution);
        }
      } else {
        // ... existing bootstrap logic ...
        if (isSuperAdminEmail) {
          console.log("Super admin profile missing, bootstrapping...");
          await supabase.rpc('bootstrap_super_admin', { 
            p_uid: userId, 
            p_email: userEmail 
          });
          // Clear request manager cache so it fetches the new profile
          requestManager.invalidate(`profile:${userId}`);
          return fetchUserProfile(userId, email, retryCount);
        }
        setAuthError("Profile not found in database. Please check if SQL triggers are running.");
      }
    } catch (err: any) {
      const errorMessage = (err?.message || '').toLowerCase();
      const isNetworkError = 
        errorMessage.includes('fetch') || 
        errorMessage.includes('network') ||
        errorMessage.includes('load') ||
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
    localStorage.removeItem('parent_session');
    OfflineService.removeCache('profile');
    hardReload();
  };

  useEffect(() => {
    const initializeAuth = async (retryCount = 0) => {
      try {
        console.log("Initializing Auth... Attempt:", retryCount + 1);
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error(`Auth session error (Attempt ${retryCount + 1}):`, error);
          const errorMessage = error.message.toLowerCase();

          // Retry for network issues
          const isNetworkError = errorMessage.includes('fetch') || errorMessage.includes('network');
          if (isNetworkError && retryCount < 3) {
             await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
             return initializeAuth(retryCount + 1);
          }

          // Only force logout on definitive token errors
          const isTokenError = errorMessage.includes('refresh token') || 
                               errorMessage.includes('refresh_token_not_found') ||
                               errorMessage.includes('invalid_grant');

          if (isTokenError) {
            console.warn("Definitive token error detected, signing out...");
            await handleLogout();
            return;
          }
        }

        const parentSessionStr = localStorage.getItem('parent_session');
        const teacherSessionStr = localStorage.getItem('teacher_session');

        if (currentSession && currentSession.user) {
          setSession(currentSession);
          
          if (teacherSessionStr) {
            try {
              const teacherData = JSON.parse(teacherSessionStr);
              if (teacherData && teacherData.id) {
                const { data: latestTeacher } = await supabase.from('teachers').select('*').eq('id', teacherData.id).maybeSingle();
                if (latestTeacher && latestTeacher.is_active) {
                  let parsedPermissions = latestTeacher.permissions || {};
                  if (typeof latestTeacher.permissions === 'string') {
                    try {
                      parsedPermissions = JSON.parse(latestTeacher.permissions);
                    } catch (e) {
                      parsedPermissions = {};
                    }
                  }
                  const profileObj = {
                    id: latestTeacher.id,
                    institution_id: latestTeacher.institution_id,
                    full_name: latestTeacher.name,
                    role: 'teacher' as const,
                    is_active: latestTeacher.is_active,
                    created_at: latestTeacher.created_at,
                    permissions: parsedPermissions
                  };
                  setProfile(profileObj);
                  OfflineService.setCache('user_profile', profileObj);
                  
                  const { data: inst } = await supabase.from('institutions').select('*').eq('id', latestTeacher.institution_id).maybeSingle();
                  if (inst) setMadrasah(inst);
                  setLoading(false);
                  return;
                }
              }
            } catch (e) {}
          }
          await fetchUserProfile(currentSession.user.id, currentSession.user.email);
        } else if (parentSessionStr) {
          try {
            const parentData = JSON.parse(parentSessionStr);
            if (parentData && parentData.student_id) {
              const profileObj = {
                id: parentData.student_id,
                institution_id: parentData.institution_id,
                full_name: 'Parent User',
                role: 'parent' as const,
                is_active: true,
                created_at: new Date().toISOString()
              };
              setProfile(profileObj);
              const { data: inst } = await supabase.from('institutions').select('*').eq('id', parentData.institution_id).maybeSingle();
              if (inst) setMadrasah(inst);
              setLoading(false);
              return;
            }
          } catch (e) {}
        } else {
          localStorage.removeItem('teacher_session');
          localStorage.removeItem('parent_session');
        }
      } catch (err: any) {
        console.error("Auth initialization error:", err);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("Auth Event Triggered:", event);
      if (event === 'SIGNED_OUT') {
        const hasSession = !!session;
        if (!hasSession) {
          console.log("Legitimate signed out event.");
          setSession(null); 
          setMadrasah(null); 
          setProfile(null);
          localStorage.removeItem('teacher_session');
        }
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
    let pollInterval: any;

    if (profile?.institution_id && profile.institution_id !== 'super_admin') {
      try {
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
              const updatedInst = payload.new as Institution;
              setMadrasah(updatedInst);
              
              // Update RequestManager cache to prevent stale data on refresh
              if (profile?.institution_id) {
                const instId = profile.institution_id;
                // Notify the main institution cache key
                requestManager.setManualCache(`fetch:institutions:institution:${instId}`, updatedInst);
                // Notify the dashboard balance cache key used in Home.tsx
                requestManager.setManualCache(`fetch:institutions:dashboard_balance:${instId}`, updatedInst);
                
                // Update local persistence securely
                OfflineService.setCache('institution', updatedInst);
              }
            }
          )
          .subscribe((status, err) => {
             if (err) {
               console.warn("Realtime subscription error:", err);
             }
          });

        if (session?.user?.id) {
          supabase
            .channel('profile-changes')
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${session.user.id}`,
              },
              (payload) => {
                console.log('useAuth: Received real-time update for profile:', payload.new);
                const updatedProfile = payload.new as Profile;
                setProfile(updatedProfile);
                requestManager.setManualCache(`fetch:profiles:profile:${session.user.id}`, updatedProfile);
                OfflineService.setCache('user_profile', updatedProfile);
              }
            )
            .subscribe();
        }
      } catch (e) {
        console.warn("Could not start realtime subscription:", e);
      }

      // Fallback Polling (Every 6 Seconds) for Balance Updates
      // background-aware: only poll if tab is visible
      pollInterval = setInterval(async () => {
         if (document.visibilityState !== 'visible') return;
         
         try {
           const billingTargetId = (madrasah?.config_json as any)?.parent_institution_id || madrasah?.id || profile.institution_id!;
           const { data } = await supabase.from('institutions').select('balance, sms_balance').eq('id', billingTargetId).single();
           if (data) {
             setMadrasah(prev => {
                if (!prev) return prev;
                if (prev.balance !== data.balance || prev.sms_balance !== data.sms_balance) {
                    const updatedInst = { ...prev, balance: data.balance, sms_balance: data.sms_balance };
                    const instId = prev.id;
                    requestManager.setManualCache(`fetch:institutions:institution:${instId}`, updatedInst);
                    requestManager.setManualCache(`fetch:institutions:dashboard_balance:${instId}`, updatedInst);
                    OfflineService.setCache('profile', updatedInst);
                    return updatedInst;
                }
                return prev;
             });
           }
         } catch (e) {}
      }, 6000);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn("Error removing channel:", e);
        }
      }
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [profile?.institution_id]);

  const switchBranch = async (branchId: string) => {
    if (!branchId) return;
    if (branchId === profile?.institution_id) {
      sessionStorage.removeItem('active_branch_id');
      localStorage.removeItem('active_branch_id');
    } else {
      sessionStorage.setItem('active_branch_id', branchId);
      localStorage.setItem('active_branch_id', branchId);
    }
    requestManager.invalidatePattern('students');
    requestManager.invalidatePattern('classes');
    requestManager.invalidatePattern('v6_students');
    requestManager.invalidate(`institution:${branchId}`);
    requestManager.invalidate(`active_year:${branchId}`);
    if (profile?.id) {
      requestManager.invalidate(`profile:${profile.id}`);
    }
    try {
      await requestManager.invalidate();
    } catch (e) {
      console.warn('Error clearing cache on branch switch:', e);
    }
    OfflineService.removeCache('profile');
    OfflineService.removeCache('user_profile');
    window.location.reload();
  };

  const activeBranchId = typeof window !== 'undefined' ? (sessionStorage.getItem('active_branch_id') || localStorage.getItem('active_branch_id')) : null;

  return { 
    session, 
    profile, 
    madrasah, 
    activeYear, 
    selectedYear: viewingYear || activeYear, 
    setSelectedYear, 
    isHistoricalMode, 
    resetToActiveYear, 
    loading, 
    authError, 
    handleLogout, 
    refreshMadrasah,
    activeBranchId,
    switchBranch
  };
};
