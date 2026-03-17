import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Lock, Type, CheckCircle2 } from 'lucide-react';

export default function OnboardingGate({ user, onComplete }) {
    const [preferredName, setPreferredName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetchingName, setFetchingName] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        // Attempt to pre-fill the name from the team_members table
        const fetchPlaceholder = async () => {
            if (!user?.email) return;
            try {
                const { data, error } = await supabase
                    .from('team_members')
                    .select('name')
                    .eq('email', user.email)
                    .eq('status', 'invited')
                    .single();

                if (data && data.name) {
                    setPreferredName(data.name);
                }
            } catch (err) {
                console.error("Could not fetch placeholder name:", err);
            } finally {
                setFetchingName(false);
            }
        };

        fetchPlaceholder();
    }, [user]);

    const handleSave = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (password !== confirmPassword) {
            setErrorMsg('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            setErrorMsg('Password must be at least 6 characters.');
            return;
        }

        if (!preferredName.trim()) {
            setErrorMsg('Preferred Name is required.');
            return;
        }

        setLoading(true);

        try {
            // 1. Update the user password
            const { error: passwordError } = await supabase.auth.updateUser({
                password: password
            });

            if (passwordError) throw passwordError;

            // 2. Link their Auth ID to the team_members roster placeholder
            const { error: rpcError } = await supabase.rpc('handle_member_onboarding', {
                target_email: user.email,
                new_name: preferredName.trim(),
                new_user_id: user.id
            });

            if (rpcError) throw rpcError;

            setSuccessMsg('Account successfully set up! Entering Taskker...');

            // Give them a brief moment to see success before entering
            setTimeout(() => {
                onComplete();
            }, 1500);

        } catch (error) {
            setErrorMsg(error.message || 'An error occurred during account setup.');
            setLoading(false);
        }
    };

    if (fetchingName) {
        return (
            <div className="min-h-screen bg-black text-slate-50 flex flex-col items-center justify-center font-sans relative">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <div className="animate-pulse text-blue-400 font-bold tracking-[0.2em] text-sm">LOADING PROFILE...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-slate-50 flex items-center justify-center font-sans relative p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-black to-black">
            <div className="glass p-8 rounded-3xl border border-slate-700/50 shadow-2xl max-w-md w-full relative overflow-hidden group animate-in fade-in zoom-in-95 duration-500">
                {/* Minimalist Top Border Highlight */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 to-emerald-500 opacity-70" />

                <div className="flex flex-col gap-6">
                    <div className="text-center">
                        <h2 className="text-2xl font-black uppercase tracking-wider text-slate-100 flex items-center justify-center gap-2 mb-2">
                            Welcome to Taskker
                        </h2>
                        <p className="text-slate-400 font-light text-sm">
                            Let's finish setting up your account for <strong className="text-blue-400 font-medium">{user?.email}</strong>.
                        </p>
                    </div>

                    {errorMsg && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                            {errorMsg}
                        </div>
                    )}

                    {successMsg && (
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-xl flex items-center justify-center gap-2">
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                            {successMsg}
                        </div>
                    )}

                    <form onSubmit={handleSave} className="flex flex-col gap-5">
                        <div className="relative">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1.5 block">Preferred Name</label>
                            <div className="relative">
                                <Type className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="e.g. John Doe"
                                    value={preferredName}
                                    onChange={(e) => setPreferredName(e.target.value)}
                                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    required
                                    disabled={loading || successMsg !== ''}
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1.5 block">New Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    required
                                    disabled={loading || successMsg !== ''}
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1.5 block">Confirm Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-slate-900/60 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                                    required
                                    disabled={loading || successMsg !== ''}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !preferredName || !password || !confirmPassword || successMsg !== ''}
                            className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                "Save & Enter"
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
