import React from 'react';
import { Save, MapPin, Hash, Activity, Briefcase, FileText, Wrench, Building2, HeartPulse, Globe, Mail, Phone } from 'lucide-react';

export const ModalField = ({ label, value, onChange, icon: Icon, type = "text", placeholder="" }) => (
    <div className="flex flex-col">
        <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest mb-2 px-1">{label}</label>
        <div className="relative flex items-center">
            {Icon && <Icon size={16} className="absolute left-5 text-on-surface/20" />}
            <input 
                type={type} 
                className={`w-full bg-surface-low/20 border-none rounded-2xl ${Icon ? 'pl-12' : 'px-5'} py-4 text-sm font-extrabold text-on-surface placeholder:text-on-surface/10 outline-none focus:ring-2 ring-primary/20 transition-all`}
                value={value || ''}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
            />
        </div>
    </div>
);

export default function DBModal({ activeTab, form, setForm, setShowModal, handleSave, editingItem, companies }) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-on-surface/20 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl border border-surface-low/30 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-500">
                <div className="px-8 py-6 border-b border-surface-low/30 flex justify-between items-center bg-gradient-to-br from-surface-lowest to-white">
                    <h2 className="font-extrabold text-xl text-on-surface tracking-tight">
                        {editingItem ? 'Edit ' : 'New '}{activeTab.slice(0, -1)}
                    </h2>
                </div>

                <div className="p-8 flex flex-col gap-6 bg-surface-lowest overflow-y-auto max-h-[70vh] scrollbar-hide">
                    {activeTab === 'vessels' && (
                        <>
                            <ModalField label="Vessel Name *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Activity} />
                            <div className="grid grid-cols-2 gap-4">
                                <ModalField label="MMSI *" value={form.mmsi} onChange={v => setForm({...form, mmsi: v})} icon={Hash} type="number" />
                                <ModalField label="IMO" value={form.imo} onChange={v => setForm({...form, imo: v})} icon={Hash} type="number" />
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest px-1">Type *</label>
                                <select className="w-full bg-surface-low/20 border-none rounded-2xl px-5 py-4 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none"
                                    value={form.type || ''} onChange={e => setForm({...form, type: e.target.value})}>
                                    <option value="">Select Type...</option>
                                    <option value="Dredger">Dredger</option>
                                    <option value="Tug">Tug</option>
                                    <option value="Barge">Barge</option>
                                    <option value="Survey">Survey</option>
                                    <option value="Support">Support</option>
                                    <option value="Crane">Crane</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest px-1">Company *</label>
                                <select className="w-full bg-surface-low/20 border-none rounded-2xl px-5 py-4 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none"
                                    value={form.company_id || ''} onChange={e => setForm({...form, company_id: e.target.value})}>
                                    <option value="">Select Company...</option>
                                    {companies?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    {activeTab === 'companies' && (
                        <>
                            <ModalField label="Company/Supplier Name *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Building2} />
                            <ModalField label="VAT Number" value={form.vat_number} onChange={v => setForm({...form, vat_number: v})} icon={Hash} />
                            <ModalField label="Address" value={form.address} onChange={v => setForm({...form, address: v})} icon={MapPin} />
                            <ModalField label="Country" value={form.country} onChange={v => setForm({...form, country: v})} icon={Globe} />
                            <ModalField label="Contact Email" value={form.contact_email} onChange={v => setForm({...form, contact_email: v})} icon={Mail} type="email" />
                            <ModalField label="Contact Phone" value={form.contact_phone} onChange={v => setForm({...form, contact_phone: v})} icon={Phone} />
                            
                            <div className="flex items-center gap-4 mt-2 p-4 bg-surface-low/20 rounded-2xl border border-surface-low/50">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 text-primary rounded border-surface-low/50 focus:ring-primary/20"
                                        checked={form.is_company || false} onChange={e => setForm({...form, is_company: e.target.checked})} />
                                    <span className="text-[10px] font-black text-on-surface uppercase tracking-tight">Main Company</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="w-4 h-4 text-primary rounded border-surface-low/50 focus:ring-primary/20"
                                        checked={form.is_supplier || false} onChange={e => setForm({...form, is_supplier: e.target.checked})} />
                                    <span className="text-[10px] font-black text-on-surface uppercase tracking-tight">Supplier</span>
                                </label>
                            </div>
                        </>
                    )}

                    {activeTab === 'geofences' && (
                        <>
                            <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={MapPin} />
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-1 px-1">Nature *</label>
                                <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none" value={form.nature || ''} onChange={e => setForm({ ...form, nature: e.target.value })}>
                                    <option value="">Select...</option>
                                    <option value="loading_site">Loading Site</option>
                                    <option value="unloading_site">Unloading Site</option>
                                    <option value="base_port">Base Port</option>
                                    <option value="anchorage">Anchorage</option>
                                    <option value="transit">Transit</option>
                                    <option value="mooring">Mooring</option>
                                    <option value="port">Port</option>
                                    <option value="rada">Rada</option>
                                    <option value="general">General</option>
                                </select>
                            </div>
                            <ModalField label="Family" value={form.family || ''} onChange={v => setForm({ ...form, family: v })} icon={Briefcase} />
                            <ModalField label="Color" value={form.color || '#3b82f6'} onChange={v => setForm({ ...form, color: v })} icon={null} type="color" />
                            <div className="dbm-info-box col-span-2 p-3 bg-blue-50/50 rounded-xl flex items-center gap-2 text-[10px] text-blue-500 font-bold border border-blue-100 mt-2">
                                <MapPin size={14} />
                                <span>Geofences are polygon-only. Define vertices on the map or via DB import.</span>
                            </div>
                        </>
                    )}

                    {activeTab === 'activities' && (
                        <>
                            <ModalField label="Code *" value={form.code} onChange={v => setForm({...form, code: v.toUpperCase()})} icon={Hash} />
                            <ModalField label="Activity Name *" value={form.name} onChange={v => setForm({...form, name: v})} icon={Activity} />
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-black text-on-surface/30 uppercase tracking-widest block mb-1 px-1">Category</label>
                                <select className="w-full bg-surface-low/20 border-none rounded-xl px-4 py-3 text-sm font-extrabold text-on-surface outline-none focus:ring-2 ring-primary/20 transition-all appearance-none" value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })}>
                                    <option value="">Select...</option>
                                    <option value="navigation">Navigation</option>
                                    <option value="mooring">Mooring</option>
                                    <option value="cargo">Cargo</option>
                                    <option value="supply">Supply</option>
                                    <option value="maintenance">Maintenance</option>
                                </select>
                            </div>
                            <ModalField label="Description" value={form.description} onChange={v => setForm({...form, description: v})} icon={FileText} />
                        </>
                    )}
                    {activeTab === 'services' && (
                        <>
                            <ModalField label="Code *" value={form.code || ''} onChange={v => setForm({ ...form, code: v.toUpperCase() })} icon={Hash} />
                            <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={Wrench} />
                            <ModalField label="Provider" value={form.provider || ''} onChange={v => setForm({ ...form, provider: v })} icon={Building2} />
                        </>
                    )}
                    {activeTab === 'standby' && (
                        <>
                            <ModalField label="Code *" value={form.code || ''} onChange={v => setForm({ ...form, code: v.toUpperCase() })} icon={Hash} />
                            <ModalField label="Name *" value={form.name || ''} onChange={v => setForm({ ...form, name: v })} icon={HeartPulse} />
                            <ModalField label="Description" value={form.description || ''} onChange={v => setForm({ ...form, description: v })} icon={FileText} />
                        </>
                    )}
                </div>

                <div className="p-6 bg-surface-low/20 border-t border-surface-low/30 flex items-center justify-end gap-3">
                    <button onClick={() => setShowModal(false)} className="px-6 py-2 rounded-full text-[9px] font-black text-on-surface/40 uppercase tracking-widest hover:bg-white transition-all">Cancel</button>
                    <button onClick={handleSave} className="bg-primary text-white px-8 py-2 rounded-full text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center gap-2 hover:translate-y-[-2px] transition-all">
                        <Save size={14} /> {editingItem ? 'Update' : 'Register'}
                    </button>
                </div>
            </div>
        </div>
    );
}
