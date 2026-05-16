
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export interface GlobalUpdateConfig {
  global_update_active: boolean;
  global_update_message: string;
  global_update_version: number;
}

export const useGlobalUpdate = () => {
  const [config, setConfig] = useState<GlobalUpdateConfig | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    // Initial fetch
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('global_update_active, global_update_message, global_update_version')
          .eq('id', '00000000-0000-0000-0000-000000000001')
          .maybeSingle();

        if (error) {
          console.error('Error fetching global update config:', error);
          return;
        }

        if (data) {
          console.log('Fetched initial global update config:', data);
          checkAndShowPopup(data);
        }
      } catch (err) {
        console.error('Global update fetch exception:', err);
      }
    };

    fetchConfig();

    // Realtime subscription
    const subscription = supabase
      .channel('system_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'system_settings'
        },
        (payload) => {
          console.log('Realtime System Settings Change:', payload);
          const newDoc = payload.new as any;
          if (newDoc && newDoc.id === '00000000-0000-0000-0000-000000000001') {
            checkAndShowPopup(newDoc as GlobalUpdateConfig);
          }
        }
      )
      .subscribe((status) => {
        console.log('Supabase Realtime Subscription Status:', status);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkAndShowPopup = (data: GlobalUpdateConfig) => {
    setConfig(data);
    if (data.global_update_active) {
      const lastDismissedVersion = localStorage.getItem('last_update_version');
      if (lastDismissedVersion === null || parseInt(lastDismissedVersion) < data.global_update_version) {
        setShowPopup(true);
      }
    } else {
      setShowPopup(false);
    }
  };

  const dismissPopup = () => {
    setShowPopup(false);
    if (config) {
      localStorage.setItem('last_update_version', config.global_update_version.toString());
    }
  };

  return { config, showPopup, dismissPopup };
};
