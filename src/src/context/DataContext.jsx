import React, { createContext, useContext, useMemo, useEffect } from 'react';
import { useVesselStore } from '../store/useVesselStore';
import { useConfigStore } from '../store/useConfigStore';
import { useGeofenceStore } from '../store/useGeofenceStore';
import { useActivityStore } from '../store/useActivityStore';
import { supabase } from '../lib/supabase';


const DataContext = createContext();
export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
    const { profile, setProfile } = useConfigStore();
    const { vessels } = useVesselStore();
    const { 
        activities, lastUpdate, loading: activitiesLoading, fetchActivities,
        productionPlans, upsertPlan, deletePlan, fetchPlans
    } = useActivityStore();
    const { geofences, fetchGeofences, loading: geofencesLoading } = useGeofenceStore();
    const { standbyReasons, schedules, fetchSchedules, fetchReasons } = useConfigStore();
    const { fetchVessels } = useVesselStore();

    useEffect(() => {
        // Initial Fetch
        fetchVessels();
        fetchActivities();
        fetchGeofences();
        fetchPlans();
        fetchSchedules();
        fetchReasons();
        
        // Auth subscription check (residual if needed)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                // Potential profile refresh logic here if needed
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // Permissions (residual local logic for bridge)
    const perms = useMemo(() => profile?.permissions || {}, [profile]);

    const crewVesselId = useMemo(() => {
        if (!profile || !vessels?.length) return null;
        if (profile.role !== 'crew') return null;
        if (profile.mmsi) {
            const byMmsi = vessels.find(v => String(v.mmsi) === String(profile.mmsi));
            if (byMmsi) return byMmsi.id;
        }
        return null;
    }, [profile, vessels]);

    const companyVesselIds = useMemo(() => {
        if (!profile || !vessels?.length) return null;
        if (profile.role !== 'crew_admin') return null;
        if (!profile.companyId) return null;
        return vessels.filter(v => v.company_id === profile.companyId).map(v => v.id);
    }, [profile, vessels]);

    const value = useMemo(() => ({
        vessels, geofences, activities, productionPlans,
        standbyReasons, schedules,
        profile, crewVesselId, companyVesselIds, lastUpdate,
        loading: activitiesLoading || geofencesLoading,
        fetchActivities,
        upsertPlan, deletePlan, fetchPlans,
        fetchSchedules
    }), [
        vessels, geofences, activities, productionPlans,
        standbyReasons, schedules,
        profile, crewVesselId, companyVesselIds, lastUpdate,
        activitiesLoading, geofencesLoading
    ]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
