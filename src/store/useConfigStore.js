import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useConfigStore = create((set) => ({
    profile: null,
    standbyReasons: [],
    schedules: [],
    loading: false,

    setProfile: (profile) => set({ profile }),

    fetchReasons: async () => {
        const { data } = await supabase.from('standby_reasons').select('*').order('name');
        set({ standbyReasons: data || [] });
    },

    fetchSchedules: async () => {
        const { data } = await supabase.from('vessel_standby_schedule').select(`
            id, vessel_id, standby_reason_id, standby_date, notes, created_at,
            standby_reasons ( name, code ), vessels ( name )
        `);
        set({ schedules: data || [] });
    },

    addStandbyReason: async (reason) => {
        const { data, error } = await supabase.from('standby_reasons').insert([reason]).select();
        if (!error) set(state => ({ standbyReasons: [...state.standbyReasons, data[0]] }));
        return { success: !error };
    },
    updateStandbyReason: async (id, updates) => {
        const { error } = await supabase.from('standby_reasons').update(updates).eq('id', id);
        if (!error) set(state => ({ standbyReasons: state.standbyReasons.map(r => r.id === id ? { ...r, ...updates } : r) }));
        return { success: !error };
    },
    deleteStandbyReason: async (id) => {
        const { error } = await supabase.from('standby_reasons').delete().eq('id', id);
        if (!error) set(state => ({ standbyReasons: state.standbyReasons.filter(r => r.id !== id) }));
        return { success: !error };
    }
}));
