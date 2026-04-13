'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Sprawdzanie logowania
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // Nasłuchiwanie scrollowania
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) setIsScrolled(true);
      else setIsScrolled(false);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // NOWOŚĆ: Pobieranie powiadomień ZALEŻNE OD ZALOGOWANEGO UŻYTKOWNIKA
  
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    // Funkcja licząca (zostaje bez zmian)
    const fetchUnreadCount = async () => {
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (!error) {
        setUnreadCount(count || 0);
      }
    };

    // 1. Pierwsze pobranie licznika przy wejściu na stronę
    fetchUnreadCount();

    // 2. Odpalamy antenę czasu rzeczywistego!
    const channel = supabase
      .channel('navbar_unread_updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Gwiazdka oznacza: reaguj na nowe wiadomości (INSERT) ORAZ odczytania (UPDATE)
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}` // Nasłuchuj tylko wtedy, gdy ktoś pisze DO NAS
        },
        () => {
          // Gdy coś w bazie drgnie, każ Navbarowi natychmiast przeliczyć bąbelek
          fetchUnreadCount();
        }
      )
      .subscribe();

    // 3. Sprzątanie: wyłączamy antenę, gdy użytkownik się wyloguje
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    setIsMenuOpen(false);
  };

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 w-full ${
      isScrolled ? 'bg-green-600/90 backdrop-blur-md shadow-md py-2' : 'bg-green-600 py-4'
    }`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex justify-between items-center">
        
        {/* LOGO */}
        <Link href="/" className="text-2xl font-black text-white shrink-0 tracking-tight">
          GiełdaMVP
        </Link>

        {/* --- MENU KOMPUTEROWE --- */}
        <div className="hidden md:flex items-center gap-6 text-white font-medium">
          {user ? (
            <>
              <Link href="/dodaj-ogloszenie" className="hover:text-green-200 transition font-bold">+ Dodaj ogłoszenie</Link>
              
              {/* NAPRAWIONE: Wiadomości z bąbelkiem dla komputerów */}
              <Link href="/wiadomosci" className="relative hover:text-green-200 transition font-bold flex items-center">
                Wiadomości
                {unreadCount > 0 && (
                  <span className="absolute -top-3 -right-4 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border border-white shadow-sm animate-bounce">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
              
              <Link href="/moje-konto" className="hover:text-green-200 transition">Moje Konto</Link>
              <button onClick={handleLogout} className="bg-green-800 hover:bg-green-900 px-4 py-2 rounded-lg transition shadow-sm font-bold">
                Wyloguj
              </button>
            </>
          ) : (
            <>
              <Link href="/logowanie" className="hover:text-green-200 transition font-bold">Zaloguj się</Link>
              <Link href="/rejestracja" className="bg-white text-green-700 px-4 py-2 rounded-lg font-bold hover:bg-gray-100 transition shadow-sm">
                Załóż konto
              </Link>
            </>
          )}
        </div>

        {/* PRZYCISK HAMBURGERA (Mobile) */}
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-white p-2 focus:outline-none">
          <svg className="w-8 h-8 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* --- MENU DLA TELEFONÓW --- */}
      <div className={`md:hidden absolute top-full left-0 w-full bg-green-700 shadow-xl border-t border-green-500/50 transition-all duration-300 overflow-hidden flex flex-col ${
        isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
      }`}>
        {user ? (
          <div className="flex flex-col p-4 gap-4 text-white font-bold text-center">
            <Link href="/dodaj-ogloszenie" onClick={() => setIsMenuOpen(false)} className="hover:text-green-200 p-2">+ Dodaj ogłoszenie</Link>
            
            {/* NAPRAWIONE: Czyste style zintegrowane z mobilnym menu */}
            <div className="flex justify-center">
              <Link href="/wiadomosci" onClick={() => setIsMenuOpen(false)} className="relative inline-flex items-center gap-2 hover:text-green-200 p-2 transition">
                <span>✉️ Wiadomości</span>
                {unreadCount > 0 && (
                  <span className="absolute top-0 -right-4 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-bounce">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            </div>

            <Link href="/moje-konto" onClick={() => setIsMenuOpen(false)} className="hover:text-green-200 p-2 border-t border-green-600">Moje Konto</Link>
            <button onClick={handleLogout} className="bg-green-800 hover:bg-green-900 p-3 rounded-lg mt-2 transition">Wyloguj</button>
          </div>
        ) : (
          <div className="flex flex-col p-4 gap-4 text-white font-bold text-center">
            <Link href="/logowanie" onClick={() => setIsMenuOpen(false)} className="hover:text-green-200 p-2">Zaloguj się</Link>
            <Link href="/rejestracja" onClick={() => setIsMenuOpen(false)} className="bg-white text-green-700 p-3 rounded-lg mt-2">Załóż konto</Link>
          </div>
        )}
      </div>
    </nav>
  );
}