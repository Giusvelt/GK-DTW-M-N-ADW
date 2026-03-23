import React from 'react';
import { Edit2, Trash2, Map, AlertTriangle } from 'lucide-react';

export default function DBTable({ 
    activeTab, 
    filteredData, 
    handleEdit, 
    handleDelete, 
    companies, 
    deleteConfirm, 
    setDeleteConfirm 
}) {
    if (!filteredData || filteredData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-3xl border border-surface-low/30 backdrop-blur-md">
                <div className="w-16 h-16 bg-surface-low/30 rounded-2xl flex items-center justify-center text-on-surface/30 mb-4">
                    <AlertTriangle size={32} />
                </div>
                <h3 className="font-extrabold text-on-surface text-lg">No records found</h3>
                <p className="text-sm font-bold text-on-surface/50 mt-1">Try adjusting your search or add a new record.</p>
            </div>
        );
    }

    return (
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-surface-low/10 border-b border-surface-low/20 text-[10px] uppercase tracking-widest font-black text-on-surface/40">
                            {activeTab === 'vessels' && (
                                <>
                                    <th className="p-4 pl-6">Vessel</th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">MMSI / IMO</th>
                                    <th className="p-4">Company</th>
                                </>
                            )}
                            {activeTab === 'companies' && (
                                <>
                                    <th className="p-4 pl-6">Company/Supplier</th>
                                    <th className="p-4">VAT / Country</th>
                                    <th className="p-4">Contact</th>
                                    <th className="p-4">Roles</th>
                                </>
                            )}
                            {activeTab === 'geofences' && (
                                <>
                                    <th className="p-4 pl-6">Geofence Name</th>
                                    <th className="p-4">Nature</th>
                                    <th className="p-4">Family / Color</th>
                                </>
                            )}
                            {activeTab === 'activities' && (
                                <>
                                    <th className="p-4 pl-6">Code / Name</th>
                                    <th className="p-4">Category</th>
                                    <th className="p-4 hidden md:table-cell">Description</th>
                                </>
                            )}
                            {activeTab === 'services' && (
                                <>
                                    <th className="p-4 pl-6">Code / Service Name</th>
                                    <th className="p-4">Provider</th>
                                </>
                            )}
                            {activeTab === 'standby' && (
                                <>
                                    <th className="p-4 pl-6">Code / Reason Name</th>
                                    <th className="p-4 hidden md:table-cell">Description</th>
                                </>
                            )}
                            <th className="p-4 pr-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm font-extrabold text-on-surface divide-y divide-surface-low/20">
                        {filteredData.map(item => (
                            <tr key={item.id} className="hover:bg-primary/5 transition-colors group">
                                {activeTab === 'vessels' && (
                                    <>
                                        <td className="p-4 pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10">
                                                    <span className="text-lg font-black text-primary">{item.name[0]}</span>
                                                </div>
                                                <span className="font-extrabold text-base tracking-tight">{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="inline-flex px-3 py-1 rounded-full bg-surface-low/30 text-xs font-black tracking-wide text-on-surface/70">
                                                {item.type || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs">
                                            <div className="font-black text-on-surface/80">{item.mmsi || 'N/A'}</div>
                                            <div className="font-bold text-on-surface/40">IMO: {item.imo || 'N/A'}</div>
                                        </td>
                                        <td className="p-4 text-xs font-bold text-on-surface/60">
                                            {companies.find(c => c.id === item.company_id)?.name || 'Unknown'}
                                        </td>
                                    </>
                                )}

                                {activeTab === 'companies' && (
                                    <>
                                        <td className="p-4 pl-6">
                                            <div className="font-extrabold text-base tracking-tight">{item.name}</div>
                                            <div className="text-[10px] font-black uppercase text-on-surface/40 tracking-widest">{item.address}</div>
                                        </td>
                                        <td className="p-4 text-xs">
                                            <div className="font-black text-on-surface/80">{item.vat_number || 'N/A'}</div>
                                            <div className="font-bold text-on-surface/40">{item.country || 'N/A'}</div>
                                        </td>
                                        <td className="p-4 text-xs text-on-surface/60 font-bold">
                                            {item.contact_email}<br/>{item.contact_phone}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-1">
                                                {item.is_company && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[9px] font-black uppercase tracking-widest">Company</span>}
                                                {item.is_supplier && <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-widest">Supplier</span>}
                                            </div>
                                        </td>
                                    </>
                                )}

                                {activeTab === 'geofences' && (
                                    <>
                                        <td className="p-4 pl-6">
                                            <div className="font-extrabold text-base tracking-tight flex items-center gap-2">
                                                {item.name}
                                                {item.polygon_coords && <Map size={14} className="text-green-500" />}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-on-surface/70 capitalize">
                                            {item.nature?.replace('_', ' ')}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 rounded-full border border-surface-low/50" style={{ backgroundColor: item.color || '#ccc' }} />
                                                <span className="text-xs font-bold text-on-surface/60">{item.family || 'N/A'}</span>
                                            </div>
                                        </td>
                                    </>
                                )}

                                {activeTab === 'activities' && (
                                    <>
                                        <td className="p-4 pl-6">
                                            <div className="font-extrabold text-base tracking-tight">{item.name}</div>
                                            <div className="text-[10px] font-black text-primary tracking-widest bg-primary/10 inline-block px-1.5 rounded">{item.code}</div>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-on-surface/70 capitalize">{item.category}</td>
                                        <td className="p-4 text-xs font-bold text-on-surface/50 hidden md:table-cell max-w-xs truncate">{item.description}</td>
                                    </>
                                )}
                                {activeTab === 'services' && (
                                    <>
                                        <td className="p-4 pl-6">
                                            <div className="font-extrabold text-base tracking-tight">{item.name}</div>
                                            <div className="text-[10px] font-black text-purple-600 tracking-widest bg-purple-100 inline-block px-1.5 rounded">{item.code}</div>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-on-surface/70">{item.provider || 'N/A'}</td>
                                    </>
                                )}
                                {activeTab === 'standby' && (
                                    <>
                                        <td className="p-4 pl-6">
                                            <div className="font-extrabold text-base tracking-tight">{item.name}</div>
                                            <div className="text-[10px] font-black text-amber-600 tracking-widest bg-amber-100 inline-block px-1.5 rounded">{item.code}</div>
                                        </td>
                                        <td className="p-4 text-xs font-bold text-on-surface/50 hidden md:table-cell max-w-xs truncate">{item.description}</td>
                                    </>
                                )}

                                <td className="p-4 pr-6 text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEdit(item)} className="p-2 rounded-xl text-blue-500 hover:bg-blue-50 transition-colors" title="Edit">
                                            <Edit2 size={16} />
                                        </button>
                                        
                                        {deleteConfirm === item.id ? (
                                            <div className="flex items-center bg-red-50 text-red-600 rounded-xl overflow-hidden border border-red-100">
                                                <button onClick={() => handleDelete(item.id)} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors">Confirm</button>
                                                <button onClick={() => setDeleteConfirm(null)} className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-l border-red-200 hover:bg-red-100 transition-colors">Cancel</button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setDeleteConfirm(item.id)} className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-colors" title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="bg-surface-lowest px-6 py-3 border-t border-surface-low/20 text-xs font-bold text-on-surface/40 flex justify-between items-center">
                <span>Showing {filteredData.length} records</span>
            </div>
        </div>
    );
}
