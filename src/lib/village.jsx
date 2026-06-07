import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { VILLAGES } from './mockData';

const VillageContext = createContext(null);

export function VillageProvider({ children }) {
  const [village, setVillage] = useState(VILLAGES[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVillage() {
      // In a real app, this would load based on user profile or subdomain/config
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('village_id, villages(*)')
          .eq('id', user.id)
          .single();

        if (profile?.villages) {
          setVillage(profile.villages);
        }
      }
      setLoading(false);
    }
    loadVillage();
  }, []);

  return (
    <VillageContext.Provider value={{ village, setVillage, loading }}>
      {children}
    </VillageContext.Provider>
  );
}

export function useVillage() {
  const context = useContext(VillageContext);
  if (!context) throw new Error('useVillage must be used within a VillageProvider');
  return context;
}
