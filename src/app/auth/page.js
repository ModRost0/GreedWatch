// src/app/auth/page.jsx
'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import styles from './page.module.css';

function AuthContent() {
  const searchParams = useSearchParams();
  const isSignUp = searchParams.get('signup') === 'true';
  
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState(isSignUp ? 'signup' : 'signin');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  
  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    
    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        await signUp(email, password);
        setSuccess('Account created! Check your email to confirm.');
      } else {
        await signIn(email, password);
        setSuccess('Signed in successfully!');
        // Redirect after short delay
        setTimeout(() => {
          window.location.href = '/';
        }, 500);
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }
  
  function switchMode(newMode) {
    setMode(newMode);
    setError(null);
    setSuccess(null);
    setPassword('');
    setConfirmPassword('');
  }
  
  return (
    <div className={styles.authPage}>
      <div className={styles.authContainer}>
        <Link href="/" className={styles.backLink}>
          ← Back to Home
        </Link>
        
        <div className={styles.authCard}>
          <div className={styles.authHeader}>
            <h1 className={styles.authTitle}>
              {mode === 'signup' ? 'Create Account' : 'Welcome Back'}
            </h1>
            <p className={styles.authSubtitle}>
              {mode === 'signup' 
                ? 'Join Greed to sync your favorites and history' 
                : 'Sign in to continue watching'}
            </p>
          </div>
          
          {/* Mode Toggle */}
          <div className={styles.modeToggle}>
            <button
              className={`${styles.modeButton} ${mode === 'signin' ? styles.activeMode : ''}`}
              onClick={() => switchMode('signin')}
            >
              Sign In
            </button>
            <button
              className={`${styles.modeButton} ${mode === 'signup' ? styles.activeMode : ''}`}
              onClick={() => switchMode('signup')}
            >
              Sign Up
            </button>
          </div>
          
          {error && (
            <div className={styles.errorBox}>
              <span>⚠️</span> {error}
            </div>
          )}
          
          {success && (
            <div className={styles.successBox}>
              <span>✅</span> {success}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className={styles.authForm}>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            
            <div className={styles.inputGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder={mode === 'signup' ? 'Min 6 characters' : 'Your password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>
            
            {mode === 'signup' && (
              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            )}
            
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? (
                <span className={styles.loadingSpinner}></span>
              ) : mode === 'signup' ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          
          <div className={styles.authFooter}>
            <p>
              {mode === 'signup' 
                ? 'Already have an account?' 
                : "Don't have an account?"}
            </p>
            <button 
              className={styles.switchButton}
              onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}
            >
              {mode === 'signup' ? 'Sign In' : 'Sign Up'}
            </button>
          </div>
          
          <p className={styles.termsText}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className={styles.authPage}><div className={styles.authContainer}>Loading...</div></div>}>
      <AuthContent />
    </Suspense>
  );
}