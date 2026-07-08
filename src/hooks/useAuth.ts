
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
        console.error("Profile fetch error detailed:", JSON.stringify(profileError, null, 2));
        throw new Error(profileError.message || "Failed to fetch user profile from database");
      }

      console.log("Profile data response:", profileData);

      if (profileData) {
        console.log("Profile loaded:", { id: profileData.id, role: profileData.role, institution_id: profileData.institution_id });
        
        // Auto-heal 'admin' to 'org_admin'
        if (profileData.role === 'admin') {
          profileData.role = 'org_admin';
          supabase.from('profiles').update({ role: 'org_admin' }).eq('id', userId).then();
        }

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
            console.error("Institution fetch error detailed:", JSON.stringify(mError, null, 2));
            throw new Error(mError.message || "Failed to fetch institution data");
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
            config_json: { 
              modules: {
                departments: true,
                attendance: true,
                meetings: true,
                minutes: true,
                events: true,
                accounting: true,
                sms: true,
                voice_broadcast: true
              } 
            },
            is_active: true,
            status: 'active',
            balance: 0,
            sms_balance: 0,
            is_super_admin: true,
            created_at: new Date().toISOString()
          } as Institution);
        }
      } else {
        // ProfilData is null. Try to fetch from institutions direct (in case profile wasn't created)
        const { data: directInstitution } = await supabase.from('institutions').select('*').eq('id', userId).maybeSingle();
        
        if (directInstitution) {
           console.log("Institution exists but profile was missing. Mocking profile.");
           const mockProfile = {
             id: userId,
             institution_id: directInstitution.id,
             full_name: directInstitution.name,
             role: directInstitution.is_super_admin ? 'super_admin' : 'org_admin',
             is_active: true,
             created_at: directInstitution.created_at || new Date().toISOString()
           } as Profile;
           
           if (isSuperAdminEmail) {
             mockProfile.role = 'super_admin';
           }
           
           setProfile(mockProfile);
           setMadrasah(directInstitution);
           OfflineService.setCache('profile', directInstitution);
           
           // Attempt background heal
           supabase.from('profiles').upsert({
             id: userId,
             institution_id: directInstitution.id,
             full_name: directInstitution.name,
             role: mockProfile.role,
             is_active: true
           }).then(({error}) => {
             if (error) console.warn("Background profile heal failed:", error);
           });
           return;
        }

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
              config_json: { 
                modules: {
                  departments: true,
                  attendance: true,
                  meetings: true,
                  minutes: true,
                  events: true,
                  accounting: true,
                  sms: true,
                  voice_broadcast: true
                }
              },
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
          config_json: { 
            modules: {
              departments: true,
              attendance: true,
              meetings: true,
              minutes: true,
              events: true,
              accounting: true,
              sms: true,
              voice_broadcast: true
            }
          },
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

      if (err.message === 'Failed to fetch' || err.message?.includes('Failed to fetch')) {
        setAuthError('Network error connecting to Supabase. This could be because VITE_SUPABASE_URL is incorrect, or your Supabase project does not have CORS enabled for the current URL. Please check your AI Studio environment variables and Supabase CORS settings.');
      } else {
        setAuthError(err.message);
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
    localStorage.removeItem('executive_session');
    localStorage.removeItem('member_session');
    OfflineService.removeCache('profile');
    window.location.reload();
  };

  const signInAsMember = async (phone: string, memberId: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      const { data: memberData, error: mError } = await supabase
        .from('members')
        .select('*, institutions(*)')
        .eq('phone', phone)
        .eq('member_id_number', memberId)
        .maybeSingle();

      if (mError) throw mError;
      if (!memberData) {
        throw new Error('Member not found with these credentials');
      }

      const institutionData = memberData.institutions;

      // Check if member portal is enabled
      if (institutionData && institutionData.member_portal_config && !institutionData.member_portal_config.enabled) {
        throw new Error('Member portal is not enabled for this institution');
      }

      const memberProfile: Profile = {
        id: memberData.id,
        institution_id: memberData.institution_id,
        full_name: memberData.name,
        role: 'member',
        is_active: true,
        created_at: memberData.created_at || new Date().toISOString()
      };

      setSession({ user: { id: memberData.id, role: 'member' } });
      setProfile(memberProfile);
      setMadrasah(institutionData);
      
      localStorage.setItem('member_session', JSON.stringify({
        member: memberData,
        institution: institutionData
      }));

      return true;
    } catch (err: any) {
      setAuthError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
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
            localStorage.removeItem('executive_session');
            OfflineService.removeCache('profile');
            setSession(null);
            setProfile(null);
            setMadrasah(null);
            window.location.reload();
          }
        }

        if (currentSession && currentSession.user) {
          setSession(currentSession);
          
          // Check if it's an executive session
          const executiveSessionStr = localStorage.getItem('executive_session');
          const memberSessionStr = localStorage.getItem('member_session');

          if (memberSessionStr) {
            try {
              const memberDataObj = JSON.parse(memberSessionStr);
              if (memberDataObj && memberDataObj.member) {
                setProfile({
                  id: memberDataObj.member.id,
                  institution_id: memberDataObj.member.institution_id,
                  full_name: memberDataObj.member.name,
                  role: 'member',
                  is_active: true,
                  created_at: memberDataObj.member.created_at
                });
                setMadrasah(memberDataObj.institution);
                setLoading(false);
                return;
              }
            } catch (e) {
              console.error("Error parsing member session:", e);
            }
          }

          if (executiveSessionStr) {
            try {
              const executiveData = JSON.parse(executiveSessionStr);
              if (executiveData && executiveData.id) {
                // Fetch latest executive data to get updated permissions and check active status
                const { data: latestExecutive, error: eError } = await supabase
                  .from('executives')
                  .select('*')
                  .eq('id', executiveData.id)
                  .maybeSingle();

                if (latestExecutive) {
                  if (!latestExecutive.is_active) {
                    localStorage.removeItem('executive_session');
                    setProfile(null);
                    setMadrasah(null);
                    setLoading(false);
                    return;
                  }

                  setProfile({
                    id: latestExecutive.id,
                    institution_id: latestExecutive.institution_id,
                    full_name: latestExecutive.name,
                    role: 'executive',
                    is_active: latestExecutive.is_active,
                    created_at: latestExecutive.created_at,
                    permissions: latestExecutive.permissions
                  });
                  // Update local storage too
                  localStorage.setItem('executive_session', JSON.stringify(latestExecutive));
                  
                  // Fetch madrasah data
                  if (isValidUUID(latestExecutive.institution_id)) {
                    const { data: institutionData } = await supabase
                      .from('institutions')
                      .select('*')
                      .eq('id', latestExecutive.institution_id)
                      .maybeSingle();
                      
                    if (institutionData) {
                      setMadrasah(institutionData);
                    }
                  }
                } else {
                  // Fallback to stored data if fetch fails (e.g. offline)
                  setProfile({
                    id: executiveData.id,
                    institution_id: executiveData.institution_id,
                    full_name: executiveData.name,
                    role: 'executive',
                    is_active: executiveData.is_active,
                    created_at: executiveData.created_at,
                    permissions: executiveData.permissions
                  });
                  
                  // Fetch madrasah data
                  if (isValidUUID(executiveData.institution_id)) {
                    const { data: institutionData } = await supabase
                      .from('institutions')
                      .select('*')
                      .eq('id', executiveData.institution_id)
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
              console.error("Error parsing executive session:", e);
            }
          }
          
          await fetchUserProfile(currentSession.user.id, currentSession.user.email);
        } else {
          const executiveSessionStr = localStorage.getItem('executive_session');
          const memberSessionStr = localStorage.getItem('member_session');

          if (memberSessionStr) {
            try {
              const memberDataObj = JSON.parse(memberSessionStr);
              if (memberDataObj && memberDataObj.member) {
                setSession({ user: { id: memberDataObj.member.id, role: 'member' } });
                setProfile({
                  id: memberDataObj.member.id,
                  institution_id: memberDataObj.member.institution_id,
                  full_name: memberDataObj.member.name,
                  role: 'member',
                  is_active: true,
                  created_at: memberDataObj.member.created_at
                });
                setMadrasah(memberDataObj.institution);
                setLoading(false);
                return;
              }
            } catch (e) {
              console.error("Error parsing member session:", e);
            }
          }

          if (executiveSessionStr) {
            try {
              const executiveData = JSON.parse(executiveSessionStr);
              if (executiveData && executiveData.id) {
                // Fetch latest executive data to get updated permissions and check active status
                const { data: latestExecutive } = await supabase
                  .from('executives')
                  .select('*')
                  .eq('id', executiveData.id)
                  .maybeSingle();

                if (latestExecutive) {
                  if (!latestExecutive.is_active) {
                    localStorage.removeItem('executive_session');
                    setProfile(null);
                    setMadrasah(null);
                    setLoading(false);
                    return;
                  }

                  setSession({ user: { id: latestExecutive.id, role: 'executive' } });
                  setProfile({
                    id: latestExecutive.id,
                    institution_id: latestExecutive.institution_id,
                    full_name: latestExecutive.name,
                    role: 'executive',
                    is_active: latestExecutive.is_active,
                    created_at: latestExecutive.created_at,
                    permissions: latestExecutive.permissions
                  });
                  // Update local storage too
                  localStorage.setItem('executive_session', JSON.stringify(latestExecutive));
                  
                  // Fetch madrasah data
                  if (isValidUUID(latestExecutive.institution_id)) {
                    const { data: institutionData } = await supabase
                      .from('institutions')
                      .select('*')
                      .eq('id', latestExecutive.institution_id)
                      .maybeSingle();
                      
                    if (institutionData) {
                      setMadrasah(institutionData);
                    }
                  }
                } else {
                  // Fallback to stored data if fetch fails (e.g. offline)
                  setSession({ user: { id: executiveData.id, role: 'executive' } });
                  setProfile({
                    id: executiveData.id,
                    institution_id: executiveData.institution_id,
                    full_name: executiveData.name,
                    role: 'executive',
                    is_active: executiveData.is_active,
                    created_at: executiveData.created_at,
                    permissions: executiveData.permissions
                  });
                  
                  // Fetch madrasah data
                  if (isValidUUID(executiveData.institution_id)) {
                    const { data: institutionData } = await supabase
                      .from('institutions')
                      .select('*')
                      .eq('id', executiveData.institution_id)
                      .maybeSingle();
                      
                    if (institutionData) {
                      setMadrasah(institutionData);
                    }
                  }
                }
              } else {
                localStorage.removeItem('executive_session');
              }
            } catch (e) {
              console.error("Error parsing executive session:", e);
              localStorage.removeItem('executive_session');
            }
          }
        }
      } catch (err: any) {
        console.error("Auth initialization error:", err);
        const errorMessage = (err?.message || '').toLowerCase();
        if (errorMessage.includes('refresh token') || errorMessage.includes('refresh_token_not_found')) {
          localStorage.removeItem('madrasah_auth_token');
          localStorage.removeItem('executive_session');
          localStorage.removeItem('member_session');
          OfflineService.removeCache('profile');
          setSession(null);
          setProfile(null);
          setMadrasah(null);
          window.location.reload();
        } else {
          setAuthError(err.message || "An error occurred during authentication initialization");
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
        localStorage.removeItem('executive_session');
        localStorage.removeItem('member_session');
      } else if (session) {
        setSession(session);
        if (session.user) {
          const executiveSessionStr = localStorage.getItem('executive_session');
          if (executiveSessionStr) {
            try {
              const executiveData = JSON.parse(executiveSessionStr);
              if (executiveData && executiveData.id) {
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

  return { session, profile, madrasah, loading, authError, handleLogout, refreshMadrasah, signInAsMember };
};
