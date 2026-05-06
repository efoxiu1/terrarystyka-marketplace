'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';
import SearchBar from './SearchBar';

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false); 
  const [unreadCount, setUnreadCount] = useState(0);

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

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) setIsScrolled(true);
      else setIsScrolled(false);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

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

    fetchUnreadCount();

    const channel = supabase
      .channel('navbar_unread_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` },
        () => fetchUnreadCount()
      ).subscribe();

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
    <nav className={`sticky top-0 z-[100] transition-all duration-300 w-full ${
      isScrolled ? 'bg-green-600/95 backdrop-blur-md shadow-md py-2' : 'bg-green-600 py-3'
    }`}>
      
      {/* KONTENER (dodane relative overflow-visible dla dropdownów) */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex justify-between items-center gap-4 relative">
        
        {/* LOGO */}
        <Link href="/" className="text-2xl font-black text-white shrink-0 tracking-tight">
          EXOsphere
        </Link>

        {/* WYSZUKIWARKA DESKTOP */}
        <div className="hidden lg:block flex-1 max-w-2xl mx-4 xl:mx-10">
          <SearchBar />
        </div>

        {/* MENU KOMPUTEROWE (DESKTOP) */}
        <div className="hidden lg:flex items-center gap-4 xl:gap-6 text-white font-medium shrink-0">
          {user ? (
            <>
              <Link href="/dodaj-ogloszenie" className="hover:text-green-200 transition font-bold">+ Dodaj ogłoszenie</Link>
              <Link href="/wiadomosci" className="relative hover:text-green-200 transition font-bold flex items-center">
                Wiadomości
                {unreadCount > 0 && (
                  <span className="absolute -top-3 -right-4 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border border-white shadow-sm animate-bounce">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
              <Link href="/obserwowane" className="relative p-2 text-white hover:text-red-400 transition-colors duration-300 flex items-center justify-center group" title="Obserwowane ogłoszenia">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 group-hover:scale-110 transition-transform duration-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </Link>
              <Link href="/moje-konto" className="hover:text-green-200 transition font-bold">Moje Konto</Link>
              <button onClick={handleLogout} className="bg-green-800 hover:bg-green-900 px-4 py-2 rounded-xl transition shadow-sm font-bold">Wyloguj</button>
            </>
          ) : (
            <Link href="/rejestracja" className="hover:text-green-200 transition font-bold">Zaloguj się</Link>
          )}
        </div>

        {/* IKONY DLA TELEFONÓW (MOBILE) */}
        <div className="flex items-center gap-3 lg:hidden">
          {/* Otwarcie nakładki wyszukiwarki */}
          <button onClick={() => { setIsMobileSearchOpen(true); setIsMenuOpen(false); }} className="text-white p-1">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </button>
          
          {/* Hamburger Menu */}
          <button onClick={() => { setIsMenuOpen(!isMenuOpen); setIsMobileSearchOpen(false); }} className="text-white p-1 focus:outline-none">
            <svg className="w-8 h-8 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 🔥 CIENIUTKA NAKŁADKA WYSZUKIWANIA W PASKU (MOBILE) 🔥 */}
        {/* ========================================================================= */}
        {isMobileSearchOpen && (
          <div className="lg:hidden absolute inset-0 bg-green-600 z-[120] flex items-center px-2 sm:px-4 gap-2 animate-in fade-in duration-200">
            {/* Przycisk Cofnij */}
            <button 
              onClick={() => setIsMobileSearchOpen(false)} 
              className="text-white p-1.5 bg-green-700/50 hover:bg-green-800 rounded-lg transition shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
            </button>
            
            {/* Same pole wyszukiwania */}
            <div className="flex-1 w-full">
              <SearchBar />
            </div>
          </div>
        )}
      </div>

      {/* MENU DLA TELEFONÓW */}
      <div className={`lg:hidden absolute top-full left-0 w-full bg-green-700 shadow-2xl border-t border-green-500/50 transition-all duration-300 flex flex-col ${
        isMenuOpen ? 'max-h-[1000px] opacity-100 visible' : 'max-h-0 opacity-0 invisible overflow-hidden'
      }`}>
        {user ? (
          <div className="flex flex-col p-4 gap-2 text-white font-bold text-center">
            <Link href="/dodaj-ogloszenie" onClick={() => setIsMenuOpen(false)} className="hover:text-green-200 p-3">+ Dodaj ogłoszenie</Link>
            <div className="flex justify-center">
              <Link href="/wiadomosci" onClick={() => setIsMenuOpen(false)} className="relative inline-flex items-center gap-2 hover:text-green-200 p-3 transition">
                <span>✉️ Wiadomości</span>
                {unreadCount > 0 && <span className="absolute top-1 -right-4 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-bounce">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </Link>
            </div>
            <Link href="/obserwowane" onClick={() => setIsMenuOpen(false)} className="flex items-center justify-center gap-2 hover:text-green-200 p-3 transition">
              <span className="text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
              </span>
              Obserwowane
            </Link>
            <Link href="/moje-konto" onClick={() => setIsMenuOpen(false)} className="hover:text-green-200 p-3 border-t border-green-600/50 mt-2">Moje Konto</Link>
            <button onClick={handleLogout} className="bg-green-800 hover:bg-green-900 p-3 rounded-xl mt-2 transition">Wyloguj</button>
          </div>
        ) : (
          <div className="flex flex-col p-4 gap-4 text-white font-bold text-center">
            <Link href="/rejestracja" onClick={() => setIsMenuOpen(false)} className="hover:text-green-200 p-2">Zaloguj się</Link>
            <Link href="/rejestracja" onClick={() => setIsMenuOpen(false)} className="bg-white text-green-700 p-3 rounded-xl mt-2">Załóż konto</Link>
          </div>
        )}
      </div>
    </nav>
  );
}