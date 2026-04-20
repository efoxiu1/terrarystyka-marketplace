'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabase'; // Upewnij się, że ścieżka jest poprawna
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();
  
  // Maszyna stanów: co aktualnie robimy?
  const [view, setView] = useState<'login' | 'register' | 'forgot' | 'success'>('register');
  
  // Dane z formularza
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  
  // Komunikaty dla użytkownika
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // --- 1. REJESTRACJA ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });

    if (error) {
      // Magia: Łapiemy błąd, że użytkownik już istnieje!
      if (error.message.includes('already registered')) {
        setErrorMsg('Ten e-mail jest już w naszej bazie. Zaloguj się lub zresetuj hasło.');
        setView('login'); // Automatycznie przełączamy na widok logowania
      } else {
        setErrorMsg(error.message);
      }
    } else {
      setSuccessMsg(`Wysłaliśmy link aktywacyjny na adres ${email}. Sprawdź folder Spam!`);
      setView('success');
    }
    setLoading(false);
  };

  // --- 2. LOGOWANIE ---
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMsg('Nieprawidłowy e-mail lub hasło.');
    } else {
      router.push('/'); // Sukces -> lecimy na stronę główną!
    }
    setLoading(false);
  };

  // --- 3. RESET HASŁA ---
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Wysyłamy maila z linkiem do resetu. 
    // redirectTo to strona, na której klient FAKTYCZNIE wpisze nowe hasło.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/ustaw-nowe-haslo`,
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg(`Wysłaliśmy instrukcję resetu hasła na adres ${email}.`);
      setView('success');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl transition-all duration-300">
        
        {/* --- EKRAN SUKCESU --- */}
        {view === 'success' ? (
          <div className="text-center animate-in zoom-in-95 duration-500">
            <div className="text-6xl mb-4">💌</div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Sprawdź skrzynkę!</h2>
            <p className="text-gray-500 font-medium mb-6">{successMsg}</p>
            <button onClick={() => setView('login')} className="bg-black text-white px-6 py-3 rounded-xl font-bold">
              Wróć do logowania
            </button>
          </div>
        ) : (
          
        /* --- EKRANY FORMULARZY --- */
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-2xl font-black mb-6">
              {view === 'register' ? 'Załóż konto' : view === 'login' ? 'Zaloguj się' : 'Odzyskaj hasło'}
            </h2>

            {/* Wyświetlanie błędów */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-bold rounded-xl border border-red-100">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={view === 'register' ? handleSignUp : view === 'login' ? handleSignIn : handleResetPassword} className="space-y-4">
              
              {/* Nick (Tylko przy rejestracji) */}
              {view === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Twój Nick</label>
                  <input required type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full border bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              )}

              {/* Email (Zawsze widoczny) */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Adres E-mail</label>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" autoComplete="email" />
              </div>

              {/* Hasło (Niewidoczne tylko przy resecie) */}
              {view !== 'forgot' && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase">Hasło</label>
                    {view === 'login' && (
                      <button type="button" onClick={() => setView('forgot')} className="text-xs font-bold text-green-600 hover:text-green-700">
                        Zapomniałeś?
                      </button>
                    )}
                  </div>
                  <input required type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full border bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none" autoComplete={view === 'register' ? 'new-password' : 'current-password'} />
                </div>
              )}

              {/* Przycisk Główny */}
              <button disabled={loading} type="submit" className="w-full bg-green-500 hover:bg-green-600 text-black font-black p-4 rounded-xl transition disabled:opacity-50 mt-4">
                {loading ? 'Przetwarzanie...' : view === 'register' ? 'Zarejestruj się' : view === 'login' ? 'Wejdź do giełdy' : 'Wyślij link do resetu'}
              </button>
            </form>

            {/* Zmiana trybów na dole */}
            <div className="mt-6 text-center text-sm font-medium text-gray-500">
              {view === 'register' ? (
                <>Masz już konto? <button onClick={() => setView('login')} className="text-black font-black hover:underline">Zaloguj się</button></>
              ) : (
                <>Nie masz konta? <button onClick={() => setView('register')} className="text-black font-black hover:underline">Załóż je teraz</button></>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}