import React, { useState } from 'react';
import { MdIcon } from '../common';
import { signInWithGoogle, signInWithEmail, signUpWithEmail, friendlyError } from '../../services/auth';

function LoginScreen({ onClose }) {
    const [mode,            setMode]            = useState('signin'); // 'signin' | 'signup'
    const [email,           setEmail]           = useState('');
    const [password,        setPassword]        = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading,         setLoading]         = useState(false);
    const [error,           setError]           = useState(null);

    // Email / password handler
    async function handleEmailAuth(e) {
        e.preventDefault();
        if (!email.trim() || !password) { setError('Please fill in all fields.'); return; }
        if (mode === 'signup') {
            if (password.length < 6)          { setError('Password must be at least 6 characters.'); return; }
            if (password !== confirmPassword)  { setError('Passwords do not match.'); return; }
        }
        setLoading(true); setError(null);
        try {
            if (mode === 'signup') {
                await signUpWithEmail(email.trim(), password);
            } else {
                await signInWithEmail(email.trim(), password);
            }
        } catch(err) {
            setError(friendlyError(err));
        } finally { setLoading(false); }
    }

    // Google OAuth handler
    async function handleGoogleSignIn() {
        setLoading(true); setError(null);
        try {
            await signInWithGoogle();
        } catch(err) {
            if (err.code !== 'auth/popup-closed-by-user') {
                setError(friendlyError(err));
            }
        } finally { setLoading(false); }
    }

    const inputStyle = {
        width: '100%', padding: '11px 14px', borderRadius: 10,
        background: 'var(--card-mid)', border: '1px solid var(--card-border)',
        color: 'var(--text-primary)', fontSize: 15, outline: 'none',
        boxSizing: 'border-box', fontFamily: 'var(--font-sans)',
        transition: 'border-color 0.15s'
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px 16px', overflowY: 'auto'
        }}>
            <div style={{ width: '100%', maxWidth: 360, background: 'var(--bg-elevated)', borderRadius: 20, padding: '32px 28px', position: 'relative', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>

                {/* Close button */}
                {onClose && (
                    <button onClick={onClose} style={{
                        position: 'absolute', top: 14, right: 14,
                        background: 'var(--card-high)', border: 'none', borderRadius: 8,
                        width: 32, height: 32, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-secondary)'
                    }}>
                        <MdIcon name="close" style={{ fontSize: 18 }} />
                    </button>
                )}

                {/* Branding */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom: 28 }}>
                    <div style={{
                        width: 68, height: 68, borderRadius: 20,
                        background: 'var(--accent)', marginBottom: 18,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: 'var(--accent-glow)'
                    }}>
                        <MdIcon name="flight" style={{ fontSize: 38, color: '#fff' }} />
                    </div>
                    <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.4px', margin: 0, color: 'var(--text-primary)' }}>
                        FlightScore
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0', textAlign: 'center', lineHeight: 1.5 }}>
                        Sync your flights across all devices.
                    </p>
                </div>

                {/* Sign In / Create Account tab switcher */}
                <div style={{ display:'flex', background:'var(--card-mid)', borderRadius:12, padding:3, marginBottom:22 }}>
                    {[['signin','Sign In'],['signup','Create Account']].map(function([m, label]) {
                        return (
                            <button key={m} onClick={() => { setMode(m); setError(null); setPassword(''); setConfirmPassword(''); }}
                                style={{
                                    flex:1, padding:'8px 0', borderRadius:10, border:'none', cursor:'pointer',
                                    background: mode === m ? 'var(--card-high)' : 'transparent',
                                    color: mode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                                    fontWeight: mode === m ? 600 : 400, fontSize: 14,
                                    transition: 'all 0.15s', fontFamily: 'var(--font-sans)'
                                }}
                            >{label}</button>
                        );
                    })}
                </div>

                {/* Email / password form */}
                <form onSubmit={handleEmailAuth} style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:18 }}>
                    <div>
                        <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Email</label>
                        <input type="email" value={email} autoComplete="email"
                            onChange={e => setEmail(e.target.value)}
                            placeholder="pilot@example.com"
                            style={inputStyle} disabled={loading} />
                    </div>
                    <div>
                        <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Password</label>
                        <input type="password" value={password}
                            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                            onChange={e => setPassword(e.target.value)}
                            placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
                            style={inputStyle} disabled={loading} />
                    </div>
                    {mode === 'signup' && (
                        <div>
                            <label style={{ fontSize:13, fontWeight:500, color:'var(--text-secondary)', display:'block', marginBottom:5 }}>Confirm Password</label>
                            <input type="password" value={confirmPassword} autoComplete="new-password"
                                onChange={e => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter password"
                                style={inputStyle} disabled={loading} />
                        </div>
                    )}

                    {error && (
                        <div style={{
                            padding:'10px 14px', borderRadius:10,
                            background:'var(--nogo-bg)', color:'var(--nogo)',
                            fontSize:13, lineHeight:1.4
                        }}>{error}</div>
                    )}

                    <button type="submit" disabled={loading} style={{
                        background:'var(--accent)', color:'#fff',
                        border:'none', borderRadius:12,
                        padding:'13px 0', fontSize:15, fontWeight:700,
                        cursor: loading ? 'default' : 'pointer',
                        opacity: loading ? 0.7 : 1, transition:'opacity 0.15s',
                        fontFamily: 'var(--font-sans)'
                    }}>
                        {loading ? 'Please wait\u2026' : (mode === 'signin' ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                {/* Divider */}
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                    <div style={{ flex:1, height:1, background:'var(--card-border)' }} />
                    <span style={{ fontSize:12, color:'var(--text-tertiary)', whiteSpace:'nowrap' }}>or continue with</span>
                    <div style={{ flex:1, height:1, background:'var(--card-border)' }} />
                </div>

                {/* Google Sign-In button */}
                <button onClick={handleGoogleSignIn} disabled={loading} style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                    width:'100%', background:'#ffffff', color:'#3c4043',
                    border:'1px solid rgba(0,0,0,0.15)', borderRadius:12,
                    padding:'12px 0', fontSize:14, fontWeight:600,
                    cursor: loading ? 'default' : 'pointer',
                    boxShadow:'0 1px 6px rgba(0,0,0,0.12)',
                    opacity: loading ? 0.7 : 1, transition:'opacity 0.15s',
                    fontFamily: 'var(--font-sans)'
                }}>
                    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink:0 }}>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                        <path fill="none" d="M0 0h48v48H0z"/>
                    </svg>
                    Continue with Google
                </button>

                <p style={{ marginTop:22, fontSize:12, color:'var(--text-tertiary)', textAlign:'center', lineHeight:1.5 }}>
                    Sign in to sync your flights across devices.
                </p>

                {/* Continue as Guest */}
                {onClose && (
                    <button onClick={onClose} style={{
                        display: 'block', width: '100%', marginTop: 10,
                        background: 'none', border: 'none',
                        color: 'var(--text-tertiary)', fontSize: 13,
                        cursor: 'pointer', padding: '6px 0',
                        fontFamily: 'var(--font-sans)',
                        textDecoration: 'underline'
                    }}>
                        Continue without an account
                    </button>
                )}
            </div>
        </div>
    );
}

export default LoginScreen;
