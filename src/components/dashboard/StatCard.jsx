
import React from 'react';

export function StatCard({ title, value, icon: Icon, colorClass = "text-blue-400" }) {
    return (
        <div className="stat-card-widget glass-panel p-6 rounded-2xl relative overflow-hidden group hover:bg-slate-900/80 transition-all duration-300">
            <div className="flex justify-between items-start mb-4 relative z-10">
                <span className="text-slate-400 text-sm font-medium">{title}</span>
                <div className={`p-2 rounded-lg bg-slate-950/50 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div className="text-3xl font-bold text-white relative z-10">{value}</div>

            {/* Background Glow Effect */}
            <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity ${colorClass.replace('text-', 'bg-')}`}></div>
        </div>
    );
}
