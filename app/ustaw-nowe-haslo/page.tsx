'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function NewPasswordPage() {
  const router = useRouter();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Walidacja: czy hasła są takie same?
    if (password !== confirmPassword) {
      setErrorMsg('Hasła nie są identyczne.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Hasło musi mieć co najmniej 6 znaków.');
      setLoading(false);
      return;
    }

    // Wykorzystujemy funkcję updateUser, która aktualizuje dane aktualnie zalogowanego sesją użytkownika
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setIsSuccess(true);
      // Po 3 sekundach przekieruj do strony głównej
      setTimeout(() => {
        router.push('/');
      }, 3000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl">
        
        {isSuccess ? (
          <div className="text-center animate-in zoom-in-95">
            <div className="text-6xl mb-4">🔑</div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">Hasło zmienione!</h2>
            <p className="text-gray-500 font-medium">
              Twoje hasło zostało zaktualizowane. Za chwilę zostaniesz przeniesiony na stronę główną...
            </p>
          </div>
        ) : (
          <div>
            <h2 className="text-2xl font-black mb-2">Ustaw nowe hasło</h2>
            <p className="text-gray-500 text-sm mb-6 font-medium">
              Wprowadź nowe, bezpieczne hasło dla swojego konta.
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm font-bold rounded-xl border border-red-100">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nowe hasło</label>
                <input 
                  required 
                  type="password" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full border bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Powtórz nowe hasło</label>
                <input 
                  required 
                  type="password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  className="w-full border bg-gray-50 p-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                  autoComplete="new-password"
                />
              </div>

              <button 
                disabled={loading} 
                type="submit" 
                className="w-full bg-green-500 hover:bg-green-600 text-black font-black p-4 rounded-xl transition disabled:opacity-50 mt-4 shadow-lg shadow-green-200"
              >
                {loading ? 'Aktualizacja...' : 'Zapisz nowe hasło'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}