import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import {
    Ship, Target, TrendingUp, Package,
    Edit2, Check, X, RefreshCw, Trash2
} from 'lucide-react';
import SectionHeader from './SectionHeader';

export default function ProductionTargetTab() {
    const { vessels, productionPlans, upsertPlan, deletePlan, updateVessel, loading, activities } = useData();

    // Current period
    const now = new Date();
    const currentPeriod = now.toLocaleString('en-GB', { month: 'long', year: 'numeric' });

    // Calculate actual trips from vessel activities (Unloading) and drifting
    const actualTripsMap = {};
    const actualDriftMap = {};
    let totalDriftingCargo = 0;

    (activities || []).forEach(a => {
        if (a.activity !== 'Unloading') return;
        const d = new Date(a.startTime);
        if (isNaN(d)) return;

        const activityPeriod = d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
        if (activityPeriod === currentPeriod) {
            actualTripsMap[a.vesselId] = (actualTripsMap[a.vesselId] || 0) + 1;

            const driftedTons = Number(a.actualCargo) || 0;
            actualDriftMap[a.vesselId] = (actualDriftMap[a.vesselId] || 0) + driftedTons;
            totalDriftingCargo += driftedTons;
        }
    });

    // Local edit states
    const [summaryEdit, setSummaryEdit] = useState(null); // { val } or null
    const [vesselEdits, setVesselEdits] = useState({}); // { [id]: { cargo, trips } }

    // Delivered = Σ (actual_trips × avg_cargo) — calculated at runtime from latest activities
    const deliveredTotal = (vessels || []).reduce((s, v) => {
        const trips = actualTripsMap[v.id] || 0;
        return s + (trips * (v.avg_cargo || 0));
    }, 0);

    const globalPlan = (productionPlans || []).find(p => p.vessel_id === null && p.period_name === currentPeriod);

    const sumTargets = (productionPlans || [])
        .filter(p => p.period_name === currentPeriod && p.vessel_id !== null)
        .reduce((s, p) => s + (p.target_quantity || 0), 0);

    const totalTarget = summaryEdit !== null ? summaryEdit : (globalPlan?.target_quantity || sumTargets);
    const remainingTotal = Math.max(0, totalTarget - deliveredTotal);

    const handleSaveSummary = async () => {
        if (summaryEdit === null) return;
        try {
            await upsertPlan({
                vessel_id: null,
                period_name: currentPeriod,
                target_quantity: summaryEdit,
                target_trips: 0,
                actual_trips: 0,
                actual_quantity: 0
            });
            setSummaryEdit(null);
        } catch (err) {
            console.error('Failed to save global target:', err);
            alert('Save failed: ' + err.message);
        }
    };

    const handleSaveVessel = async (vesselId) => {
        const edit = vesselEdits[vesselId];
        if (!edit) return;

        try {
            // Update Vessel Avg Cargo
            if (edit.cargo !== undefined) {
                await updateVessel(vesselId, { avg_cargo: Number(edit.cargo) });
            }

            // Update/Upsert Plan
            const vessel = vessels.find(v => v.id === vesselId);
            const plan = (productionPlans || []).find(p => p.vessel_id === vesselId && p.period_name === currentPeriod);

            const trips = edit.trips !== undefined ? Number(edit.trips) : (plan?.target_trips || 0);
            const cargo = edit.cargo !== undefined ? Number(edit.cargo) : (vessel.avg_cargo || 0);
            const actualTrips = plan?.actual_trips || 0;

            await upsertPlan({
                vessel_id: vesselId,
                period_name: currentPeriod,
                target_trips: trips,
                target_quantity: trips * cargo,
                actual_trips: actualTrips,
                actual_quantity: actualTrips * cargo,  // RECALCULATED with new avg_cargo
            });

            // Clear local edit for this vessel
            setVesselEdits(prev => {
                const next = { ...prev };
                delete next[vesselId];
                return next;
            });
        } catch (err) {
            console.error('Failed to save vessel production data:', err);
            alert('Save failed: ' + err.message);
        }
    };

    return (
        <div className="pt-tab-container p-4 lg:p-6">
            <SectionHeader 
                title="Production Targets" 
                subtitle="Monthly delivery quotas and efficiency tracking" 
                icon={Target}
            />
            
            <div className="tab-content production-targets-tab mt-4">
                {/* Overall Production Summary - Compact */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    <div className="bg-white rounded-2xl p-4 border border-white shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                            <Target size={18} />
                        </div>
                        <div className="flex-1">
                            <p className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest mb-0.5">Monthly Goal</p>
                            <div className="flex items-center gap-2">
                                {summaryEdit !== null ? (
                                    <input type="number" autoFocus value={summaryEdit} onChange={e => setSummaryEdit(Number(e.target.value))} className="w-20 bg-surface-low/30 border-none rounded px-2 py-0.5 text-sm font-bold outline-none" />
                                ) : (
                                    <h3 className="text-xl font-manrope font-extrabold text-on-surface leading-none">{totalTarget.toLocaleString()} <span className="text-[10px] text-on-surface/20">t</span></h3>
                                )}
                                <button className="text-on-surface/30 hover:text-primary transition-colors" onClick={() => summaryEdit !== null ? handleSaveSummary() : setSummaryEdit(totalTarget)}>
                                    {summaryEdit !== null ? <Check size={14} /> : <Edit2 size={12} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-white shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-500">
                            <TrendingUp size={18} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest mb-0.5">Delivered</p>
                            <h3 className="text-xl font-manrope font-extrabold text-on-surface leading-none">{deliveredTotal.toLocaleString()} <span className="text-[10px] text-on-surface/20">t</span></h3>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-white shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                            <Package size={18} />
                        </div>
                        <div>
                            <p className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest mb-0.5">Remaining</p>
                            <h3 className="text-xl font-manrope font-extrabold text-on-surface leading-none">{remainingTotal.toLocaleString()} <span className="text-[10px] text-on-surface/20">t</span></h3>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl p-4 border border-white shadow-sm flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 font-black text-xs">
                            {totalTarget > 0 ? Math.round((deliveredTotal / totalTarget) * 100) : 0}%
                        </div>
                        <div className="flex-1">
                            <p className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest mb-1">Total Progress</p>
                            <div className="h-1.5 w-full bg-surface-low/30 rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${totalTarget > 0 ? Math.min(100, (deliveredTotal / totalTarget) * 100) : 0}%` }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Vessel Targets Table - Compact */}
                <div className="bg-white/50 backdrop-blur-md rounded-2xl p-4 border border-white shadow-sm overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-1">
                        <thead>
                            <tr className="text-[9px] font-black text-on-surface/20 uppercase tracking-[0.1em]">
                                <th className="px-4 py-3">Vessel</th>
                                <th className="px-4 py-3">Avg Cargo</th>
                                <th className="px-4 py-3">Target Trips</th>
                                <th className="px-4 py-3">Actual Progress</th>
                                <th className="px-4 py-3">Target Tons</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(vessels || []).map(vessel => {
                                const plan = (productionPlans || []).find(p => p.vessel_id === vessel.id && p.period_name === currentPeriod);
                                const isEditing = vesselEdits[vessel.id] !== undefined;
                                const editData = vesselEdits[vessel.id] || {};
                                const trips = isEditing ? editData.trips : (plan?.target_trips || 0);
                                const cargo = isEditing ? editData.cargo : (vessel.avg_cargo || 0);
                                const actualTrips = actualTripsMap[vessel.id] || 0;
                                const tripProgress = (isEditing ? editData.trips : (plan?.target_trips || 0)) > 0 
                                    ? Math.round((actualTrips / (isEditing ? editData.trips : (plan?.target_trips || 0))) * 100) : 0;

                                return (
                                    <tr key={vessel.id} className="group">
                                        <td className="px-4 py-3 bg-white rounded-l-xl font-manrope font-extrabold text-xs text-on-surface uppercase">{vessel.name}</td>
                                        <td className="px-4 py-3 bg-white">
                                            {isEditing ? (
                                                <input type="number" className="w-16 bg-surface-low/30 border-none rounded px-2 py-0.5 text-xs font-bold outline-none" value={editData.cargo} onChange={e => setVesselEdits(prev => ({ ...prev, [vessel.id]: { ...prev[vessel.id], cargo: e.target.value } }))} />
                                            ) : (
                                                <span className="text-xs font-bold text-on-surface/60">{vessel.avg_cargo || 0} t</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 bg-white">
                                            {isEditing ? (
                                                <input type="number" className="w-16 bg-surface-low/30 border-none rounded px-2 py-0.5 text-xs font-bold outline-none" value={editData.trips} onChange={e => setVesselEdits(prev => ({ ...prev, [vessel.id]: { ...prev[vessel.id], trips: e.target.value } }))} />
                                            ) : (
                                                <span className="text-xs font-bold text-on-surface/60">{plan?.target_trips || 0} trips</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 bg-white">
                                            <div className="flex flex-col gap-1 w-24">
                                                <div className="flex items-center justify-between text-[9px] font-bold">
                                                    <span className="text-on-surface">{actualTrips} / {trips}</span>
                                                    <span className="text-primary">{tripProgress}%</span>
                                                </div>
                                                <div className="h-1 w-full bg-surface-low/30 rounded-full overflow-hidden">
                                                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, tripProgress)}%` }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 bg-white text-xs font-black text-on-surface">
                                            {(trips * cargo).toLocaleString()} t
                                        </td>
                                        <td className="px-4 py-3 bg-white rounded-r-xl text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {isEditing ? (
                                                    <>
                                                        <button title="Save" className="w-7 h-7 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm" onClick={() => handleSaveVessel(vessel.id)}><Check size={14} /></button>
                                                        <button title="Cancel" className="w-7 h-7 rounded-full bg-surface-low/30 text-on-surface/40 flex items-center justify-center" onClick={() => setVesselEdits(prev => { const n = {...prev}; delete n[vessel.id]; return n; })}><X size={14} /></button>
                                                    </>
                                                ) : (
                                                   <button title="Edit" className="w-7 h-7 rounded-full bg-surface-low/30 text-on-surface/20 flex items-center justify-center hover:bg-primary hover:text-white transition-all" onClick={() => setVesselEdits({ ...vesselEdits, [vessel.id]: { cargo: vessel.avg_cargo || 0, trips: plan?.target_trips || 0 } })}><Edit2 size={12} /></button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* KPI Archive Section - Compact */}
                <div className="mt-8 bg-white/50 backdrop-blur-md rounded-2xl p-5 lg:p-6 border border-white shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-on-surface/5 flex items-center justify-center text-on-surface/40">
                                <RefreshCw size={18} />
                            </div>
                            <div>
                                <h3 className="font-manrope font-extrabold text-base text-on-surface uppercase tracking-tight leading-none">Performance Archive</h3>
                                <p className="text-[9px] font-black text-on-surface/20 uppercase tracking-widest mt-1">Consolidated monthly history</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {[...new Set((productionPlans || []).map(p => p.period_name))].sort().reverse().map(period => {
                            if (period === currentPeriod) return null;
                            const periodPlans = (productionPlans || []).filter(p => p.period_name === period);
                            const target = periodPlans.find(p => p.vessel_id === null)?.target_quantity || periodPlans.reduce((s, p) => s + (p.target_quantity || 0), 0);
                            const actual = periodPlans.reduce((s, p) => s + (p.actual_quantity || 0), 0);
                            const progress = target > 0 ? Math.round((actual / target) * 100) : 0;

                            return (
                                <div key={period} className="bg-white rounded-xl p-4 border border-white shadow-sm hover:translate-y-[-2px] transition-all cursor-pointer group">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">{period}</span>
                                        <div className="w-2 h-2 rounded-full bg-green-500 opacity-30" />
                                    </div>
                                    <div className="flex items-end justify-between mb-3">
                                        <div>
                                            <div className="text-lg font-manrope font-extrabold text-on-surface">{(actual/1000).toFixed(1)}k <span className="text-[10px] text-on-surface/20">t</span></div>
                                            <div className="text-[8px] font-bold text-on-surface/30 uppercase">of {(target/1000).toFixed(0)}k target</div>
                                        </div>
                                        <div className={`text-xs font-black ${progress >= 100 ? 'text-green-500' : 'text-blue-500'}`}>{progress}%</div>
                                    </div>
                                    <div className="h-1 w-full bg-surface-low/30 rounded-full overflow-hidden">
                                        <div className={`h-full ${progress >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${Math.min(100, progress)}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

const CheckCircle = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);
