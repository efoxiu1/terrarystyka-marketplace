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
  const [currentLimit, setCurrentLimit] = useState<number>(2); 

  const [isSubscriptionMode, setIsSubscriptionMode] = useState(true);

  useEffect(() => {
    const initPage = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        setUser(currentUser);
        const { data: profile } = await supabase.from('profiles').select('max_active_listings').eq('id', currentUser.id).single();
        if (profile) setCurrentLimit(profile.max_active_listings ?? 2);
      }

      const { data: plansData } = await supabase.from('pricing_plans').select('*').order('price_pln');
      if (plansData) setPlans(plansData);
      setIsLoading(false);
    };

    initPage();
  }, []);

  // 🔥 UNIWERSALNA FUNKCJA ZAKUPU (Obsługuje pojedyncze sztuki ORAZ pakiety)
  const handlePurchase = async (planType: string, calculatedPrice: number, limitToAddOrReplace: number, updateType: 'add' | 'replace') => {
    setLoadingPackage(planType);
    
    try {
        if (!user) {
            alert("Musisz być zalogowany, aby kupić pakiet!");
            return router.push('/login');
        }

        // 1. Zapisujemy prawdziwy, bezpieczny szkic w bazie (Z prawdziwym UUID!)
        const { data: order, error: orderError } = await supabase.from('orders').insert([{
            user_id: user.id,
            total_amount: calculatedPrice, 
            status: 'pending_payment',
            payment_provider: 'hotpay',
            new_limit: limitToAddOrReplace,
            update_type: updateType, // 'add' dla pojedynczych, 'replace' dla głównych pakietów
            package_id: planType
        }]).select().single();

        if (orderError) throw orderError;

        // 2. Wysyłamy legalny order.id (UUID) do naszego generatora linków HotPay
        const paymentRes = await fetch('/api/payments/hotpay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id, amount: calculatedPrice }) 
        });
        
        const paymentData = await paymentRes.json();
        
        if (paymentData.error) throw new Error(paymentData.error);

        // 3. Wyrzucamy klienta do banku
        window.location.href = paymentData.url;

    } catch (err: any) {
        alert("Wystąpił błąd podczas generowania płatności: " + err.message);
        setLoadingPackage(null);
    }
  };

  if (isLoading) return <div className="text-center mt-20 font-bold text-gray-500 animate-pulse">Wczytywanie cennika...</div>;

  const singlePlan = plans.find(p => p.id === 'single');
  const mainPlans = plans.filter(p => p.id !== 'single');

  const ownedPlans = mainPlans.filter(p => p.listing_limit <= currentLimit);
  const maxOwnedValue = ownedPlans.reduce((max, p) => Math.max(max, p.price_pln), 0);

  return (
    <main className="max-w-6xl mx-auto p-6 mt-10 mb-20 text-center animate-in fade-in">
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
            <p className="text-sm text-gray-400">Dodaje +1 miejsce do limitu ({currentLimit} ➔ {currentLimit + 1})</p>
          </div>
          <div className="text-right shrink-0 relative z-10">
            <div className="text-2xl font-black mb-2">{singlePlan.price_pln / 100} zł</div>
            <button 
              // Obliczamy parametry dla pojedynczego ogłoszenia (typ 'add')
              onClick={() => handlePurchase('single', singlePlan.price_pln / 100, 1, 'add')}
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
          const isOwnedOrLower = plan.listing_limit <= currentLimit; 
          const upgradeDifference = plan.price_pln - maxOwnedValue;
          const isUpgrade = !isOwnedOrLower && maxOwnedValue > 0 && upgradeDifference >= 200;
          
          // Cena do wyświetlenia i zapłacenia w PLN
          const displayPrice = isUpgrade ? upgradeDifference / 100 : plan.price_pln / 100;

          return (
            <div key={plan.id} className={`rounded-3xl p-8 border-2 flex flex-col transition-all relative
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
                <li className="flex gap-2"><span>✅</span> Standardowe pozycjonowanie</li>
                <li className="flex gap-2">
                  <span>{isSubscriptionMode ? '🔄' : '⏱️'}</span> 
                  {isSubscriptionMode ? 'Automatyczne odnawianie' : 'Ważne przez 30 dni'}
                </li>
              </ul>
              
              <button 
                // Uruchamiamy uniwersalną funkcję, przekazując cenę po zniżkach i typ 'replace'
                onClick={() => handlePurchase(plan.id, displayPrice, plan.listing_limit, 'replace')}
                disabled={loadingPackage !== null || isOwnedOrLower}
                className={`w-full font-black py-4 rounded-xl transition ${
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