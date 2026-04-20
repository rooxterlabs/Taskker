import React from 'react';
import { X, History } from 'lucide-react';
import { patchNotes } from '../patchNotes';

export default function PatchNotesModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={onClose}>
            <div className="w-full max-w-sm bg-slate-900 overflow-hidden rounded-[2rem] border border-slate-700/50 flex flex-col shadow-[0_30px_80px_-15px_rgba(0,0,0,1)] relative max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-5 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center shrink-0">
                    <h2 className="text-[10px] md:text-xs font-black uppercase text-emerald-500 tracking-widest flex items-center gap-2">
                        <History className="w-3.5 h-3.5 md:w-4 md:h-4" /> Patch Notes
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Close">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="flex-1 overflow-y-auto pill-scrollbar p-5 flex flex-col gap-6 pr-3">
                    {patchNotes.map((note, index) => (
                        <div key={index} className="flex flex-col gap-2 relative border border-slate-800/80 bg-slate-950/40 rounded-xl p-4 transition-colors hover:border-slate-700/50 shadow-inner">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-1">
                                <span className="text-[10px] md:text-xs font-black uppercase text-blue-400 tracking-wider bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">{note.version}</span>
                                <span className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-widest italic">{note.date}</span>
                            </div>
                            <ul className="flex flex-col gap-1.5 list-disc list-inside">
                                {note.notes.map((item, i) => (
                                    <li key={i} className="text-[10px] text-slate-300 leading-snug">
                                        <span className="-ml-1">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                    {patchNotes.length === 0 && (
                        <div className="text-center text-slate-500 text-[10px] italic py-8">
                            No patch notes available.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
