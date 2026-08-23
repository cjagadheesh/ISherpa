import { StrictMode, useEffect, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SplashScreen from './components/SplashScreen.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import { isSupabaseConfigured, supabase } from './supabase.js'

function Root() {
  const [splashDone, setSplashDone] = useState(false);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return undefined;
    }

    let sub = null;

    try {
      supabase.auth.getSession()
        .then(({ data, error }) => {
          if (error) {
            console.error("Supabase getSession error:", error);
            setAuthError(error.message);
          } else {
            setSession(data?.session || null);
          }
        })
        .catch(err => {
          console.error("Supabase getSession error:", err);
          setAuthError(err?.message || "Failed to load session");
        })
        .finally(() => {
          setAuthLoading(false);
        });

      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
      });
      sub = data?.subscription;
    } catch (err) {
      console.error("Supabase init error:", err);
      setAuthError(err?.message || "Auth initialization failed");
      setAuthLoading(false);
    }

    return () => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, []);

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6 text-center">
        Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable secure user workspaces.
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center p-6 text-center text-sm font-medium">
        Loading authentication...
      </div>
    );
  }

  if (!session) {
    return <AuthScreen authError={authError} />;
  }

  return (
    <>
      {!splashDone && <SplashScreen onFinish={handleSplashFinish} />}
      {/* App pre-renders beneath splash; dark loading screen in App covers any flash */}
      <App user={session.user} onSignOut={() => supabase.auth.signOut()} />
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)

