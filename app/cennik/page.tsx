'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function Cennik() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loadingPackage, setLoadingPackage] = useState<string | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // --- NOWE STANY DLA PAKIETÓW ---
  const [activePackages, setActivePackages] = useState<any[]>([]);
  const [limitStats, setLimitStats] = useState({ current: 0, max: 2 });
  
  const [isSubscriptionMode, setIsSubscriptionMode] = useState(true);

  const BASE_LIMIT = 2; // Darmowe miejsca

  useEffect(() => {
    const initPage = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);

        // 1. Pobieramy AKTYWNE pakiety użytkownika (żeby zbudować tabelę i zsumować limit)
        const now = new Date().toISOString();
        const { data: packages } = await supabase
          .from('purchased_packages')
          .select('*')
          .eq('user_id', currentUser.id)
          .gt('expires_at', now)
          .order('expires_at', { ascending: true });

        let extraSlots = 0;
        if (packages) {
          setActivePackages(packages);
          extraSlots = packages.reduce((sum, pkg) => sum + pkg.slots_added, 0);
        }

        // 2. Sprawdzamy obecne zużycie (aktywne ogłoszenia)
        const { count } = await supabase
          .from('listings')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', currentUser.id)
          .eq('status', 'active');

        setLimitStats({ 
          current: count || 0, 
          max: BASE_LIMIT + extraSlots 
        });
      }

      // 3. Pobieramy plany cenowe
      const { data: plansData } = await supabase.from('pricing_plans').select('*').order('price_pln');
      if (plansData) setPlans(plansData);
      
      setIsLoading(false);
    };

    initPage();
  }, []);

  // Funkcja obliczająca ile dni zostało dla konkretnego pakietu
  const getDaysLeft = (dateString: string) => {
    const expires = new Date(dateString);
    const today = new Date();
    const diffTime = expires.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // 🔥 UNIWERSALNA FUNKCJA ZAKUPU (HotPay)
//   BEZPIECZNA FUNKCJA ZAKUPU (Wysyła tylko ID pakietu)
  const handlePurchase = async (planType: string, updateType: 'add' | 'replace') => {
    setLoadingPackage(planType);
    
    try {
        if (!user) {
            alert("Musisz być zalogowany, aby kupić pakiet!");
            router.push('/rejestracja');
            return;
        }

        // Uderzamy do naszego API, które samo wszystko wyliczy
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: user.id, 
                packageId: planType, 
                updateType: updateType 
            }) 
        });
        
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        // Bezpieczne przekierowanie do HotPay
        window.location.href = data.url;

    } catch (err: any) {
        alert("Wystąpił błąd podczas generowania płatności: " + err.message);
        setLoadingPackage(null);
    }
  };

  if (isLoading) return <div className="text-center mt-20 font-bold text-gray-500 animate-pulse">Wczytywanie cennika...</div>;

  const singlePlan = plans.find(p => p.id === 'single');
  const mainPlans = plans.filter(p => p.id !== 'single');

  // Używamy dynamicznego limitu max do sprawdzania, czy ktoś powinien zrobić "Upgrade"
  const ownedPlans = mainPlans.filter(p => p.listing_limit <= limitStats.max);
  const maxOwnedValue = ownedPlans.reduce((max, p) => Math.max(max, p.price_pln), 0);

  return (
    <main className="max-w-6xl mx-auto p-6 mt-10 mb-20 text-center animate-in fade-in">
      
      {/* --- PANEL OBECNEGO ZUŻYCIA I AKTYWNYCH PAKIETÓW --- */}
      {user && (
        <div className="text-left mb-16">
          <section className="mb-8 bg-gray-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 text-9xl opacity-5">📦</div>
            <h2 className="text-2xl font-black mb-6 relative z-10">Pojemność Twojego Konta</h2>
            <div className="bg-white/10 p-6 rounded-2xl border border-white/20 w-full md:w-1/2 backdrop-blur-sm flex justify-between items-center relative z-10">
              <div>
                <p className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-2">Limit ogłoszeń</p>
                <div className="flex items-end gap-2">
                  <span className={`text-5xl font-black ${limitStats.current >= limitStats.max ? 'text-red-400' : 'text-white'}`}>
                    {limitStats.current}
                  </span>
                  <span className="text-xl font-bold text-gray-500 mb-1">/ {limitStats.max}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-300">Darmowa Baza: <strong className="text-white">{BASE_LIMIT}</strong></p>
                <p className="text-sm text-gray-300">Z pakietów: <strong className="text-amber-400">+{limitStats.max - BASE_LIMIT}</strong></p>
              </div>
            </div>
          </section>

          {/* TABELA PAKIETÓW */}
          <section className="bg-white p-8 rounded-3xl border shadow-sm text-left">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2"><span>⏱️</span> Twoje Aktywne Pakiety</h2>
            {activePackages.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-2xl border border-dashed">
                <p className="text-gray-500 text-sm font-medium">Korzystasz tylko z darmowego pakietu (2 miejsca).</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nazwa Pakietu</th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Dodatkowe Miejsca</th>
                      <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Wygasa za</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activePackages.map((pkg) => {
                      const daysLeft = getDaysLeft(pkg.expires_at);
                      return (
                        <tr key={pkg.id} className="hover:bg-gray-50 transition">
                          <td className="p-4 font-bold text-gray-900">{pkg.package_name}</td>
                          <td className="p-4 text-center">
                            <span className="bg-gray-900 text-white font-black text-xs px-3 py-1 rounded-full">+{pkg.slots_added}</span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`font-black text-sm ${daysLeft <= 3 ? 'text-orange-600' : 'text-gray-900'}`}>
                              {daysLeft} {daysLeft === 1 ? 'dzień' : 'dni'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* --- GŁÓWNY CENNIK --- */}
      <h1 className="text-4xl font-black text-gray-900 mb-4">Wybierz Pakiet Hodowcy</h1>
      <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
        Rozwiń swoją hodowlę. Wybierz limit, który najlepiej do Ciebie pasuje, lub dokup pojedyncze miejsce.
      </p>

      {/* --- PRZEŁĄCZNIK SUBSKRYPCJI --- */}
      <div className="flex items-center justify-center gap-4 mb-12">
        <span className={`font-bold transition-colors ${!isSubscriptionMode ? 'text-gray-900' : 'text-gray-400'}`}>
          Płatność jednorazowa
        </span>
        
        <button 
          onClick={() => setIsSubscriptionMode(!isSubscriptionMode)}
          className={`w-16 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ${isSubscriptionMode ? 'bg-amber-500' : 'bg-gray-300'}`}
        >
          <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${isSubscriptionMode ? 'translate-x-8' : 'translate-x-0'}`} />
        </button>

        <span className={`font-bold flex items-center gap-2 transition-colors ${isSubscriptionMode ? 'text-gray-900' : 'text-gray-400'}`}>
          Odnawialna Subskrypcja
          <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
            Wygoda
          </span>
        </span>
      </div>

      {/* SEKCJA 1: POJEDYNCZE OGŁOSZENIE */}
      {singlePlan && (
        <div className="max-w-md mx-auto mb-16 bg-gray-900 text-white rounded-3xl p-6 border-4 border-gray-800 shadow-xl flex items-center justify-between gap-4 relative overflow-hidden">
          <div className="text-left relative z-10">
            <h2 className="text-xl font-bold mb-1">{singlePlan.name}</h2>
            <p className="text-sm text-gray-400">Dodaje +1 miejsce do limitu ({limitStats.max} ➔ {limitStats.max + 1})</p>
          </div>
          <div className="text-right shrink-0 relative z-10">
            <div className="text-2xl font-black mb-2">{singlePlan.price_pln / 100} zł</div>
            <button 
                  onClick={() => handlePurchase('single', 'add')}
                  disabled={loadingPackage !== null}
                  className="bg-white text-black text-sm font-black py-2 px-6 rounded-xl hover:bg-gray-200 transition disabled:opacity-50"
                >
              {loadingPackage === 'single' ? 'Ładowanie...' : 'Kup sztukę'}
            </button>
          </div>
          <div className="absolute -bottom-2 -left-2 text-6xl opacity-5">1️⃣</div>
        </div>
      )}

      {/* SEKCJA 2: PAKIETY GŁÓWNE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {mainPlans.map((plan) => {
          const isOwnedOrLower = plan.listing_limit <= limitStats.max; 
          const upgradeDifference = plan.price_pln - maxOwnedValue;
          const isUpgrade = !isOwnedOrLower && maxOwnedValue > 0 && upgradeDifference >= 200;
          
          const displayPrice = isUpgrade ? upgradeDifference / 100 : plan.price_pln / 100;

          return (
            <div key={plan.id} className={`rounded-3xl p-8 border-2 flex flex-col transition-all relative text-left
              ${isOwnedOrLower 
                ? 'bg-gray-50 border-gray-200 opacity-60 grayscale' 
                : 'bg-white border-amber-400 hover:shadow-2xl shadow-lg'
              }
            `}>
              {isUpgrade && !isOwnedOrLower && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white font-black px-4 py-1 rounded-full text-xs uppercase tracking-widest shadow-md whitespace-nowrap">
                  Dopłać różnicę!
                </div>
              )}

              <h2 className="text-2xl font-bold text-gray-800 mb-2">{plan.name}</h2>
              
              <div className="mb-6 flex flex-col items-center justify-center h-16">
                {isUpgrade ? (
                  <div>
                    <span className="line-through text-gray-400 text-lg mr-2">{plan.price_pln / 100} zł</span>
                    <span className="text-4xl font-black text-green-600">{displayPrice.toFixed(2)} <span className="text-lg font-medium">zł</span></span>
                  </div>
                ) : (
                  <span className="text-4xl font-black text-gray-900">
                    {displayPrice.toFixed(2)} <span className="text-lg text-gray-500 font-medium">zł {isSubscriptionMode ? '/ msc' : ''}</span>
                  </span>
                )}
              </div>

              <ul className="text-left space-y-4 mb-8 flex-1 font-medium text-gray-600">
                <li className="flex gap-2"><span>✅</span> Do {plan.listing_limit} aktywnych ogłoszeń</li>
                <li className="flex gap-2"><span>✅</span> Odznaka zweryfikowanego sprzedawcy </li>
                <li className="flex gap-2">
                  <span>{isSubscriptionMode ? '🔄' : '⏱️'}</span> 
                  {isSubscriptionMode ? 'Automatyczne odnawianie co 30 dni' : 'Ważne przez 30 dni'}
                </li>
              </ul>
              
              <button 
                  onClick={() => handlePurchase(plan.id, 'replace')}
                  disabled={loadingPackage !== null || isOwnedOrLower}
                  className={`w-full font-black py-4 rounded-xl transition text-center ${
                    isOwnedOrLower 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : isUpgrade 
                        ? 'bg-green-500 text-white hover:bg-green-600 shadow-lg' 
                        : 'bg-amber-500 text-black hover:bg-amber-600 shadow-lg'
                  }`}
                >
                {isOwnedOrLower ? 'Twój pakiet (lub niższy)' : (loadingPackage === plan.id ? 'Przekierowanie...' : (isUpgrade ? 'Dopłać i Zwiększ' : 'Wybierz Pakiet'))}
              </button>
            </div>
          );
        })}
      </div>
    </main>
  );
}