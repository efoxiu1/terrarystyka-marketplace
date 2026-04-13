'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Logowanie() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Nieprawidłowy e-mail lub hasło.');
      setLoading(false);
    } else {
      router.push('/');
      router.refresh(); // Odświeżamy Navbar, żeby pokazał przyciski zalogowanego
    }
  };

  return (
    <main className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border w-full max-w-md">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🦎</div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">Witaj ponownie</h1>
          <p className="text-gray-500 font-medium">Zaloguj się do swojego konta</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 font-bold text-sm text-center border border-red-100">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Adres E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border bg-gray-50 p-4 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition text-lg" />
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <label className="block text-xs font-bold text-gray-500 uppercase">Hasło</label>
              <Link href="#" className="text-xs text-green-600 font-bold hover:underline">Zapomniałeś hasła?</Link>
            </div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full border bg-gray-50 p-4 rounded-xl focus:ring-2 focus:ring-green-500 outline-none transition text-lg" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-black text-white p-4 rounded-xl hover:bg-gray-800 font-black text-lg disabled:bg-gray-400 transition shadow-md mt-2">
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-gray-500 font-medium">
          Nie masz jeszcze konta? <Link href="/rejestracja" className="text-green-600 font-bold hover:underline">Zarejestruj się</Link>
        </p>
      </div>
    </main>
  );
}