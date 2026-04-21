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
      .maybeSingle();

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

    // 🕵️‍♂️ BRAMKARZ 3: Zwykłe błędy (np. hasło za krótkie, zły format maila)
    if (error) {
      const isEmailTaken = error.message.toLowerCase().includes('already registered') || 
                           error.message.toLowerCase().includes('user already exists');

      if (isEmailTaken) {
        setErrorMsg('email_taken'); 
      } else {
        setErrorMsg(error.message); 
      }
      setLoading(false);
      return;
    }

    // 🕵️‍♂️ BRAMKARZ 4: TAJNY HACK SUPABASE
    // Jeśli Supabase udaje sukces (brak błędu), ale nie tworzy nowej tożsamości (identities = 0),
    // to na 100% oznacza, że ten mail jest już zajęty w bazie.
   if (data?.user && data.user.identities && data.user.identities.length === 0) {
      
      // 1. Dyskretnie wysyłamy sygnał do naszego nowego API, żeby poszedł ładny mail
      await fetch('/api/auth-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email })
      });

      // 2. POKAZUJEMY FAKE SUKCES (Użytkownik myśli, że wszystko poszło gładko)
      setSuccessMsg(`Wysłaliśmy wiadomość na adres ${email}. Sprawdź skrzynkę i folder Spam!`);
      setView('success');
      setLoading(false);
      return;
    }

    // Jeśli przeszliśmy wszystko – faktyczny, prawdziwy sukces!
    setSuccessMsg(`Wysłaliśmy link aktywacyjny na adres ${email}. Sprawdź folder Spam!`);
    setView('success');
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
            <div className="mb-6">
                {errorMsg === 'email_taken' ? (
                  // SPECJALNY BLOK DLA ZAJĘTEGO MAILA
                  <div className="bg-orange-50 border border-orange-200 p-5 rounded-2xl animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">🚨</span>
                      <h3 className="font-black text-orange-800">Ten e-mail jest już zajęty!</h3>
                    </div>
                    <p className="text-orange-700 text-sm mb-4 font-medium">
                      Wygląda na to, że masz już u nas konto. Nie musisz się rejestrować ponownie.
                    </p>
                    <button 
                      type="button"
                      onClick={() => {
                        setErrorMsg(''); // Czyścimy błąd
                        setView('forgot'); // Przełączamy na widok odzyskiwania
                      }} 
                      className="w-full bg-orange-600 text-white p-3 rounded-xl font-bold hover:bg-orange-700 transition shadow-sm"
                    >
                      Odzyskaj hasło do tego konta
                    </button>
                  </div>
                ) : errorMsg ? (
                  // STANDARDOWY CZERWONY BŁĄD
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold text-sm text-center border border-red-100 animate-in fade-in">
                    {errorMsg}
                  </div>
                ) : null}
              </div>

            <form onSubmit={view === 'register' ? handleSignUp : view === 'login' ? handleLogin : handleResetPassword} className="space-y-5">
              
              {/* NICK (Tylko Rejestracja) */}
              {view === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Twój Nick</label>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full border bg-gray-50 p-4 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition text-lg" autoComplete="username" />
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