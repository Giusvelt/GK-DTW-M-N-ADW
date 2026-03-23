import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useVesselStore } from '../store/useVesselStore';
import { useActivityStore } from '../store/useActivityStore';
import {
    Ship, Clock, Check, RefreshCw, BookOpen,
    Edit3, ShieldCheck, Lock, AlertCircle, Download, PenLine, MessageSquare
} from 'lucide-react';
import '../logbook-writer.css';
import LogbookEntryModal from './LogbookEntryModal';
import ActivityChatModal from './ActivityChatModal';
import { can } from '../lib/permissions';

const PILOT_ID = 'fb7e1193-eb4c-4dbf-a74c-330cc7a10a1e';
const MOORING_ID = '0accb070-55ec-4f33-9e70-43701950872d';
const TUG_ID = 'd9a81b19-98a7-46be-bd10-07777b36eb1f';

const formatInputTime = (ts) => {
    if (!ts) return '';
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return '';
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().slice(0, 16);
    } catch (e) {
        return '';
    }
};

export default function LogbookWriterTab() {
    const { activities, loading, fetchActivities } = useActivityStore();
    const { vesselPositions } = useVesselStore();
    const { crewVesselId, companyVesselIds, profile } = useData();

    const perms = profile?.permissions || can(profile?.role);

    const [vesselFilter, setVesselFilter] = useState('All');
    const [search, setSearch] = useState('');
    const [filterOnlyWithMessages, setFilterOnlyWithMessages] = useState(false);
    const [chatActivity, setChatActivity] = useState(null);

    const handleExportLogbook = () => {
        if (!filtered.length) return;

        // 1. Calculate Protocol: [Progressive] / [Last AIS Update]
        const lastAISUpdate = (vesselPositions || []).reduce((latest, pos) => {
            if (!pos.lastUpdate) return latest;
            const d = new Date(pos.lastUpdate);
            return d > latest ? d : latest;
        }, new Date(0));

        const formattedAISDate = lastAISUpdate.getTime() > 0
            ? lastAISUpdate.toLocaleString('en-GB')
            : '—';

        const exportCount = Number(localStorage.getItem('gk_logbook_export_count') || 0) + 1;
        localStorage.setItem('gk_logbook_export_count', exportCount);

        const protocol = `${String(exportCount).padStart(3, '0')} / ${formattedAISDate}`;

        // 2. Prepare Data (AOA style for XLSX)
        const rows = filtered.map(a => {
            const meta = servicesMap[a.id];
            const p = meta?.services?.find(s => s.service_id === PILOT_ID);
            const m = meta?.services?.find(s => s.service_id === MOORING_ID);
            const t = meta?.services?.find(s => s.service_id === TUG_ID);

            return [
                meta?.status || 'draft',
                a.vessel,
                a.activity,
                a.geofence,
                a.startTime ? new Date(a.startTime).toLocaleString('en-GB') : '',
                a.endTime ? new Date(a.endTime).toLocaleString('en-GB') : '',
                p?.start_time ? new Date(p.start_time).toLocaleString('en-GB') : '',
                p?.end_time ? new Date(p.end_time).toLocaleString('en-GB') : '',
                m?.start_time ? new Date(m.start_time).toLocaleString('en-GB') : '',
                m?.end_time ? new Date(m.end_time).toLocaleString('en-GB') : '',
                t?.start_time ? new Date(t.start_time).toLocaleString('en-GB') : '',
                t?.end_time ? new Date(t.end_time).toLocaleString('en-GB') : '',
            ];
        });

        const aoaData = [
            ['PROTOCOL:', protocol],
            [], // spacer
            ['Status', 'Ship', 'Activity', 'Geofence', 'ATA', 'ATD', 'Pilot In', 'Pilot Out', 'Mooring In', 'Mooring Out', 'Tug In', 'Tug Out'],
            ...rows
        ];

        // 3. Create Workbook
        const ws = XLSX.utils.aoa_to_sheet(aoaData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Logbook Registry");

        // Styling: Auto-width columns
        const wscols = [
            { wch: 12 }, { wch: 18 }, { wch: 15 }, { wch: 22 }, { wch: 18 }, { wch: 18 },
            { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }
        ];
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, `GeoKanban_Logbook_Registry_${exportCount}.xlsx`);
    };


    // Fetch services and entry status for all visible activities
    useEffect(() => {
        if (!activities?.length) return;

        const fetchAllServices = async () => {
            const ids = activities.map(a => a.id);
            const { data, error } = await supabase
                .from('logbook_entries')
                .select('id, vessel_activity_id, status, narrative_text, structured_fields, document_hash, message_snapshot, logbook_services(*)')
                .in('vessel_activity_id', ids);

            if (error) {
                console.error('Failed to fetch logbook services:', error);
                return;
            }

            const map = {};
            data.forEach(entry => {
                map[entry.vessel_activity_id] = {
                    entryId: entry.id,
                    status: entry.status,
                    services: entry.logbook_services,
                    structured_fields: entry.structured_fields || {},
                    narrative_text: entry.narrative_text || '',
                    document_hash: entry.document_hash || null,
                    message_snapshot: entry.message_snapshot || [],
                };
            });
            setServicesMap(map);
        };

        fetchAllServices();
    }, [activities]);

    const filtered = useMemo(() => {
        if (loading) return [];
        let base = activities || [];

        let result = [];
        // 1. Filter by Role/Permissions
        if (perms.approveLogbook) {
            result = base.filter(a => a.logbookStatus === 'submitted' || a.logbookStatus === 'approved');
        } else {
            if (perms.seeCompanyVessels && companyVesselIds && !perms.seeAllVessels) {
                result = base.filter(a => companyVesselIds.includes(a.vesselId));
            } else if (perms.seeOwnVesselOnly && crewVesselId) {
                result = base.filter(a => a.vesselId === crewVesselId);
            } else {
                result = base;
            }
        }

        // 2. Filter by Search / Vessel / Messages
        const q = search.toLowerCase().trim();
        if (vesselFilter !== 'All') result = result.filter(a => a.vessel === vesselFilter);
        if (filterOnlyWithMessages) result = result.filter(a => a.hasMessages || a.unreadCount > 0);
        if (q) result = result.filter(a => 
            a.vessel?.toLowerCase().includes(q) || 
            a.activity?.toLowerCase().includes(q) || 
            (a.geofence || '').toLowerCase().includes(q)
        );

        // 2. Sort: Submitted/Approved at the TOP, then by time DESC
        return [...result].sort((a, b) => {
            const metaA = servicesMap[a.id];
            const metaB = servicesMap[b.id];
            const isSubA = metaA?.status === 'submitted' || metaA?.status === 'approved';
            const isSubB = metaB?.status === 'submitted' || metaB?.status === 'approved';

            if (isSubA && !isSubB) return -1;
            if (!isSubA && isSubB) return 1;

            // Secondary sort: Date descending (newest first)
            const dateA = new Date(a.startTime || 0);
            const dateB = new Date(b.startTime || 0);
            return dateB - dateA;
        });
    }, [activities, perms, crewVesselId, companyVesselIds, servicesMap, loading]);

    const handleRowClick = async (activity) => {
        const existingEntry = servicesMap[activity.id];

        // If Operations and row is unread, mark it as read
        if (perms.approveLogbook && existingEntry?.entryId && !existingEntry?.structured_fields?.admin_reviewed) {
            const updatedFields = { ...existingEntry.structured_fields, admin_reviewed: true };
            supabase
                .from('logbook_entries')
                .update({ structured_fields: updatedFields })
                .eq('id', existingEntry.entryId)
                .then(); // Fire and forget

            // Update local state so it turns color immediately
            setServicesMap(prev => ({
                ...prev,
                [activity.id]: {
                    ...prev[activity.id],
                    structured_fields: updatedFields
                }
            }));
        }

        setEditActivity(activity);
    };

    return (
        <div className="tab-content logbook-writer">
            <div className="filter-bar">
                <div className="filter-group">
                    <Edit3 size={15} />
                    <span className="filter-label">
                        {perms.approveLogbook || perms.isCrewAdmin ? 'Activity Submission Registry (Fleet Monitor)' : 'Formal Activity Submission — Command Responsibility'}
                    </span>
                </div>
                <div className="filter-group" style={{ marginLeft: 'auto', gap: '8px' }}>
                    
                    <div className="search-box-kinetic">
                        <input 
                            type="text" 
                            placeholder="Search fleet logs..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <select 
                        className="select-kinetic"
                        value={vesselFilter} 
                        onChange={e => setVesselFilter(e.target.value)}
                    >
                        <option value="All">All Vessels</option>
                        {Array.from(new Set(activities?.map(a => a.vessel))).sort().map(v => (
                            <option key={v} value={v}>{v}</option>
                        ))}
                    </select>

                    <label className="msg-toggle-kinetic">
                        <input 
                            type="checkbox" 
                            checked={filterOnlyWithMessages} 
                            onChange={e => setFilterOnlyWithMessages(e.target.checked)}
                        />
                        <span>Only with messages</span>
                    </label>

                    {(perms.approveLogbook || perms.isCrewAdmin) && (
                        <button
                            className="btn-certify"
                            onClick={handleExportLogbook}
                            title="Export Registry with Protocol"
                        >
                            <Download size={14} /> Export
                        </button>
                    )}
                    <button onClick={fetchActivities} className="btn-icon">
                        <RefreshCw size={15} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.length === 0 ? (
                    <div className="col-span-full py-20 flex flex-col items-center justify-center bg-white/50 backdrop-blur-md rounded-[2rem] border border-white">
                        <PenLine size={48} className="text-on-surface/20 mb-4" />
                        <h3 className="font-extrabold text-lg text-on-surface text-center">No activities to report</h3>
                        <p className="text-xs font-bold text-on-surface/50 mt-1 text-center">There are currently no activities logged that require your attention.</p>
                    </div>
                ) : (
                    filtered.map((a) => {
                        const entryMeta = servicesMap[a.id];
                        const isSubmitted = a.logbookStatus === 'submitted' || a.logbookStatus === 'approved';
                        const isAdminUnread = perms.approveLogbook && isSubmitted && !entryMeta?.structured_fields?.admin_reviewed;

                        return (
                            <div key={a.id} className={`group bg-white/80 backdrop-blur-xl border ${isAdminUnread ? 'border-amber-400 shadow-amber-500/10' : 'border-white'} shadow-sm rounded-[2rem] p-6 flex flex-col hover:shadow-lg transition-all duration-300 relative overflow-hidden`}>
                                {/* Top Badges */}
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                                            <Ship className="text-primary" size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-extrabold text-on-surface text-base tracking-tight">{a.vessel}</h4>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-md">{a.activity}</span>
                                                <span className="text-[10px] font-extrabold text-on-surface/50">@ {a.geofence}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {/* Persistent Chat Icon */}
                                        {(a.hasMessages || a.unreadCount > 0) ? (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setChatActivity(a); }} 
                                                className={`relative p-2 rounded-xl transition-all ${a.unreadCount > 0 ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-110' : 'bg-surface-low/20 text-on-surface/30 hover:bg-surface-low/40'}`}
                                                title={a.unreadCount > 0 ? `${a.unreadCount} unread messages` : 'View conversation'}
                                            >
                                                <MessageSquare size={16} />
                                                {a.unreadCount > 0 && (
                                                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white animate-pulse">
                                                        {a.unreadCount}
                                                    </span>
                                                )}
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setChatActivity(a); }} 
                                                className="p-2 bg-surface-lowest text-on-surface/5 rounded-xl hover:bg-surface-low/20 hover:text-on-surface/30 transition-all border border-dashed border-on-surface/5"
                                                title="Start conversation"
                                            >
                                                <MessageSquare size={16} />
                                            </button>
                                        )}
                                        {isSubmitted ? (
                                            <div onClick={() => handleRowClick(a)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 rounded-xl cursor-pointer hover:bg-green-100 transition-colors">
                                                <Lock size={12} className="shrink-0" />
                                                <span className="text-[9px] font-black uppercase tracking-widest leading-none mt-0.5">Certified</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-low/30 border border-surface-low/50 text-on-surface/50 rounded-xl">
                                                <PenLine size={12} className="shrink-0" />
                                                <span className="text-[9px] font-black uppercase tracking-widest leading-none mt-0.5">Draft</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Core Data Grid */}
                                <div className="grid grid-cols-2 gap-y-4 gap-x-2 mb-6 flex-1">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest mb-0.5">Time IN</span>
                                        <span className="text-xs font-extrabold text-on-surface">{a.startTime ? formatInputTime(a.startTime).replace('T', ' ') : '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest mb-0.5">Time OUT</span>
                                        <span className="text-xs font-extrabold text-on-surface">{a.endTime ? formatInputTime(a.endTime).replace('T', ' ') : '—'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest mb-0.5">Cargo / Bunker</span>
                                        <span className="text-xs font-extrabold text-on-surface">
                                            {entryMeta?.structured_fields?.actual_cargo_tonnes || '0'} t / {entryMeta?.structured_fields?.actual_bunker_tonnes || '0'} t
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest mb-0.5">Tugs (In/Out)</span>
                                        <span className="text-xs font-extrabold text-on-surface">
                                            {entryMeta?.structured_fields?.arrival_tug_count || 0} / {entryMeta?.structured_fields?.departure_tug_count || 0}
                                        </span>
                                    </div>
                                </div>

                                {/* Bottom Action */}
                                <div className="mt-auto pt-4 border-t border-surface-low/30 flex items-center justify-between">
                                    {entryMeta?.narrative_text ? (
                                        <div className="text-[10px] font-bold text-on-surface/60 italic truncate max-w-[150px]" title={entryMeta.narrative_text}>
                                            "{entryMeta.narrative_text}"
                                        </div>
                                    ) : (
                                        <div className="text-[10px] font-bold text-on-surface/30 italic">No notes provided.</div>
                                    )}

                                    {!isSubmitted && perms.submitLogbook ? (
                                        <button onClick={() => handleRowClick(a)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/30 hover:translate-y-[-2px] transition-all group-hover:scale-105">
                                            <Edit3 size={14} /> Fill Report
                                        </button>
                                    ) : (
                                        <button onClick={() => handleRowClick(a)} className="flex items-center gap-2 px-5 py-2.5 bg-surface-lowest border border-surface-low/50 text-on-surface rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all">
                                            View Report
                                        </button>
                                    )}
                                </div>

                                {(perms.approveLogbook || perms.isCrewAdmin) && entryMeta?.document_hash && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-emerald-500" title={`SHA-256: ${entryMeta.document_hash}`} />
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modals */}
            {editActivity && (
                <LogbookEntryModal
                    activity={editActivity}
                    profile={profile}
                    entryMeta={servicesMap[editActivity.id]}
                    onClose={() => setEditActivity(null)}
                    onSaved={() => {
                        fetchActivities();
                        setEditActivity(null);
                    }}
                />
            )}

            {chatActivity && (
                <ActivityChatModal
                    activity={chatActivity}
                    onClose={() => setChatActivity(null)}
                />
            )}
        </div>
    );
}


