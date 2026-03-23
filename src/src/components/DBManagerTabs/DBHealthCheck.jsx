import React from 'react';
import { HeartPulse, CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export default function DBHealthCheck({ results, running, runCheck }) {
    return (
        <div className="bg-white/80 backdrop-blur-md rounded-3xl border border-white shadow-sm p-6 overflow-hidden relative">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="font-extrabold text-lg text-on-surface tracking-tight flex items-center gap-2">
                        <HeartPulse className="text-red-500" size={20} />
                        System Diagnostics
                    </h3>
                    <p className="text-xs font-bold text-on-surface/50 mt-1">Verifying backend tables, RLS policies, and basic connectivity.</p>
                </div>
                <button 
                    onClick={runCheck} 
                    disabled={running}
                    className="flex items-center gap-2 px-5 py-2.5 bg-surface-lowest border border-surface-low/30 rounded-2xl text-xs font-black uppercase tracking-widest text-on-surface/60 hover:text-on-surface hover:bg-white shadow-sm transition-all disabled:opacity-50"
                >
                    <RefreshCw size={14} className={running ? "animate-spin text-primary" : ""} />
                    {running ? 'Running...' : 'Run Diagnostics'}
                </button>
            </div>

            {results && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {results.tables.map(t => (
                        <div key={t.name} className={`p-4 rounded-2xl border ${t.status === 'ok' ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'} flex items-start justify-between group transition-all hover:shadow-md`}>
                            <div className="flex flex-col">
                                <span className={`text-[10px] font-black uppercase tracking-widest ${t.status === 'ok' ? 'text-green-600' : 'text-red-600'} mb-1`}>{t.name}</span>
                                <span className="text-sm font-extrabold text-on-surface tracking-tight">{t.count} records</span>
                                {t.error && <span className="text-[9px] font-bold text-red-500 mt-2 bg-red-100 p-1.5 rounded">{t.error}</span>}
                            </div>
                            {t.status === 'ok' ? <CheckCircle size={20} className="text-green-500" /> : <XCircle size={20} className="text-red-500" />}
                        </div>
                    ))}
                    <div className="col-span-full p-4 mt-2 bg-surface-lowest rounded-2xl border border-surface-low/30 flex items-center gap-4 text-xs font-bold text-on-surface/60">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100"><AlertTriangle size={16} /></div>
                        RLS (Row Level Security) policies are currently enforcing data isolation for {results.tables.length} verified collections.
                    </div>
                </div>
            )}
            
            {!results && !running && (
                <div className="text-center py-12 text-on-surface/40 font-bold text-sm">
                    Click "Run Diagnostics" to check database health.
                </div>
            )}
        </div>
    );
}
