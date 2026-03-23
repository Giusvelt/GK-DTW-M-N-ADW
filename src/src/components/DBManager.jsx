import React, { useState, useEffect } from 'react';
import { Ship, MapPin, Activity, Wrench, HeartPulse, Building2, Search, Plus } from 'lucide-react';
import { useVesselStore } from '../store/useVesselStore';
import { useGeofenceStore } from '../store/useGeofenceStore';
import { useConfigStore } from '../store/useConfigStore';
import { useActivities } from '../hooks/useActivities';
import { useServices } from '../hooks/useServices';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { supabase } from '../lib/supabase';
import SectionHeader from './SectionHeader';

import DBTable from './DBManagerTabs/DBTable';
import DBModal from './DBManagerTabs/DBModal';
import DBHealthCheck from './DBManagerTabs/DBHealthCheck';
import DBExportImport from './DBManagerTabs/DBExportImport';

const TABS = [
    { id: 'vessels', label: 'Vessels', icon: Ship, color: '#3b82f6' },
    { id: 'companies', label: 'Companies & Suppliers', icon: Building2, color: '#6366f1' },
    { id: 'geofences', label: 'Geofences', icon: MapPin, color: '#10b981' },
    { id: 'activities', label: 'Activities', icon: Activity, color: '#f59e0b' },
    { id: 'services', label: 'Nautical Services', icon: Wrench, color: '#8b5cf6' },
    { id: 'standby', label: 'Stand-by Reasons', icon: HeartPulse, color: '#f59e0b' },
    { id: 'health', label: 'System Health', icon: HeartPulse, color: '#ef4444' },
];

const DatabaseIcon = (props) => (
    <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>
    </svg>
);

