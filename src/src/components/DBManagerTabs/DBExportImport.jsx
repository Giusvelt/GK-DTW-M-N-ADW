import React from 'react';
import { FileDown, Upload, Info } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function DBExportImport({ activeTab, filteredData, dataSources, setForm, setShowModal }) {
    const handleExport = () => {
        const ws = XLSX.utils.json_to_sheet(filteredData.map(item => {
            const copy = { ...item };
            delete copy.polygon_coords;
            delete copy.created_at;
            delete copy.updated_at;
            return copy;
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, activeTab);
        XLSX.writeFile(wb, `${activeTab}_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws);
            if (data.length > 0) {
                // Open modal with first imported row for fast data entry review
                setForm(data[0]);
                setShowModal(true);
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="bg-white/50 backdrop-blur-md rounded-2xl p-4 border border-white flex flex-wrap gap-2 items-center justify-between shadow-sm">
            <div className="flex items-center gap-2 text-on-surface/50 text-[10px] font-black uppercase tracking-widest px-2">
                <Info size={14} /> <span>Data Tools</span>
            </div>
            <div className="flex gap-2">
                <button onClick={handleExport} className="flex items-center gap-2 px-5 py-2.5 bg-surface-lowest border border-surface-low/30 rounded-2xl text-xs font-black uppercase tracking-widest text-on-surface hover:bg-white shadow-sm transition-all hover:scale-[1.02]">
                    <FileDown size={14} className="text-primary" /> Export
                </button>
                <label className="flex items-center gap-2 px-5 py-2.5 bg-surface-lowest border border-surface-low/30 rounded-2xl text-xs font-black uppercase tracking-widest text-on-surface hover:bg-white shadow-sm transition-all hover:scale-[1.02] cursor-pointer">
                    <Upload size={14} className="text-secondary" /> Import Template
                    <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImport} />
                </label>
            </div>
        </div>
    );
}
