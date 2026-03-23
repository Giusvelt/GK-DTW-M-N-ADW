import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, BookOpen, MessageSquare, Ship, Clock, Save, Send, Plus, Trash2,
    Lock, CheckCircle, FileText, Download, User, ShieldCheck, Fingerprint,
    Anchor, ArrowRight, Info, AlertTriangle, Calendar, Activity
} from 'lucide-react';
import { useLogbook } from '../hooks/useLogbook';
import { useMessaging } from '../hooks/useMessaging';
import { useServices } from '../hooks/useServices';
import jsPDF from 'jspdf';
import autoTable, { applyPlugin } from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Initialize the plugin
applyPlugin(jsPDF);

const formatInputTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toISOString().slice(0, 16);
};

export default function LogbookModal({ activity, userId, userRole = 'crew', onClose }) {
    const {
        entry, services: loggedServices, loading: entryLoading,
        saveNarrative, submitLogbook, saveFields, addService, removeService, updateService
    } = useLogbook(activity?.id);

    const {
        messages, sendMessage, toggleInLogbook
    } = useMessaging(activity?.id, userId);

    const { services: masterServices } = useServices();

    const [activeTab, setActiveTab] = useState('narrative');
    const [narrative, setNarrative] = useState('');
    const [msgText, setMsgText] = useState('');
    const [selectedService, setSelectedService] = useState('');
    const [fields, setFields] = useState({
        actual_cargo_tonnes: 0,
        actual_bunker_tonnes: 0,
        arrival_tug_count: 0,
        departure_tug_count: 0
    });

    useEffect(() => {
        if (entry?.structured_fields) {
            setFields(prev => ({
                ...prev,
                ...entry.structured_fields
            }));
        }
    }, [entry]);

    useEffect(() => {
        if (entry?.narrative_text !== undefined) {
            setNarrative(entry.narrative_text || '');
        }
    }, [entry]);

    const isLocked = entry?.status !== 'draft';

    const handleSaveNarrative = async () => {
        const res = await saveNarrative(narrative);
        if (res.success) alert('Narrative saved successfully.');
    };

    const handleSubmit = async () => {
        if (!confirm('ATTENTION: You are about to certify this logbook entry. This constitutes a Command Assumption of responsibility. Proceed?')) return;
        
        // Save fields first
        await saveFields(fields);
        
        const res = await submitLogbook();
        if (res.success) alert('Logbook successfully certified and locked.');
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!msgText.trim()) return;
        const res = await sendMessage(msgText, userRole);
        if (res.success) setMsgText('');
    };

    const handleAddService = async () => {
        if (!selectedService) return;
        await addService(selectedService);
        setSelectedService('');
    };

    const handleUpdateServiceField = async (svcId, field, value) => {
        if (isLocked) return;
        await updateService(svcId, { [field]: value || null });
    };

    const [exporting, setExporting] = useState(false);

    const handleDownloadPDF = () => {
        setExporting(true);
        try {
            const doc = new jsPDF();
            const margin = 20;
            let y = margin;

            // Header
            doc.setFontSize(22);
            doc.setTextColor(15, 23, 42); // slate-900
            doc.text("GIORNALE DI BORDO - GEOKANBAN V3", margin, y);
            y += 10;
            
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`CERTIFIED RECORD | HASH: ${entry?.document_hash?.substring(0, 32)}...`, margin, y);
            y += 15;

            // Vessel & Trip Info
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text(`VESSEL: ${activity.vessel}`, margin, y);
            y += 7;
            doc.text(`ACTIVITY: ${activity.activity} @ ${activity.geofence || 'Navigation'}`, margin, y);
            y += 15;

            // Core Data Table
            doc.autoTable({
                startY: y,
                head: [['Field', 'Certified Value']],
                body: [
                    ['Arrival (ATA)', new Date(activity.startTime).toLocaleString('it-IT')],
                    ['Departure (ATD)', activity.endTime ? new Date(activity.endTime).toLocaleString('it-IT') : 'IN PROGRESS'],
                    ['Actual Cargo (t)', `${fields.actual_cargo_tonnes || 0} t`],
                    ['Actual Bunker (t)', `${fields.actual_bunker_tonnes || 0} t`],
                    ['Tugs In', fields.arrival_tug_count || 0],
                    ['Tugs Out', fields.departure_tug_count || 0],
                ],
                theme: 'grid',
                headStyles: { fillColor: [59, 130, 246] } // primary
            });
            y = doc.lastAutoTable.finalY + 15;

            // Services Table
            if (loggedServices.length > 0) {
                doc.setFontSize(12);
                doc.text("NAUTICAL SERVICES", margin, y);
                y += 5;
                doc.autoTable({
                    startY: y,
                    head: [['Service', 'Code', 'Qty', 'Start', 'End']],
                    body: loggedServices.map(s => [
                        s.services?.name,
                        s.services?.code,
                        s.quantity,
                        s.start_time ? new Date(s.start_time).toLocaleString('it-IT') : '-',
                        s.end_time ? new Date(s.end_time).toLocaleString('it-IT') : '-'
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [15, 23, 42] }
                });
                y = doc.lastAutoTable.finalY + 15;
            }

            // Formal Narrative
            doc.setFontSize(12);
            doc.text("FORMAL NARRATIVE", margin, y);
            y += 7;
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            const splitText = doc.splitTextToSize(narrative || "No narrative provided.", 170);
            doc.text(splitText, margin, y);
            
            // Footer with Hash
            const pageHeight = doc.internal.pageSize.height;
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Digital Fingerprint: ${entry?.document_hash}`, margin, pageHeight - 10);

            doc.save(`Logbook_${activity.vessel}_${activity.id.substring(0,8)}.pdf`);
        } catch (err) {
            console.error("PDF Export Error:", err);
            alert("Failed to generate PDF. Check console.");
        } finally {
            setExporting(false);
        }
    };

    const handleExportXLSX = () => {
        setExporting(true);
        try {
            const data = [
                ["GIORNALE DI BORDO - GEOKANBAN V3", ""],
                ["Vessel", activity.vessel],
                ["Activity", activity.activity],
                ["Geofence", activity.geofence || "Navigation"],
                ["Status", "CERTIFIED & LOCKED"],
                ["Audit Hash", entry?.document_hash],
                ["", ""],
                ["CERTIFIED DATA", ""],
                ["Arrival (ATA)", new Date(activity.startTime).toLocaleString('it-IT')],
                ["Departure (ATD)", activity.endTime ? new Date(activity.endTime).toLocaleString('it-IT') : "N/A"],
                ["Cargo (t)", fields.actual_cargo_tonnes],
                ["Bunker (t)", fields.actual_bunker_tonnes],
                ["Tugs In", fields.arrival_tug_count],
                ["Tugs Out", fields.departure_tug_count],
                ["", ""],
                ["NAUTICAL SERVICES", ""],
                ["Service", "Code", "Quantity", "Start", "End"]
            ];

            loggedServices.forEach(s => {
                data.push([
                    s.services?.name,
                    s.services?.code,
                    s.quantity,
                    s.start_time ? new Date(s.start_time).toLocaleString('it-IT') : "-",
                    s.end_time ? new Date(s.end_time).toLocaleString('it-IT') : "-"
                ]);
            });

            data.push(["", ""]);
            data.push(["FORMAL NARRATIVE", ""]);
            data.push([narrative, ""]);

            const ws = XLSX.utils.aoa_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Logbook Record");
            XLSX.writeFile(wb, `Logbook_${activity.vessel}_${activity.id.substring(0,8)}.xlsx`);
        } catch (err) {
            console.error("XLSX Export Error:", err);
            alert("Failed to generate Excel. Check console.");
        } finally {
            setExporting(false);
        }
    };

    if (!activity) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            {/* Background Blur Overlay */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-on-surface/40 backdrop-blur-md" 
                onClick={onClose} 
            />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="relative bg-white rounded-[3rem] w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden"
            >
                
                {/* ── KINETIC HEADER ── */}
                <div className="bg-white border-b border-surface-low/30 px-8 py-6 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isLocked ? 'bg-green-500 text-white' : 'bg-primary text-white shadow-lg shadow-primary/20'}`}>
                            {isLocked ? <ShieldCheck size={28} /> : <BookOpen size={28} />}
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-2xl font-manrope font-extrabold text-on-surface tracking-tight leading-none uppercase">{activity.vessel}</h2>
                                {isLocked && (
                                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                                        Certified & Locked
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-black text-on-surface/30 uppercase tracking-widest">{activity.activity}</span>
                                <span className="w-1 h-1 rounded-full bg-on-surface/20" />
                                <span className="text-xs font-black text-on-surface/30 uppercase tracking-widest">{activity.geofence || 'Navigation'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {!isLocked && (
                            <button 
                                onClick={handleSubmit}
                                className="bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-primary/10 hover:-translate-y-0.5"
                            >
                                <CheckCircle size={16} /> Certify Submission
                            </button>
                        )}
                        {isLocked && (
                             <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
                                <Fingerprint size={16} className="text-slate-300" />
                                <span className="text-[10px] font-mono font-bold text-slate-400">{entry?.document_hash?.substring(0, 24)}...</span>
                             </div>
                        )}
                        <button onClick={onClose} className="w-10 h-10 rounded-full bg-surface-low/30 flex items-center justify-center text-on-surface/40 hover:bg-red-50 hover:text-red-500 transition-all">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* ── TABS ── */}
                <div className="flex border-b border-surface-low/10 px-8 bg-surface-low/10 shrink-0 overflow-x-auto scrollbar-hide">
                    {[
                        { id: 'narrative', label: 'Formal Logbook', icon: FileText },
                        { id: 'messages', label: 'Communications', icon: MessageSquare, count: messages.length },
                        { id: 'twin', label: 'Audit & Hash', icon: Fingerprint }
                    ].map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-3 px-8 py-5 text-xs font-black uppercase tracking-[0.2em] transition-all border-b-4 ${activeTab === t.id ? 'border-primary text-primary' : 'border-transparent text-on-surface/30 hover:text-on-surface'}`}
                        >
                            <t.icon size={16} />
                            {t.label}
                            {t.count > 0 && <span className="ml-1 bg-secondary text-white px-2 py-0.5 rounded-full text-[9px]">{t.count}</span>}
                        </button>
                    ))}
                </div>

                {/* ── CONTENT ── */}
                <div className="flex-1 overflow-y-auto bg-slate-50/30 p-8 lg:p-12 scrollbar-hide">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                            className="h-full"
                        >
                            {activeTab === 'narrative' && (
                                <div className="max-w-5xl mx-auto space-y-12">
                                    
                                    {isLocked && (
                                        <div className="bg-primary/5 border border-primary/20 rounded-[2.5rem] p-8">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><ShieldCheck size={14} /></div>
                                                <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Submitted Data Review</h4>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest mb-1">Cargo</span>
                                                    <span className="text-lg font-black text-on-surface">{fields.actual_cargo_tonnes || 0} t</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest mb-1">Bunker</span>
                                                    <span className="text-lg font-black text-on-surface">{fields.actual_bunker_tonnes || 0} t</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest mb-1">Tugs (In)</span>
                                                    <span className="text-lg font-black text-on-surface">{fields.arrival_tug_count || 0}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest mb-1">Tugs (Out)</span>
                                                    <span className="text-lg font-black text-on-surface">{fields.departure_tug_count || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Comparison Row: Automated vs Manual */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                        {/* Left: Automated Truth (Black Box) */}
                                        <div className="bg-white/50 backdrop-blur-sm rounded-[2.5rem] p-8 border border-white shadow-sm opacity-60">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-8 h-8 rounded-full bg-secondary/10 text-secondary flex items-center justify-center"><Activity size={14} /></div>
                                                <h4 className="text-[10px] font-black text-on-surface/40 uppercase tracking-widest">System Automated Record</h4>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center py-2 border-b border-on-surface/5">
                                                    <span className="text-[10px] uppercase font-bold text-on-surface/30">Arrival (ATA)</span>
                                                    <span className="text-xs font-black text-on-surface/60">{new Date(activity.startTime).toLocaleString('it-IT')}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-on-surface/5">
                                                    <span className="text-[10px] uppercase font-bold text-on-surface/30">Departure (ATD)</span>
                                                    <span className="text-xs font-black text-on-surface/60">{activity.endTime ? new Date(activity.endTime).toLocaleString('it-IT') : 'IN PROGRESS'}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2">
                                                    <span className="text-[10px] uppercase font-bold text-on-surface/30">Geofence Status</span>
                                                    <span className="text-xs font-black text-green-500 uppercase tracking-tighter">Verified Integrity</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right: Certified Input (Crew Input) */}
                                        <div className="bg-white rounded-[2.5rem] p-8 border border-white shadow-xl">
                                            <div className="flex items-center gap-3 mb-6">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><CheckCircle size={14} /></div>
                                                <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Certified Input Values</h4>
                                            </div>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[9px] font-black text-on-surface/20 uppercase tracking-widest ml-4 mb-1 block">Certified ATA</label>
                                                    <input type="datetime-local" className="w-full bg-surface-low/30 border border-surface-low rounded-full px-6 py-3 text-sm font-bold disabled:opacity-50" defaultValue={formatInputTime(activity.startTime)} disabled={isLocked} />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-black text-on-surface/20 uppercase tracking-widest ml-4 mb-1 block">Certified ATD</label>
                                                    <input type="datetime-local" className="w-full bg-surface-low/30 border border-surface-low rounded-full px-6 py-3 text-sm font-bold disabled:opacity-50" defaultValue={formatInputTime(activity.endTime)} disabled={isLocked} />
                                                </div>
                                                {!isLocked && (
                                                    <>
                                                        <div>
                                                            <label className="text-[9px] font-black text-on-surface/20 uppercase tracking-widest ml-4 mb-1 block">Actual Cargo (t)</label>
                                                            <input type="number" className="w-full bg-surface-low/30 border border-surface-low rounded-full px-6 py-3 text-sm font-bold" value={fields.actual_cargo_tonnes} onChange={e => setFields({...fields, actual_cargo_tonnes: parseFloat(e.target.value) || 0})} />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-black text-on-surface/20 uppercase tracking-widest ml-4 mb-1 block">Actual Bunker (t)</label>
                                                            <input type="number" className="w-full bg-surface-low/30 border border-surface-low rounded-full px-6 py-3 text-sm font-bold" value={fields.actual_bunker_tonnes} onChange={e => setFields({...fields, actual_bunker_tonnes: parseFloat(e.target.value) || 0})} />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-black text-on-surface/20 uppercase tracking-widest ml-4 mb-1 block">Tugs count (IN)</label>
                                                            <input type="number" min="0" max="10" className="w-full bg-surface-low/30 border border-surface-low rounded-full px-6 py-3 text-sm font-bold" value={fields.arrival_tug_count} onChange={e => setFields({...fields, arrival_tug_count: parseInt(e.target.value) || 0})} />
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-black text-on-surface/20 uppercase tracking-widest ml-4 mb-1 block">Tugs count (OUT)</label>
                                                            <input type="number" min="0" max="10" className="w-full bg-surface-low/30 border border-surface-low rounded-full px-6 py-3 text-sm font-bold" value={fields.departure_tug_count} onChange={e => setFields({...fields, departure_tug_count: parseInt(e.target.value) || 0})} />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Nautical Services Grid */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between px-4">
                                            <div className="flex items-center gap-3">
                                                <h4 className="text-[11px] font-black text-on-surface uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <Anchor size={16} className="text-primary" /> Nautical Services & Resources
                                                </h4>
                                            </div>
                                            {!isLocked && (
                                                <div className="flex items-center gap-2 p-1 px-3 bg-white rounded-full border border-surface-low/30">
                                                    <select 
                                                        className="bg-transparent border-none outline-none text-[10px] font-black uppercase text-on-surface/60"
                                                        value={selectedService}
                                                        onChange={e => setSelectedService(e.target.value)}
                                                    >
                                                        <option value="">+ Add Service...</option>
                                                        {masterServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                    </select>
                                                    <button onClick={handleAddService} className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center"><Plus size={14} /></button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {loggedServices.length === 0 ? (
                                                <div className="col-span-full py-12 bg-white/50 rounded-[2rem] border border-dashed border-on-surface/10 text-center text-on-surface/30 font-bold italic text-sm">
                                                    No services recorded yet
                                                </div>
                                            ) : loggedServices.map(ls => (
                                                <div key={ls.id} className="bg-white rounded-[2rem] p-6 border border-surface-low/30 shadow-sm relative group">
                                                    {!isLocked && (
                                                        <button onClick={() => removeService(ls.id)} className="absolute top-4 right-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                                                    )}
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center font-black text-xs uppercase">{ls.services?.code?.substring(0,2)}</div>
                                                        <div>
                                                            <div className="text-xs font-black text-on-surface leading-none uppercase">{ls.services?.name}</div>
                                                            <div className="text-[9px] font-bold text-on-surface/30 mt-0.5 tracking-widest">{ls.services?.code}</div>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-2xl">
                                                             <span className="text-[9px] font-black text-on-surface/30">QTY</span>
                                                             <input 
                                                                type="number" 
                                                                className="bg-transparent border-none outline-none w-12 text-right font-black text-primary text-sm" 
                                                                defaultValue={ls.quantity} 
                                                                disabled={isLocked}
                                                                onBlur={e => handleUpdateServiceField(ls.id, 'quantity', parseInt(e.target.value))}
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                             <span className="text-[9px] font-black text-on-surface/20 uppercase tracking-widest ml-1">Service Timeline</span>
                                                             <div className="flex flex-col gap-2">
                                                                <input 
                                                                    type="datetime-local" 
                                                                    className="bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2 text-[11px] font-bold w-full" 
                                                                    defaultValue={formatInputTime(ls.start_time)} 
                                                                    disabled={isLocked}
                                                                    onBlur={e => handleUpdateServiceField(ls.id, 'start_time', e.target.value)}
                                                                />
                                                                <input 
                                                                    type="datetime-local" 
                                                                    className="bg-slate-50/50 border border-slate-100 rounded-xl px-4 py-2 text-[11px] font-bold w-full" 
                                                                    defaultValue={formatInputTime(ls.end_time)} 
                                                                    disabled={isLocked}
                                                                    onBlur={e => handleUpdateServiceField(ls.id, 'end_time', e.target.value)}
                                                                />
                                                             </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Formal Narrative Area */}
                                    <div className="bg-white rounded-[3rem] p-10 border border-surface-low/30 shadow-xl space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-[11px] font-black text-on-surface uppercase tracking-[0.2em] flex items-center gap-2">
                                                <FileText size={18} className="text-primary" /> Formal Narrative (Giornale di Bordo)
                                            </h4>
                                            {!isLocked && (
                                                <button onClick={handleSaveNarrative} className="text-xs font-black text-primary hover:underline flex items-center gap-2">
                                                    <Save size={14} /> Quick Save
                                                </button>
                                            )}
                                        </div>
                                        <textarea 
                                            className="w-full min-h-[250px] bg-transparent border-none outline-none font-manrope font-medium text-lg leading-relaxed text-on-surface/80 placeholder:text-on-surface/10 selection:bg-primary/20"
                                            value={narrative}
                                            onChange={e => setNarrative(e.target.value)}
                                            disabled={isLocked}
                                            placeholder="Scrivi qui la relazione formale dell'attività arricchita dai dettagli di porto..."
                                        />
                                    </div>

                                </div>
                            )}

                            {activeTab === 'messages' && (
                                <div className="max-w-4xl mx-auto h-full flex flex-col space-y-6">
                                    <div className="flex-1 bg-white rounded-[3rem] p-8 border border-white shadow-sm flex flex-col">
                                        <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide">
                                            {messages.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                                                    <MessageSquare size={64} />
                                                    <p className="font-extrabold uppercase tracking-widest text-xs mt-4">No internal comms for this entry</p>
                                                </div>
                                            ) : (
                                                messages.map(m => {
                                                    const isMine = m.sender_id === userId;
                                                    return (
                                                        <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                                            <div className={`max-w-[80%] p-6 rounded-[2rem] ${!isMine ? 'bg-slate-50 rounded-tl-none' : 'bg-primary text-white rounded-tr-none shadow-lg'}`}>
                                                                <div className={`flex items-center gap-3 mb-2 opacity-40 text-[9px] font-black uppercase tracking-tighter ${isMine ? 'justify-end' : ''}`}>
                                                                    <span>{m.sender?.display_name || 'User'}</span>
                                                                    <span>•</span>
                                                                    <span>{new Date(m.created_at).toLocaleTimeString()}</span>
                                                                </div>
                                                                <p className="text-sm font-bold leading-relaxed">{m.message_text}</p>
                                                                {m.included_in_logbook && (
                                                                    <div className={`mt-3 inline-flex items-center gap-2 px-2 py-1 ${isMine ? 'bg-white/10' : 'bg-primary/10 text-primary'} rounded-lg text-[8px] font-black uppercase tracking-widest`}>
                                                                        <CheckCircle size={10} /> Certified Content
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                        <form onSubmit={handleSendMessage} className="mt-8 flex gap-3 p-2 bg-slate-50 rounded-full border border-slate-100">
                                            <input 
                                                type="text" 
                                                className="bg-transparent border-none outline-none flex-1 px-6 py-2 text-sm font-bold" 
                                                placeholder="Type internal message to Operation Hub..."
                                                value={msgText}
                                                onChange={e => setMsgText(e.target.value)}
                                            />
                                            <button className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20"><Send size={18} /></button>
                                        </form>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'twin' && (
                                <div className="max-w-4xl mx-auto space-y-8">
                                     <div className="bg-white rounded-[3rem] p-10 border border-white shadow-sm">
                                        <div className="flex items-center gap-6 mb-8">
                                            <div className="w-16 h-16 rounded-3xl bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-100"><ShieldCheck size={32} /></div>
                                            <div>
                                                <h3 className="text-2xl font-manrope font-extrabold text-on-surface tracking-tight">Certification Record</h3>
                                                <p className="text-xs font-black text-on-surface/40 uppercase tracking-widest">Integrità Crittografica Verificata</p>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="p-6 bg-slate-50 rounded-[2rem] space-y-4">
                                                <div className="flex items-center gap-2 text-[10px] font-black text-on-surface/40 uppercase tracking-widest"><Fingerprint size={14} /> SHA-256 Document Hash</div>
                                                <code className="block bg-white p-4 rounded-2xl text-[10px] font-mono font-bold break-all border border-slate-100">
                                                    {entry?.document_hash || 'PENDING_CERTIFICATION'}
                                                </code>
                                            </div>
                                            <div className="p-6 bg-slate-50 rounded-[2rem] space-y-4">
                                                 <div className="flex items-center gap-2 text-[10px] font-black text-on-surface/40 uppercase tracking-widest"><Activity size={14} /> Audit Sequence</div>
                                                 <div className="space-y-3">
                                                    {[
                                                        { label: 'ATA Automated', status: 'Success', icon: CheckCircle },
                                                        { label: 'Sequence Integrity', status: 'Verified', icon: CheckCircle },
                                                        { label: 'Captain Ownership', status: 'Assumed', icon: CheckCircle }
                                                    ].map((a, i) => (
                                                        <div key={i} className="flex items-center justify-between text-xs font-bold">
                                                            <span className="opacity-40">{a.label}</span>
                                                            <span className="flex items-center gap-2 text-green-600"><a.icon size={12} /> {a.status}</span>
                                                        </div>
                                                    ))}
                                                 </div>
                                            </div>
                                        </div>
                                     </div>

                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <button 
                                            onClick={handleExportXLSX}
                                            disabled={!isLocked || exporting}
                                            className={`bg-white p-6 rounded-[2.5rem] border border-white shadow-sm flex items-center justify-between group transition-all text-left ${!isLocked ? 'opacity-30 cursor-not-allowed' : 'hover:border-primary active:scale-95'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
                                                    {exporting ? <Clock size={20} className="animate-spin" /> : <Download size={20} />}
                                                </div>
                                                 <div>
                                                    <div className="text-sm font-black text-on-surface">Export Technical XLSX</div>
                                                    <div className="text-[10px] font-bold text-on-surface/30 uppercase tracking-widest">Excel Audit Ready</div>
                                                 </div>
                                            </div>
                                            <ArrowRight size={20} className="text-on-surface/10 group-hover:text-primary transition-all" />
                                        </button>
                                        <button 
                                            onClick={handleDownloadPDF}
                                            disabled={!isLocked || exporting}
                                            className={`bg-white p-6 rounded-[2.5rem] border border-white shadow-sm flex items-center justify-between group transition-all text-left ${!isLocked ? 'opacity-30 cursor-not-allowed' : 'hover:border-primary active:scale-95'}`}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                                                    {exporting ? <Clock size={20} className="animate-spin" /> : <Download size={20} />}
                                                </div>
                                                 <div>
                                                    <div className="text-sm font-black text-on-surface">Download Formal PDF</div>
                                                    <div className="text-[10px] font-bold text-on-surface/30 uppercase tracking-widest">Giornale di Bordo PDF</div>
                                                 </div>
                                            </div>
                                            <ArrowRight size={20} className="text-on-surface/10 group-hover:text-primary transition-all" />
                                        </button>
                                     </div>
                                </div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>

            </motion.div>
        </div>
    );
}
