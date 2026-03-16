import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, Mail, Lock, UserPlus, LogIn } from 'lucide-react';

export default function Login() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');
        setSuccessMsg('');

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;

                if (!data.session) {
                    setSuccessMsg('Success! Please check your email to confirm your account, or sign in if confirmation is disabled.');
                    setIsSignUp(false);
                }
                // If data.session exists, App.jsx's onAuthStateChange will automatically transition to Dashboard
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            }
        } catch (error) {
            setErrorMsg(error.message || 'An error occurred during authentication.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-slate-50 flex flex-col items-center justify-center font-sans p-4 relative overflow-hidden selection:bg-blue-500/30">
            {/* Background aesthetics matching main app */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-3xl z-0" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative z-10 w-full max-w-md">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extralight tracking-widest text-slate-200 mb-2">
                        TASKKER<span className="text-blue-500 font-bold">.IO</span>
                    </h1>
                    <p className="text-slate-400 font-light tracking-wide text-sm">
                        Please sign in to access your workspace.
                    </p>
                </div>

                <div className="glass p-8 md:p-10 rounded-[2.5rem] border border-slate-700/50 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600 opacity-50" />

                    <form onSubmit={handleAuth} className="flex flex-col gap-6">
                        <h2 className="text-2xl font-bold uppercase tracking-wider text-slate-200">
                            {isSignUp ? 'Create Account' : 'Welcome Back'}
                        </h2>

                        {errorMsg && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
                                {errorMsg}
                            </div>
                        )}

                        {successMsg && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm px-4 py-3 rounded-xl">
                                {successMsg}
                            </div>
                        )}

                        <div className="flex flex-col gap-4">
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm"
                                    required
                                />
                            </div>

                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="password"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-12 pr-4 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono text-sm"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                        >
                            {loading ? (
                                <Activity className="w-5 h-5 animate-spin" />
                            ) : isSignUp ? (
                                <>
                                    <UserPlus className="w-5 h-5" /> Sign Up
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" /> Sign In
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-700/50 text-center">
                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setErrorMsg('');
                                setSuccessMsg('');
                            }}
                            className="text-slate-400 hover:text-white text-sm transition-colors"
                        >
                            {isSignUp ? 'Already have an account? Sign in.' : "Don't have an account? Sign up."}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
