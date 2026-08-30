// src/context/AuthContext.jsx - Fixed
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Default context value - never null
const AuthContext = createContext({
  user: null,
  loading: false,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setLoading(false);
    }).catch(() => {
      setUser(null);
      setLoading(false);
    });
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    
    return () => subscription?.unsubscribe();
  }, []);
  
  async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }
  
  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }
  
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
  }
  
  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  // Always return a valid object, never null or throw
  return context || { user: null, loading: false, signUp: async () => {}, signIn: async () => {}, signOut: async () => {} };
}