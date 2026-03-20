import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Mail, Type, Loader2, CheckCircle2 } from 'lucide-react';

export default function InviteMemberForm() {
    const [email, setEmail] = useState('');
    const [preferredName, setPreferredName] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleInvite = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            // 1. Insert placeholder row into team_members
            const { error: dbError } = await supabase
                .from('team_members')
                .insert([{
                    email: email,
                    name: preferredName,
                    status: 'invited'
                    // user_id is left null intentionally until they onboard
                }]);

            if (dbError) throw dbError;

            // 2. Trigger the Edge Function to securely send the invite email
            const { data: edgeData, error: edgeError } = await supabase.functions.invoke('invite-user', {
                body: { email, preferredName }
            });

            if (edgeError) {
                console.error("Edge function error:", edgeError);
                throw new Error("Failed to send invite email. The placeholder was created, however.");
            }

            setSuccessMsg(`Successfully invited ${preferredName}!`);
            setEmail('');
            setPreferredName('');
        } catch (error) {
            setErrorMsg(error.message || 'An error occurred during invitation.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="glass p-6 rounded-2xl border border-slate-700/50 shadow-xl max-w-md w-full relative overflow-hidden group animate-in fade-in duration-300">
            {/* Minimalist Top Border Highlight */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-emerald-500 opacity-50" />

            <div className="flex flex-col gap-6">
                <div>
                    <h2 className="text-xl font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-blue-500" />
                        Invite Team Member
                    </h2>
                    <p className="text-slate-400 font-light text-xs mt-1">
                        Send an invitation link and create a placeholder profile to start assigning tasks immediately.
                    </p>
                </div>

                {errorMsg && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2 rounded-lg">
                        {errorMsg}
                    </div>
                )}

                {successMsg && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3 py-2 rounded-lg flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        {successMsg}
                    </div>
                )}

                <form onSubmit={handleInvite} className="flex flex-col gap-4">
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="email"
                            placeholder="Email Address (Required)"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                            required
                        />
                    </div>

                    <div className="relative">
                        <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Display Name (Required)"
                            value={preferredName}
                            onChange={(e) => setPreferredName(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                            required
                        />
                    </div>



                    <button
                        type="submit"
                        disabled={loading || !email || !preferredName}
                        className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 active:scale-[0.98] text-sm"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <UserPlus className="w-4 h-4" /> Send Invite
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
