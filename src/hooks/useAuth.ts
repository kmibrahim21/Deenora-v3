
import { useState, useEffect } from 'react';
import { supabase } from 'lib/supabase';
import { OfflineService } from 'services/OfflineService';
import { Profile, Institution } from 'types';
import { isValidUUID } from '../utils/validation';

export const useAuth = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [madrasah, setMadrasah] = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchUserProfile = async (userId: string, email?: string) => {
    if (!isValidUUID(userId)) {
      setLoading(false);
      return;
    }
    
    const userEmail = email?.trim().toLowerCase();
    const isSuperAdminEmail = userEmail === 'kmibrahim@gmail.com' || userEmail === 'thedevomix@gmail.com';

    try {
      // First, get the profile
      console.log("Fetching profile for user:", userId);
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) {
        console.error("Profile fetch error:", profileError);
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
      console.error("fetchUserProfile error:", err);
      
      // Resilience: If it's a network error and we are super admin, we can still load
      if (isSuperAdminEmail && (err.message?.includes('fetch') || err.name === 'TypeError')) {
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
      if (cachedMadrasah) {
        console.log("Network error, using cached madrasah data...");
        setMadrasah(cachedMadrasah);
      }

      setAuthError(err.message);
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
    window.location.reload();
  };

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth session error:", error);
          const errorMessage = error.message.toLowerCase();
          if (errorMessage.includes('refresh token') || errorMessage.includes('refresh_token_not_found')) {
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              console.error("Error during sign out:", signOutErr);
            }
            localStorage.removeItem('madrasah_auth_token');
            localStorage.removeItem('teacher_session');
            OfflineService.removeCache('profile');
            setSession(null);
            setProfile(null);
            setMadrasah(null);
            window.location.reload();
          }
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
                const { data: latestTeacher, error: tError } = await supabase
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
                  
                  // Fetch madrasah data
                  if (isValidUUID(teacherData.institution_id)) {
                    const { data: institutionData } = await supabase
                      .from('institutions')
                      .select('*')
                      .eq('id', teacherData.institution_id)
                      .maybeSingle();
                      
                    if (institutionData) {
                      setMadrasah(institutionData);
                    }
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
          const teacherSessionStr = localStorage.getItem('teacher_session');
          if (teacherSessionStr) {
            try {
              const teacherData = JSON.parse(teacherSessionStr);
              if (teacherData && teacherData.id) {
                // Fetch latest teacher data to get updated permissions and check active status
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

                  setSession({ user: { id: latestTeacher.id, role: 'teacher' } });
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
                  // Fallback to stored data if fetch fails (e.g. offline)
                  setSession({ user: { id: teacherData.id, role: 'teacher' } });
                  setProfile({
                    id: teacherData.id,
                    institution_id: teacherData.institution_id,
                    full_name: teacherData.name,
                    role: 'teacher',
                    is_active: teacherData.is_active,
                    created_at: teacherData.created_at,
                    permissions: teacherData.permissions
                  });
                  
                  // Fetch madrasah data
                  if (isValidUUID(teacherData.institution_id)) {
                    const { data: institutionData } = await supabase
                      .from('institutions')
                      .select('*')
                      .eq('id', teacherData.institution_id)
                      .maybeSingle();
                      
                    if (institutionData) {
                      setMadrasah(institutionData);
                    }
                  }
                }
              } else {
                localStorage.removeItem('teacher_session');
              }
            } catch (e) {
              console.error("Error parsing teacher session:", e);
              localStorage.removeItem('teacher_session');
            }
          }
        }
      } catch (err: any) {
        console.error("Auth initialization error:", err);
        const errorMessage = (err?.message || '').toLowerCase();
        if (errorMessage.includes('refresh token') || errorMessage.includes('refresh_token_not_found')) {
          localStorage.removeItem('madrasah_auth_token');
          OfflineService.removeCache('profile');
          setSession(null);
          setProfile(null);
          setMadrasah(null);
          window.location.reload();
        }
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSession(null); 
        setMadrasah(null); 
        setProfile(null);
        localStorage.removeItem('teacher_session');
      } else if (session) {
        setSession(session);
        if (session.user) {
          const teacherSessionStr = localStorage.getItem('teacher_session');
          if (teacherSessionStr) {
            try {
              const teacherData = JSON.parse(teacherSessionStr);
              if (teacherData && teacherData.id) {
                // Already handled by initializeAuth, or we can just return
                return;
              }
            } catch (e) {}
          }
          fetchUserProfile(session.user.id, session.user.email);
        }
      }
    });

    let channel: any;
    if (profile?.institution_id) {
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
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [profile?.institution_id]);

  return { session, profile, madrasah, loading, authError, handleLogout, refreshMadrasah };
};
