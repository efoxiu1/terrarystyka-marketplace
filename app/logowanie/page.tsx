'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function Logowanie() {
  const router = useRouter();
  
  // MASZYNA STANÓW: Zaczynamy od logowania (twój design)
  const [view, setView] = useState<'login' | 'register' | 'forgot' | 'success'>('login');
  
  // DANE FORMULARZA
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  
  // STATUSY
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // --- 1. LOGOWANIE ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setErrorMsg('Nieprawidłowy e-mail lub hasło.');
      setLoading(false);
    } else {
      router.push('/');
      router.refresh(); 
    }
  };

  // --- 2. REJESTRACJA (Z naszymi "bramkarzami") ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Bramkarz 1: Hasła
    if (password !== confirmPassword) {
      setErrorMsg('Podane hasła się od siebie różnią!');
      setLoading(false);
      return;
    }

    // Bramkarz 2: Nick
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (existingUser) {
      setErrorMsg('Ten nick jest już zajęty. Wymyśl inny!');
      setLoading(false);
      return;
    }

    // Właściwa rejestracja
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } }
    });

   if (error) {
      // BRAMKARZ 3: Jeśli Supabase zgłasza błąd, że mail już istnieje
      if (error.message.includes('already registered') || error.message.includes('User already registered')) {
        setErrorMsg('email_taken'); // <-- ZMIANA: Ustawiamy tajny kod błędu
      } else {
        setErrorMsg(error.message); 
      }
    } else {
      setSuccessMsg(`Wysłaliśmy link aktywacyjny na adres ${email}. Sprawdź folder Spam!`);
      setView('success');
    }
    setLoading(false);
  };

  // --- 3. RESET HASŁA ---
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

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

  // --- CZYSZCZENIE BŁĘDÓW PRZY ZMIANIE WIDOKU ---
  const switchView = (newView: 'login' | 'register' | 'forgot') => {
    setErrorMsg('');
    setView(newView);
  };

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border w-full max-w-md transition-all duration-300">
        
        {/* --- DYNAMICZNY NAGŁÓWEK --- */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            {view === 'success' ? '💌' : view === 'forgot' ? '🔑' : '🦎'}
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">
            {view === 'login' && 'Witaj ponownie'}
            {view === 'register' && 'Dołącz do nas'}
            {view === 'forgot' && 'Reset hasła'}
            {view === 'success' && 'Sprawdź skrzynkę!'}
          </h1>
          <p className="text-gray-500 font-medium">
            {view === 'login' && 'Zaloguj się do swojego konta'}
            {view === 'register' && 'Stwórz profil hodowcy'}
            {view === 'forgot' && 'Podaj maila, by odzyskać dostęp'}
            {view === 'success' && 'Wysłaliśmy Ci ważną wiadomość'}
          </p>
        </div>

        {/* --- WIDOK SUKCESU MAILA --- */}
        {view === 'success' ? (
          <div className="text-center animate-in zoom-in-95">
            <p className="text-gray-600 font-medium mb-6 text-lg">{successMsg}</p>
            <button onClick={() => switchView('login')} className="bg-black text-white px-6 py-4 rounded-xl font-bold text-lg w-full">
              Wróć do logowania
            </button>
          </div>
        ) : (
          
          /* --- WIDOKI FORMULARZY (Z Twoim designem) --- */
          <div className="animate-in fade-in">
            {errorMsg === 'email_taken' ? (
              <div className="bg-orange-50 text-orange-700 p-5 rounded-xl mb-6 text-sm text-center border border-orange-200 shadow-sm animate-in fade-in">
                <span className="font-black block mb-2 text-base">Ten adres e-mail jest już zajęty! 🚨</span>
                <p className="mb-3 font-medium opacity-90">Wygląda na to, że masz już u nas konto.</p>
                <button 
                  type="button"
                  onClick={() => switchView('forgot')} 
                  className="bg-orange-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-orange-700 transition shadow-sm w-full"
                >
                  Odzyskaj hasło do konta
                </button>
              </div>
            ) : errorMsg ? (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-bold text-sm text-center border border-red-100 animate-in fade-in">
                {errorMsg}
              </div>
            ) : null}

            <form onSubmit={view === 'register' ? handleSignUp : view === 'login' ? handleLogin : handleResetPassword} className="space-y-5">
              
              {/* NICK (Tylko Rejestracja) */}
              {view === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Twój Nick</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full border bg-gray-50 p-4 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition text-lg" />
                </div>
              )}

              {/* EMAIL (Zawsze) */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Adres E-mail</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className="w-full border bg-gray-50 p-4 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition text-lg" />
              </div>

              {/* HASŁA (Znikają tylko przy resecie) */}
              {view !== 'forgot' && (
                <>
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase">Hasło</label>
                      {view === 'login' && (
                        <button type="button" onClick={() => switchView('forgot')} className="text-xs text-green-600 font-bold hover:underline">
                          Zapomniałeś hasła?
                        </button>
                      )}
                    </div>
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete={view === 'register' ? 'new-password' : 'current-password'} className="w-full border bg-gray-50 p-4 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition text-lg" />
                  </div>

                  {/* POWTÓRZ HASŁO (Tylko Rejestracja) */}
                  {view === 'register' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Powtórz Hasło</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" className="w-full border bg-gray-50 p-4 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition text-lg" />
                    </div>
                  )}
                </>
              )}

              {/* PRZYCISK ZATWIERDZAJĄCY */}
              <button type="submit" disabled={loading} className="w-full bg-black text-white p-4 rounded-xl hover:bg-gray-800 font-black text-lg disabled:bg-gray-400 transition shadow-md mt-2">
                {loading ? 'Przetwarzanie...' : view === 'register' ? 'Zarejestruj się' : view === 'login' ? 'Zaloguj się' : 'Wyślij instrukcje'}
              </button>
            </form>

            {/* DYNAMICZNA STOPKA (Przełączanie widoków bez linków Next.js) */}
            <p className="text-center mt-8 text-sm text-gray-500 font-medium">
              {view === 'login' ? (
                <>Nie masz jeszcze konta? <button onClick={() => switchView('register')} className="text-green-600 font-bold hover:underline">Zarejestruj się</button></>
              ) : (
                <>Masz już konto? <button onClick={() => switchView('login')} className="text-green-600 font-bold hover:underline">Zaloguj się tutaj</button></>
              )}
            </p>
          </div>
        )}
        
      </div>
    </main>
  );
}