import React, { useState, useEffect } from 'react';
import {
    X, BookOpen, MessageSquare, Ship, Clock, Save, Send, Plus, Trash2,
    Lock, CheckCircle, FileText, Download, User, ShieldCheck, Fingerprint,
    Anchor, ArrowRight, Info, AlertTriangle, Calendar, Activity, ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLogbook } from '../hooks/useLogbook';
import { useMessaging } from '../hooks/useMessaging';
import { useServices } from '../hooks/useServices';

const formatInputTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toISOString().slice(0, 16);
};

export default function MobileLogbookWriter({ activity, userId, userRole = 'crew', onClose }) {
    const {
        entry, services: loggedServices, loading: entryLoading,
        saveNarrative, submitLogbook, addService, removeService, updateService
    } = useLogbook(activity?.id);

    const {
        messages, sendMessage
    } = useMessaging(activity?.id, userId);

    const { services: masterServices } = useServices();

    const [activeTab, setActiveTab] = useState('narrative');
    const [narrative, setNarrative] = useState('');
    const [msgText, setMsgText] = useState('');
    const [selectedService, setSelectedService] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        if (entry?.narrative_text !== undefined) {
            setNarrative(entry.narrative_text || '');
        }
    }, [entry]);

    const isLocked = entry?.status !== 'draft';

    const hapticFeedback = (pattern = [40]) => {
        if (window.navigator.vibrate) {
            window.navigator.vibrate(pattern);
        }
    };

    const handleSaveNarrative = async () => {
        if (isLocked || isSaving) return;
        setIsSaving(true);
        const res = await saveNarrative(narrative);
        setIsSaving(false);
        if (res.success) {
            hapticFeedback([50]);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2000);
        }
    };

    const handleSubmit = async () => {
        if (isLocked) return;
        if (!window.confirm('CONFERMA: Stai per certificare questo rapporto. Questa azione è definitiva. Procedere?')) return;
        
        const res = await submitLogbook();
        if (res.success) {
            hapticFeedback([100, 50, 100]);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!msgText.trim()) return;
        const res = await sendMessage(msgText, userRole);
        if (res.success) {
            setMsgText('');
            hapticFeedback([30]);
        }
    };

    const handleAddService = async () => {
        if (!selectedService || isLocked) return;
        const res = await addService(selectedService);
        if (res.success) {
            setSelectedService('');
            hapticFeedback([40]);
        }
    };

    const handleUpdateServiceField = async (svcId, field, value) => {
        if (isLocked) return;
        const res = await updateService(svcId, { [field]: value || null });
        if (res.success) hapticFeedback([20]);
    };

    if (!activity) return null;

    return (
        <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[120] bg-surface flex flex-col pt-safe pb-safe"
        >
            {/* --- COMPACT KINETIC HEADER --- */}
            <header className="h-16 shrink-0 border-b border-surface-low/30 px-4 flex items-center justify-between bg-white/80 backdrop-blur-xl">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface/60 active:bg-surface-low"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-sm font-manrope font-extrabold text-on-surface leading-none uppercase tracking-tight">
                            {activity.vessel}
                        </h2>
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">
                            {activity.activity}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {saveSuccess ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 rounded-full text-white text-[10px] font-black uppercase transition-all">
                            <CheckCircle size={12} /> Salvato
                        </div>
                    ) : !isLocked && (
                        <button 
                            onClick={handleSaveNarrative}
                            disabled={isSaving}
                            className="bg-primary/10 text-primary px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                        >
                            {isSaving ? 'Salvataggio...' : 'Salva Bozza'}
                        </button>
                    )}
                    {isLocked && (
                        <div className="px-3 py-1.5 bg-slate-100 rounded-full text-slate-500 text-[9px] font-black uppercase flex items-center gap-1.5">
                            <Lock size={10} /> Certificato
                        </div>
                    )}
                </div>
            </header>

            {/* --- COMPACT TABS --- */}
            <nav className="flex px-2 bg-surface-low/20 shrink-0 border-b border-surface-low/20">
                {[
                    { id: 'narrative', label: 'Rapporto', icon: FileText },
                    { id: 'services', label: 'Servizi', icon: Anchor, count: loggedServices.length },
                    { id: 'messages', label: 'Chat', icon: MessageSquare, count: messages.filter(m => m.sender_role === 'admin').length }
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => { setActiveTab(t.id); hapticFeedback([20]); }}
                        className={`
                            flex-1 flex flex-col items-center gap-1 py-3 transition-all relative
                            ${activeTab === t.id ? 'text-primary' : 'text-on-surface/30'}
                        `}
                    >
                        <t.icon size={18} />
                        <span className="text-[9px] font-black uppercase tracking-widest">{t.label}</span>
                        {t.count > 0 && (
                            <span className="absolute top-2 right-[30%] bg-secondary text-white text-[8px] min-w-[14px] h-[14px] px-1 rounded-full flex items-center justify-center font-black">
                                {t.count}
                            </span>
                        )}
                        {activeTab === t.id && (
                            <motion.div layoutId="activeTabMobile" className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-full" />
                        )}
                    </button>
                ))}
            </nav>

            {/* --- DENSE CONTENT AREA --- */}
            <main className="flex-1 overflow-y-auto px-4 py-6 scrollbar-hide">
                <AnimatePresence mode="wait">
                    {activeTab === 'narrative' && (
                        <motion.div 
                            key="narrative"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-6"
                        >
                            {/* Time Summary Card */}
                            <div className="bg-white rounded-3xl p-5 border border-surface-low/30 shadow-sm">
                                <h4 className="text-[10px] font-black text-on-surface/30 uppercase tracking-[0.2em] mb-4">Cronologia Validata</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold text-on-surface/20 uppercase tracking-widest">ATA (Arrivo)</p>
                                        <p className="text-sm font-manrope font-extrabold text-on-surface">
                                            {new Date(activity.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[9px] font-bold text-on-surface/20 uppercase tracking-widest">ATD (Partenza)</p>
                                        <p className={`text-sm font-manrope font-extrabold ${!activity.endTime ? 'text-primary animate-pulse' : 'text-on-surface'}`}>
                                            {activity.endTime ? new Date(activity.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Work in progress'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Narrative Input - DENSE & LARGE */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-on-surface/40 uppercase tracking-[0.2em] ml-2">Giornale di Bordo</label>
                                <div className="bg-white rounded-[2.5rem] p-6 border border-primary/10 shadow-sm focus-within:ring-2 ring-primary/15 transition-all">
                                    <textarea 
                                        className="w-full min-h-[350px] bg-transparent border-none outline-none font-manrope font-semibold text-base leading-relaxed text-on-surface/80 placeholder:text-on-surface/10"
                                        value={narrative}
                                        onChange={e => setNarrative(e.target.value)}
                                        disabled={isLocked}
                                        placeholder="Inserisci qui i dettagli formali dell'attività..."
                                    />
                                </div>
                            </div>

                            {/* Certification Button */}
                            {!isLocked && (
                                <button 
                                    onClick={handleSubmit}
                                    className="w-full py-5 bg-gradient-to-r from-primary to-secondary text-white rounded-[2rem] font-manrope font-extrabold text-sm uppercase tracking-[0.2em] shadow-lg shadow-primary/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                                >
                                    <ShieldCheck size={18} /> Certifica Rapporto
                                </button>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'services' && (
                        <motion.div 
                            key="services"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-5"
                        >
                            {/* Service Selector */}
                            {!isLocked && (
                                <div className="flex items-center gap-2 p-2 bg-white rounded-full border border-surface-low border-dashed">
                                    <select 
                                        className="flex-1 bg-transparent border-none outline-none text-xs font-black uppercase text-on-surface/60 pl-4"
                                        value={selectedService}
                                        onChange={e => setSelectedService(e.target.value)}
                                    >
                                        <option value="">Aggiungi Servizio...</option>
                                        {masterServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                    <button 
                                        onClick={handleAddService}
                                        className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-md active:scale-90 transition-transform"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </div>
                            )}

                            {/* Service List Item - DENSE CARD */}
                            <div className="space-y-3">
                                {loggedServices.length === 0 ? (
                                    <div className="py-20 text-center opacity-20 flex flex-col items-center">
                                        <Anchor size={48} />
                                        <p className="text-[10px] font-black uppercase tracking-widest mt-4">Nessun servizio registrato</p>
                                    </div>
                                ) : loggedServices.map(ls => (
                                    <div key={ls.id} className="bg-white rounded-3xl p-5 border border-surface-low/30 shadow-sm relative group">
                                        {!isLocked && (
                                            <button 
                                                onClick={() => removeService(ls.id)}
                                                className="absolute top-4 right-4 text-red-400 p-2"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="w-10 h-10 rounded-xl bg-primary/5 text-primary flex items-center justify-center">
                                                <Anchor size={18} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-manrope font-extrabold text-on-surface leading-tight uppercase">
                                                    {ls.services?.name}
                                                </h4>
                                                <p className="text-[9px] font-black text-on-surface/30 uppercase tracking-widest">
                                                    Cod: {ls.services?.code}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between gap-4 p-3 bg-surface-low/30 rounded-2xl">
                                             <span className="text-[10px] font-black text-on-surface/40 uppercase">Quantità</span>
                                             <div className="flex items-center gap-4">
                                                <button 
                                                    className="w-8 h-8 rounded-lg bg-white border border-surface-low flex items-center justify-center text-primary font-bold active:bg-primary/5"
                                                    onClick={() => handleUpdateServiceField(ls.id, 'quantity', Math.max(1, (ls.quantity || 1) - 1))}
                                                    disabled={isLocked}
                                                >
                                                    -
                                                </button>
                                                <span className="text-base font-black text-on-surface w-6 text-center">{ls.quantity || 1}</span>
                                                <button 
                                                    className="w-8 h-8 rounded-lg bg-white border border-surface-low flex items-center justify-center text-primary font-bold active:bg-primary/5"
                                                    onClick={() => handleUpdateServiceField(ls.id, 'quantity', (ls.quantity || 1) + 1)}
                                                    disabled={isLocked}
                                                >
                                                    +
                                                </button>
                                             </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'messages' && (
                        <motion.div 
                            key="messages"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="h-full flex flex-col"
                        >
                            <div className="flex-1 space-y-4 mb-20">
                                {messages.length === 0 ? (
                                    <div className="py-20 text-center opacity-10 flex flex-col items-center">
                                        <MessageSquare size={48} />
                                        <p className="text-[10px] font-black uppercase tracking-widest mt-4">Nessun messaggio interno</p>
                                    </div>
                                ) : messages.map(m => (
                                    <div key={m.id} className={`flex ${m.sender_role === 'admin' ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`
                                            max-w-[85%] p-4 rounded-3xl text-sm font-bold leading-snug
                                            ${m.sender_role === 'admin' 
                                                ? 'bg-white border border-surface-low/30 rounded-tl-none shadow-sm' 
                                                : 'bg-primary text-white rounded-tr-none shadow-md shadow-primary/10'}
                                        `}>
                                            <p>{m.message_text}</p>
                                            <span className={`text-[8px] font-black uppercase mt-1 block opacity-40`}>
                                                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Bottom Input Fixed above Safe Area */}
                            <div className="fixed bottom-0 left-0 right-0 p-4 bg-surface/80 backdrop-blur-xl border-t border-surface-low/30 pb-safe">
                                <form onSubmit={handleSendMessage} className="flex gap-2">
                                    <input 
                                        type="text" 
                                        className="flex-1 bg-white border border-surface-low px-5 py-3 rounded-full text-sm font-bold outline-none focus:ring-2 ring-primary/20" 
                                        placeholder="Messaggio per Hub..."
                                        value={msgText}
                                        onChange={e => setMsgText(e.target.value)}
                                    />
                                    <button className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform">
                                        <Send size={20} />
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </motion.div>
    );
}
