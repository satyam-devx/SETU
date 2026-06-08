import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { VILLAGES } from './mockData';

const VillageContext = createContext(null);

export function VillageProvider({ children }) {
  const [village, setVillage] = useState(VILLAGES[0]);
  const [villageId, setVillageId] = useState(VILLAGES[0].id);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVillage() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // First fetch the profile to get village_id
          const { data: profile } = await supabase
            .from('profiles')
            .select('village_id')
            .eq('id', user.id)
            .single();

          if (profile?.village_id) {
            setVillageId(profile.village_id);

            // Then fetch the village details
            const { data: villageData } = await supabase
              .from('villages')
              .select('*')
              .eq('id', profile.village_id)
              .single();

            if (villageData) {
              setVillage(villageData);
            }
          }
        }
      } catch (err) {
        // Silently fall back to mock village - never crash
        console.warn('[SETU] VillageProvider: could not load village, using default', err?.message);
      } finally {
        setLoading(false);
      }
    }
    loadVillage();
  }, []);

  return (
    <VillageContext.Provider value={{ village, setVillage, villageId, loading }}>
      {children}
    </VillageContext.Provider>
  );
}

export function useVillage() {
  const context = useContext(VillageContext);
  if (!context) throw new Error('useVillage must be used within a VillageProvider');
  return context;
}
