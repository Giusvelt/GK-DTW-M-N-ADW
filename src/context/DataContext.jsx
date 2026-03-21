import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useVessels } from '../hooks/useVessels';
import { useGeofences } from '../hooks/useGeofences';
import { useDatalastic } from '../hooks/useDatalastic';
import { useActivityLog } from '../hooks/useActivityLog';
import { useProductionPlans } from '../hooks/useProductionPlans';
import { useUserProfile } from '../hooks/useUserProfile';
import { useStandbys } from '../hooks/useStandbys';
import { supabase } from '../lib/supabase';

const DataContext = createContext();
export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
    const { profile } = useUserProfile();
    const { vessels, loading: vesselsLoading, fetchVessels, addVessel, updateVessel, deleteVessel } = useVessels();
    const { geofences, loading: geofencesLoading, fetchGeofences, addGeofence, updateGeofence, deleteGeofence } = useGeofences();
    const { positions: livePositions, isEnabled: isLiveEnabled } = useDatalastic(vessels);

    // ── Filtro attività per ruolo ───────────────────────────────────────────
    // crew         → solo la propria nave (vessel_id via MMSI)
    // crew_admin   → useActivityLog senza filtro vessel, poi filtriamo per company in componente
    // operation*   → tutte le attività (nessun filtro)
    const crewVesselId = useMemo(() => {
        if (!profile || !vessels?.length) return null;
        if (profile.role !== 'crew') return null;

        // Unica verità: MMSI scritto fisicamente nel profilo dal tab User
        if (profile.mmsi) {
            const byMmsi = vessels.find(v => String(v.mmsi) === String(profile.mmsi));
            if (byMmsi) return byMmsi.id;
        }
        return null; // Niente MMSI = Niente nave (niente più magic fallback)
    }, [profile, vessels]);

    // ID delle navi della compagnia del crew_admin
    const companyVesselIds = useMemo(() => {
        if (!profile || !vessels?.length) return null;
        if (profile.role !== 'crew_admin') return null;
        if (!profile.companyId) return null;
        return vessels.filter(v => v.company_id === profile.companyId).map(v => v.id);
    }, [profile, vessels]);

    // Passa il filtro vessel solo per crew (crew_admin scarica tutto e filtra nel componente)
    const { activities, loading: activitiesLoading, lastUpdate, fetchActivities } = useActivityLog(crewVesselId);
    const { plans: productionPlans, upsertPlan, deletePlan, fetchPlans } = useProductionPlans();

    const {
        standbyReasons, schedules, fetchStandbyReasons, fetchSchedules,
        upsertSchedule, deleteSchedule,
        addStandbyReason, updateStandbyReason, deleteStandbyReason
    } = useStandbys();

    // Vessel positions
    const [vesselPositions, setVesselPositions] = useState([]);

    useEffect(() => {
        if (!vessels?.length) return;

        const loadPositions = async () => {
            // Determina le navi visibili per la mappa in base al ruolo
            let visibleVessels = vessels;

            if (profile?.role === 'crew' && crewVesselId) {
                // crew → solo la propria nave (e flotta per nome, come prima come fallback)
                const crewVessel = vessels.find(v => v.id === crewVesselId);
                const crewCompanyId = crewVessel?.company_id || profile.companyId;

                visibleVessels = crewCompanyId
                    ? vessels.filter(v => v.company_id === crewCompanyId)
                    : [crewVessel].filter(Boolean);
            } else if (profile?.role === 'crew_admin' && profile.companyId) {
                // crew_admin → tutte le navi della propria compagnia
                visibleVessels = vessels.filter(v => v.company_id === profile.companyId);
            }
            // operation e operation_admin → visibleVessels = tutti (invariato)

            const visibleIds = visibleVessels.map(v => v.id);

            let query = supabase
                .from('vessel_tracking')
                .select('vessel_id, mmsi, lat, lon, speed, heading, status, timestamp')
                .order('timestamp', { ascending: false })
                .limit(200);

            if (visibleIds.length > 0 && visibleIds.length < vessels.length) {
                query = query.in('vessel_id', visibleIds);
            }

            const { data, error } = await query;
            if (error || !data) return;

            const positions = visibleVessels.map(v => {
                const track = data.find(t =>
                    t.vessel_id === v.id ||
                    String(t.mmsi) === String(v.mmsi)
                );
                return {
                    vessel: v.name,
                    vesselId: v.id,
                    lat: track?.lat || 0,
                    lon: track?.lon || 0,
                    speed: track?.speed || 0,
                    heading: track?.heading || 0,
                    status: track?.status || 'unknown',
                    lastUpdate: track?.timestamp || null
                };
            });
            setVesselPositions(positions);
        };

        loadPositions();
        const interval = setInterval(loadPositions, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [vessels, crewVesselId, profile?.role, profile?.companyId]);

    // Overlay Datalastic live positions
    useEffect(() => {
        if (!Object.keys(livePositions).length || !vessels?.length) return;
        setVesselPositions(prev => prev.map(pos => {
            const v = vessels.find(v => v.name === pos.vessel);
            if (!v?.mmsi) return pos;
            const live = livePositions[v.mmsi];
            if (!live) return pos;
            return {
                ...pos,
                lat: live.lat || pos.lat,
                lon: live.lon || pos.lon,
                speed: live.speed ?? pos.speed,
                heading: live.course ?? pos.heading,
                status: live.status || pos.status,
                lastUpdate: new Date()
            };
        }));
    }, [livePositions, vessels]);

    const value = useMemo(() => ({
        vessels, vesselPositions, geofences, activities, productionPlans,
        standbyReasons, schedules,
        profile, crewVesselId, companyVesselIds, lastUpdate,
        loading: vesselsLoading || geofencesLoading || activitiesLoading,
        fetchVessels, addVessel, updateVessel, deleteVessel,
        fetchGeofences, addGeofence, updateGeofence, deleteGeofence,
        fetchActivities,
        upsertPlan, deletePlan, fetchPlans,
        fetchStandbyReasons, fetchSchedules, upsertSchedule, deleteSchedule,
        addStandbyReason, updateStandbyReason, deleteStandbyReason
    }), [
        vessels, vesselPositions, geofences, activities, productionPlans,
        standbyReasons, schedules,
        profile, crewVesselId, companyVesselIds, lastUpdate,
        vesselsLoading, geofencesLoading, activitiesLoading
    ]);

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
