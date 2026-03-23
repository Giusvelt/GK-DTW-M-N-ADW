import React, { useState } from 'react';
import {
    X, Ship, Clock, ShieldCheck, Lock, Anchor, Navigation,
    Package, Fuel, Users, AlertCircle, ChevronDown, ChevronUp, MessageSquare
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import ActivityChatModal from './ActivityChatModal';

// Activities that need nautical services (not open-sea navigation)
const NEEDS_SERVICES = ['Loading', 'Unloading', 'Port Operations', 'Mooring', 'Anchorage', 'Transit'];
// Activities where 'Transit' type = anchorage, no mooring crew expected
const NO_MOORING = ['Transit', 'Anchorage', 'Navigation'];
// Activities requiring effective cargo entry
const NEEDS_CARGO = ['Loading', 'Unloading'];
// Activities requiring bunker entry
const NEEDS_BUNKER = ['Port Operations'];

const fmt = (ts) => {
    if (!ts) return '';
    try {
        const d = new Date(ts);
        if (isNaN(d.getTime())) return '';
        const offset = d.getTimezoneOffset();
        return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
    } catch { return ''; }
};

const fmtDisplay = (ts) => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return '—'; }
};



export default function LogbookEntryModal({ activity, profile, entryMeta, onClose, onSaved }) {
    const { activities } = useData();

    const isSubmitted = entryMeta?.status === 'submitted' || entryMeta?.status === 'approved';
    const sf = entryMeta?.structured_fields || {};

    const [navFrom, setNavFrom] = useState('—');
    const [navTo, setNavTo] = useState('—');

    React.useEffect(() => {
        if (activity?.activity === 'Navigation' && activities?.length) {
            const vesselActs = activities
                .filter(a => a.vesselId === activity.vesselId)
                .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

            const idx = vesselActs.findIndex(a => a.id === activity.id);
            if (idx >= 0) {
                const prev = idx > 0 ? vesselActs[idx - 1].geofence : 'Unknown';
                const next = idx < vesselActs.length - 1 ? vesselActs[idx + 1].geofence : 'Unknown';
                setNavFrom(prev && prev !== '—' ? prev : 'Open Sea');
                setNavTo(next && next !== '—' ? next : 'Open Sea');
            }
        }
    }, [activity, activities]);

    const [form, setForm] = useState({
        ata: fmt(activity?.startTime),
        atd: fmt(activity?.endTime),
        actual_cargo: sf.actual_cargo_tonnes != null ? String(sf.actual_cargo_tonnes) : '',
        actual_bunker: sf.actual_bunker_tonnes != null ? String(sf.actual_bunker_tonnes) : '',
        // Arrival maneuver
        arr_pilot_call: fmt(sf.arrival_pilot_call),
        arr_pilot_in: fmt(sf.arrival_pilot_in),
        arr_mooring_in: fmt(sf.arrival_mooring_in),
        arr_tug_in: fmt(sf.arrival_tug_in),
        arr_tug_count: sf.arrival_tug_count != null ? String(sf.arrival_tug_count) : '2',
        // Departure maneuver
        dep_pilot_out: fmt(sf.departure_pilot_out),
        dep_mooring_out: fmt(sf.departure_mooring_out),
        dep_tug_out: fmt(sf.departure_tug_out),
        dep_tug_count: sf.departure_tug_count != null ? String(sf.departure_tug_count) : '2',
        // Narrative
        narrative: entryMeta?.narrative_text || '',
        // Support for legacy names used in template
        arrival_tug_count: sf.arrival_tug_count || 0,
        departure_tug_count: sf.departure_tug_count || 0,
        actual_cargo_tonnes: sf.actual_cargo_tonnes || 0,
        actual_bunker_tonnes: sf.actual_bunker_tonnes || 0
    });

    const structured = form;
    const narrative = form.narrative;

    const [saving, setSaving] = useState(false);
    const [showArrival, setShowArrival] = useState(true);
    const [showDeparture, setShowDeparture] = useState(true);
    const [showChat, setShowChat] = useState(false);

    const set = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

    const needsServices = NEEDS_SERVICES.includes(activity?.activity);
    const noMooring = NO_MOORING.includes(activity?.activity);
    const needsCargo = NEEDS_CARGO.includes(activity?.activity);
    const needsBunker = NEEDS_BUNKER.includes(activity?.activity);

    const handleSave = async (submit = false) => {
        if (submit && !confirm('WARNING: You are about to CERTIFY and LOCK this logbook entry. This operation is irreversible and constitutes an assumption of Command responsibility. Proceed?')) return;
        setSaving(true);
        try {
            // 1. Update vessel_activity times
            const vaUpdates = {};
            if (form.ata) vaUpdates.start_time = new Date(form.ata).toISOString();
            if (form.atd) vaUpdates.end_time = new Date(form.atd).toISOString();
            if (Object.keys(vaUpdates).length > 0) {
                await supabase.from('vessel_activity').update(vaUpdates).eq('id', activity.id);
            }

            // 2. Build structured_fields
            const structuredFields = {
                actual_cargo_tonnes: form.actual_cargo ? Number(form.actual_cargo) : null,
                actual_bunker_tonnes: form.actual_bunker ? Number(form.actual_bunker) : null,
                arrival_pilot_call: form.arr_pilot_call ? new Date(form.arr_pilot_call).toISOString() : null,
                arrival_pilot_in: form.arr_pilot_in ? new Date(form.arr_pilot_in).toISOString() : null,
                arrival_mooring_in: form.arr_mooring_in ? new Date(form.arr_mooring_in).toISOString() : null,
                arrival_tug_count: Number(form.arr_tug_count) || 0,
                arrival_tug_in: form.arr_tug_in ? new Date(form.arr_tug_in).toISOString() : null,
                departure_pilot_out: form.dep_pilot_out ? new Date(form.dep_pilot_out).toISOString() : null,
                departure_mooring_out: form.dep_mooring_out ? new Date(form.dep_mooring_out).toISOString() : null,
                departure_tug_count: Number(form.dep_tug_count) || 0,
                departure_tug_out: form.dep_tug_out ? new Date(form.dep_tug_out).toISOString() : null,
            };

            // 3. Logbook entry upsert
            const existingId = entryMeta?.entryId;
            const entryPayload = {
                vessel_activity_id: activity.id,
                vessel_id: activity.vesselId,
                crew_id: profile?.id,
                narrative_text: form.narrative,
                structured_fields: structuredFields,
                status: submit ? 'submitted' : (entryMeta?.status || 'draft'),
            };

            if (existingId) {
                await supabase.from('logbook_entries').update(entryPayload).eq('id', existingId);
            } else {
                await supabase.from('logbook_entries').insert(entryPayload);
            }

            onSaved?.();
            onClose();
        } catch (err) {
            alert('Error during save: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const activityColor = {
        'Loading': '#f59e0b',
        'Unloading': '#10b981',
        'Navigation': '#3b82f6',
        'Port Operations': '#8b5cf6',
        'Transit': '#6b7280',
        'Mooring': '#ec4899',
        'Anchorage': '#0891b2',
    };
    const badgeColor = activityColor[activity?.activity] || '#475569';

    
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/30 backdrop-blur-md p-4 md:p-8 overflow-y-auto">
            <div className="relative w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl border border-surface-low/30 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-gradient-to-br from-surface-lowest to-white px-8 py-6 flex justify-between items-center border-b border-surface-low/30">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                            <Ship size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-on-surface tracking-tight">Logbook Entry</h2>
                            <p className="text-[10px] font-black uppercase tracking-widest text-on-surface/40 mt-1">{activity.vessel} — {activity.activity}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-surface-low/20 text-on-surface/50 hover:text-on-surface hover:bg-surface-low/50 rounded-full transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Body - due colonne: Riepilogo SX, Form DX */}
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    
                    {/* Left Col: Read-Only Info */}
                    <div className="w-full md:w-1/3 bg-surface-lowest p-8 border-r border-surface-low/30 overflow-y-auto">
                        <h3 className="text-xs font-black uppercase tracking-widest text-on-surface/40 mb-6 flex items-center gap-2">
                            <Anchor size={14} /> Operation Details
                        </h3>
                        
                        <div className="space-y-6">
                            <div className="bg-white p-4 rounded-2xl border border-surface-low/30 shadow-sm">
                                <span className="block text-[9px] font-black uppercase tracking-widest text-primary mb-1">Geofence Location</span>
                                <span className="text-sm font-extrabold text-on-surface">{activity.geofence}</span>
                            </div>

                            <div className="bg-white p-4 rounded-2xl border border-surface-low/30 shadow-sm">
                                <span className="block text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">Time IN (ATA)</span>
                                <span className="text-sm font-extrabold text-on-surface">{fmtDisplay(activity.startTime)}</span>
                            </div>

                            <div className="bg-white p-4 rounded-2xl border border-surface-low/30 shadow-sm">
                                <span className="block text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">Time OUT (ATD)</span>
                                <span className="text-sm font-extrabold text-on-surface">{fmtDisplay(activity.endTime)}</span>
                            </div>

                            {isSubmitted && entryMeta?.document_hash && (
                                <div className="bg-green-50 p-4 rounded-2xl border border-green-200 shadow-sm">
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-green-600 flex items-center gap-1 mb-1">
                                        <Lock size={10} /> Certified Hash
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-green-800 break-all">{entryMeta.document_hash}</span>
                                </div>
                            )}

                            {isSubmitted && !entryMeta?.document_hash && (
                                <div className="bg-surface-low/20 p-4 rounded-2xl border border-surface-low/30">
                                    <span className="block text-[9px] font-black uppercase tracking-widest text-on-surface/50 mb-1">Status</span>
                                    <span className="text-sm font-bold text-on-surface/70">Submitted (Awaiting Hash)</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Col: Forms */}
                    <div className="w-full md:w-2/3 p-8 overflow-y-auto bg-white">
                        {isSubmitted ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-10">
                                <ShieldCheck size={64} className="text-green-500 mb-4" />
                                <h3 className="text-xl font-extrabold text-on-surface mb-2">Entry Locked & Certified</h3>
                                <p className="text-sm font-bold text-on-surface/50 max-w-sm">This logbook entry has been cryptographically signed and submitted. It can no longer be edited.</p>
                                
                                <div className="mt-8 text-left w-full max-w-md space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-on-surface/30 mb-2 border-b border-surface-low/30 pb-2">Submitted Data Review</h4>
                                    
                                    <div className="flex justify-between items-center py-2 border-b border-surface-low/10">
                                        <span className="text-xs font-bold text-on-surface/60">Actual Cargo:</span>
                                        <span className="text-sm font-black text-on-surface">{structured.actual_cargo_tonnes || 0} t</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-surface-low/10">
                                        <span className="text-xs font-bold text-on-surface/60">Actual Bunker:</span>
                                        <span className="text-sm font-black text-on-surface">{structured.actual_bunker_tonnes || 0} t</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-surface-low/10">
                                        <span className="text-xs font-bold text-on-surface/60">Tugs (In / Out):</span>
                                        <span className="text-sm font-black text-on-surface">{structured.arrival_tug_count || 0} / {structured.departure_tug_count || 0}</span>
                                    </div>
                                    
                                    <div className="mt-4 p-4 bg-surface-lowest rounded-2xl border border-surface-low/30">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-on-surface/40 block mb-2">Narrative / Notes</span>
                                        <p className="text-xs font-bold text-on-surface/70 italic">{narrative || "No notes provided."}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                {/* Form sezioni come prima ma ri-stilizzate */}
                                
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 border-b border-surface-low/30 pb-2">
                                        <Package size={14} /> Cargo & Bunker Parameters
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="flex flex-col">
                                            <label className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest mb-2 px-1">Actual Cargo (Tonnes)</label>
                                            <input type="number" min="0" step="0.1"
                                                className="w-full bg-surface-low/10 border-none rounded-2xl px-5 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all"
                                                value={form.actual_cargo_tonnes || ''}
                                                onChange={e => setForm({ ...form, actual_cargo_tonnes: e.target.value })}
                                                disabled={!NEEDS_CARGO.includes(activity.activity)}
                                            />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[9px] font-black text-on-surface/40 uppercase tracking-widest mb-2 px-1">Actual Bunker (Tonnes)</label>
                                            <input type="number" min="0" step="0.1"
                                                className="w-full bg-surface-low/10 border-none rounded-2xl px-5 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all"
                                                value={form.actual_bunker_tonnes || ''}
                                                onChange={e => setForm({ ...form, actual_bunker_tonnes: e.target.value })}
                                                disabled={!NEEDS_BUNKER.includes(activity.activity)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {NEEDS_SERVICES.includes(activity.activity) && (
                                    <div className="space-y-4">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-secondary flex items-center gap-2 border-b border-surface-low/30 pb-2">
                                            <Anchor size={14} /> Nautical Services (Tugs & Pilots)
                                        </h3>
                                        
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-surface-lowest p-4 rounded-2xl border border-surface-low/30">
                                                <span className="block text-[9px] font-black text-on-surface/50 uppercase tracking-widest mb-3">Arrival Services</span>
                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface">
                                                        <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                            checked={form.arrival_pilot || false} onChange={e => setForm({...form, arrival_pilot: e.target.checked})} />
                                                        Pilot required
                                                    </label>
                                                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface">
                                                        <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                            checked={form.arrival_mooring || false} onChange={e => setForm({...form, arrival_mooring: e.target.checked})}
                                                            disabled={NO_MOORING.includes(activity.activity)} />
                                                        Mooring crew required
                                                    </label>
                                                    <div className="mt-3 flex items-center justify-between border-t border-surface-low/20 pt-3">
                                                        <span className="text-[10px] font-black uppercase text-on-surface/40">Tugs count</span>
                                                        <input type="number" min="0" max="6" className="w-16 bg-white border border-surface-low/30 rounded-lg px-2 py-1 text-center text-xs font-extrabold outline-none focus:border-primary"
                                                            value={form.arrival_tug_count || 0} onChange={e => setForm({...form, arrival_tug_count: parseInt(e.target.value) || 0})} />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-surface-lowest p-4 rounded-2xl border border-surface-low/30">
                                                <span className="block text-[9px] font-black text-on-surface/50 uppercase tracking-widest mb-3">Departure Services</span>
                                                <div className="space-y-2">
                                                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface">
                                                        <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                            checked={form.departure_pilot || false} onChange={e => setForm({...form, departure_pilot: e.target.checked})} />
                                                        Pilot required
                                                    </label>
                                                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface">
                                                        <input type="checkbox" className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                                                            checked={form.departure_mooring || false} onChange={e => setForm({...form, departure_mooring: e.target.checked})}
                                                            disabled={NO_MOORING.includes(activity.activity)} />
                                                        Mooring crew required
                                                    </label>
                                                    <div className="mt-3 flex items-center justify-between border-t border-surface-low/20 pt-3">
                                                        <span className="text-[10px] font-black uppercase text-on-surface/40">Tugs count</span>
                                                        <input type="number" min="0" max="6" className="w-16 bg-white border border-surface-low/30 rounded-lg px-2 py-1 text-center text-xs font-extrabold outline-none focus:border-primary"
                                                            value={form.departure_tug_count || 0} onChange={e => setForm({...form, departure_tug_count: parseInt(e.target.value) || 0})} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-on-surface/60 flex items-center gap-2 border-b border-surface-low/30 pb-2">
                                        <MessageSquare size={14} /> Narrative Log
                                    </h3>
                                    <textarea
                                        className="w-full bg-surface-low/10 border-none rounded-2xl p-5 text-sm font-bold text-on-surface placeholder:text-on-surface/20 outline-none focus:ring-2 ring-primary/20 transition-all resize-y min-h-[120px]"
                                        placeholder="Add any specific operational notes, weather conditions, or delays..."
                                        value={form.narrative}
                                        onChange={e => setForm({...form, narrative: e.target.value})}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                {!isSubmitted && (
                    <div className="bg-surface-lowest px-8 py-6 border-t border-surface-low/30 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-100">
                            <AlertCircle size={14} /> Cannot be edited after submission
                        </div>
                        <div className="flex gap-3">
                            <button onClick={onClose} disabled={isSaving} className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-on-surface/50 hover:bg-surface-low/20 transition-colors">
                                Cancel
                            </button>
                            <button onClick={() => handleSave(true)} disabled={isSaving} className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/30 hover:scale-105 transition-all disabled:opacity-50">
                                {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                {isSaving ? 'Submitting...' : 'Sign & Submit Logbook'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            
            {chatActivity && (
                <ActivityChatModal
                    activity={chatActivity}
                    onClose={() => setChatActivity(null)}
                />
            )}
        </div>
    );
}
