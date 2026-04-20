'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Rejestracja() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 1. NASZA TARCZA OBRONNA (Walidacja)
    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne. Spróbuj ponownie!');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.');
      setLoading(false);
      return;
    }
    if (!termsAccepted) {
      setError('Musisz zaakceptować regulamin, aby założyć konto.');
      setLoading(false);
      return;
    }
    if (phone.length < 9) {
      setError('Podaj poprawny numer telefonu.');
      setLoading(false);
      return;
    }

    // 2. Właściwa rejestracja w Supabase
    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError('Błąd rejestracji: ' + authError.message);
      setLoading(false);
      return;
    }

    // 3. Zapisujemy numer telefonu do profilu użytkownika
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ phone: phone })
        .eq('id', data.user.id);
        
      // Sukces! Przekierowujemy do uzupełnienia profilu lub na stronę główną
      router.push('/moje-konto');
    }
  };

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border w-full max-w-md">
        <h1 className="text-3xl font-black text-gray-900 mb-2 text-center">Dołącz do nas</h1>
        <p className="text-gray-500 text-center mb-8 font-medium">Załóż konto, aby sprzedawać i kupować</p>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-bold text-sm text-center border border-red-100">{error}</div>}

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Adres E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Numer telefonu</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+48 000 000 000" className="w-full border bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hasło</label>
            <input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full border bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Powtórz Hasło</label>
            
            <input type="password"  autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full border bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition" />
          </div>

          <div className="flex items-start gap-3 mt-4 bg-gray-50 p-4 rounded-xl border">
            <input type="checkbox" id="terms" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="mt-1 w-4 h-4 text-green-600 rounded cursor-pointer" />
            <label htmlFor="terms" className="text-xs text-gray-600 font-medium cursor-pointer">
              Akceptuję <Link href="#" className="text-green-600 underline">Regulamin</Link> serwisu oraz <Link href="#" className="text-green-600 underline">Politykę Prywatności</Link> (RODO).
            </label>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-green-600 text-white p-4 rounded-xl hover:bg-green-700 font-black text-lg disabled:bg-gray-400 transition shadow-md mt-4">
            {loading ? 'Tworzenie konta...' : 'Zarejestruj się'}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-gray-500 font-medium">
          Masz już konto? <Link href="/logowanie" className="text-green-600 font-bold hover:underline">Zaloguj się</Link>
        </p>
      </div>
    </main>
  );
}