export default function DBManager() {
    const { vessels, addVessel, updateVessel, deleteVessel } = useVesselStore();
    const { geofences, addGeofence, updateGeofence, deleteGeofence } = useGeofenceStore();
    const { standbyReasons, addStandbyReason, updateStandbyReason, deleteStandbyReason } = useConfigStore();

    const { activityTypes, addActivityType, updateActivityType, deleteActivityType } = useActivities();
    const { services, addService, updateService, deleteService } = useServices();
    const { results: healthResults, running: healthRunning, runCheck } = useHealthCheck();

    const [companies, setCompanies] = useState([]);
    const [companiesLoading, setCompaniesLoading] = useState(false);

    const [activeTab, setActiveTab] = useState('vessels');
    const [searchQuery, setSearchQuery] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [form, setForm] = useState({});
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => {
        const fetchCompanies = async () => {
            setCompaniesLoading(true);
            const { data } = await supabase.from('companies').select('*').order('name');
            setCompanies(data || []);
            setCompaniesLoading(false);
        };
        fetchCompanies();
    }, []);

    // ── CRUD Wrappers for Companies ──
    const addCompany = async (company) => {
        const { data, error } = await supabase.from('companies').insert([company]).select();
        if (!error) setCompanies(prev => [...prev, data[0]].sort((a,b) => a.name.localeCompare(b.name)));
        return { success: !error };
    };
    const updateCompany = async (id, updates) => {
        const { error } = await supabase.from('companies').update(updates).eq('id', id);
        if (!error) setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        return { success: !error };
    };
    const deleteCompany = async (id) => {
        const { error } = await supabase.from('companies').delete().eq('id', id);
        if (!error) setCompanies(prev => prev.filter(c => c.id !== id));
        return { success: !error };
    };

    const getTabConfig = () => {
        switch (activeTab) {
            case 'vessels': return { data: vessels, add: addVessel, update: updateVessel, del: deleteVessel };
            case 'companies': return { data: companies, add: addCompany, update: updateCompany, del: deleteCompany };
            case 'geofences': return { data: geofences, add: addGeofence, update: updateGeofence, del: deleteGeofence };
            case 'activities': return { data: activityTypes, add: addActivityType, update: updateActivityType, del: deleteActivityType };
            case 'services': return { data: services, add: addService, update: updateService, del: deleteService };
            case 'standby': return { data: standbyReasons, add: addStandbyReason, update: updateStandbyReason, del: deleteStandbyReason };
            default: return { data: [], add: async () => {}, update: async () => {}, del: async () => {} };
        }
    };

    const { data, add, update, del } = getTabConfig();

    const filteredData = data.filter(item => {
        const q = searchQuery.toLowerCase();
        return (item.name?.toLowerCase().includes(q) || item.code?.toLowerCase().includes(q) || item.mmsi?.toLowerCase().includes(q) || item.vat_number?.toLowerCase().includes(q));
    });

    const handleSave = async () => {
        try {
            const result = editingItem ? await update(editingItem.id, form) : await add(form);
            if (result.success) setShowModal(false);
            else alert("Error saving record");
        } catch (error) {
            console.error("Save error", error);
        }
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setForm(item);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        await del(id);
        setDeleteConfirm(null);
    };

    return (
        <div className="space-y-6 lg:space-y-8 pb-32 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
            <SectionHeader 
                icon={DatabaseIcon}
                title="Master Data Management"
                subtitle="Configure system-wide settings, operational rules, and reference catalogs."
                color="from-primary to-secondary"
            />

            <nav className="flex flex-wrap items-center gap-2 p-2 bg-white/50 backdrop-blur-md rounded-3xl border border-white shadow-sm overflow-x-auto scrollbar-hide">
                {TABS.map(tab => {
                    const isActive = activeTab === tab.id;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => { setActiveTab(tab.id); setSearchQuery(''); setDeleteConfirm(null); }}
                            className={`flex items-center gap-2 px-5 py-3 lg:px-6 lg:py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap
                                ${isActive ? 'bg-white text-on-surface shadow-md scale-100 border border-surface-low/30' : 'text-on-surface/50 hover:text-on-surface hover:bg-white/50 scale-[0.98]'}`}
                        >
                            <Icon size={16} style={{ color: isActive ? tab.color : 'currentColor' }} />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>

            {activeTab === 'health' ? (
                <DBHealthCheck results={healthResults} running={healthRunning} runCheck={runCheck} />
            ) : (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                        <div className="relative flex-1 w-full max-w-md">
                            <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-on-surface/30" />
                            <input
                                type="text"
                                placeholder={`Search ${activeTab}...`}
                                className="w-full bg-white/80 border border-white rounded-[2rem] pl-12 pr-6 py-4 text-sm font-extrabold text-on-surface placeholder:text-on-surface/30 outline-none focus:ring-2 ring-primary/20 shadow-sm transition-all"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <button
                                onClick={() => { setEditingItem(null); setForm(activeTab === 'geofences' ? { polygon_coords: [] } : {}); setShowModal(true); }}
                                className="flex-1 md:flex-none bg-primary text-white px-8 py-4 rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/30 flex items-center justify-center gap-3 hover:translate-y-[-2px] transition-all"
                            >
                                <Plus size={16} /> New Record
                            </button>
                        </div>
                    </div>

                    <DBTable 
                        activeTab={activeTab}
                        filteredData={filteredData}
                        handleEdit={handleEdit}
                        handleDelete={handleDelete}
                        deleteConfirm={deleteConfirm}
                        setDeleteConfirm={setDeleteConfirm}
                        companies={companies}
                    />

                    <DBExportImport 
                        activeTab={activeTab}
                        filteredData={filteredData}
                        setForm={setForm}
                        setShowModal={setShowModal}
                        dataSources={getTabConfig()}
                    />
                </div>
            )}

            {showModal && (
                <DBModal 
                    activeTab={activeTab}
                    form={form}
                    setForm={setForm}
                    setShowModal={setShowModal}
                    handleSave={handleSave}
                    editingItem={editingItem}
                    companies={companies}
                />
            )}
        </div>
    );
}
