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
  // --- 4. LOGOWANIE OAUTH (Google / Facebook) ---
  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    setLoading(true);
    setErrorMsg('');
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        // ZMIANA TUTAJ: Zamiast na stronę główną ('/'), 
        // odsyłamy do komponentu klienckiego, który na pewno zapisze sesję!
        redirectTo: `${window.location.origin}/moje-konto`,
        
        // BONUS: Dodajemy parametry, żeby Google zapamiętało wybór i nie pytało w kółko
        queryParams: {
          prompt: 'select_account',
        }
      }
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
    }
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
              {view !== 'forgot' && (
                <div className="relative flex items-center py-2 mt-4">
                  <div className="flex-grow border-t border-gray-200"></div>
                  <span className="shrink-0 px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Lub kontynuuj przez</span>
                  <div className="flex-grow border-t border-gray-200"></div>
                </div>
              )}

              {/* PRZYCISKI OAUTH */}
              {view !== 'forgot' && (
                <div className="flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => handleOAuthLogin('google')}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-gray-200 p-3 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition font-bold text-gray-700 shadow-sm"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Google
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleOAuthLogin('facebook')}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#1877F2] border-2 border-[#1877F2] p-3 rounded-xl hover:bg-[#166FE5] transition font-bold text-white shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    Facebook
                  </button>
                </div>
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