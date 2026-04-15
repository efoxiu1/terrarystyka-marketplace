'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export default function Koszyk() {
  const [proGroups, setProGroups] = useState<any>({});
  const [amateurGroups, setAmateurGroups] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const fetchCart = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);

    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        id, quantity, variant_id,
        listing:listings(id, title, image_url, price, seller:profiles!fk_seller_profile(id, username, is_verified_seller)),
        variant:listing_variants(id, name, price, stock)
      `)
      .eq('user_id', user.id);

    if (data) {
      // Dzielimy koszyk na dwie grupy: PRO (P24) i Amatorzy (Trustap)
      const pro: any = {};
      const amateur: any = {};

      data.forEach((item: any) => {
        const sellerId = item.listing.seller.id;
        const isPro = item.listing.seller.is_verified_seller;
        
        const targetGroup = isPro ? pro : amateur;

        if (!targetGroup[sellerId]) {
          targetGroup[sellerId] = {
            sellerInfo: item.listing.seller,
            items: []
          };
        }
        targetGroup[sellerId].items.push(item);
      });

      setProGroups(pro);
      setAmateurGroups(amateur);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const handleRemove = async (cartItemId: string) => {
    await supabase.from('cart_items').delete().eq('id', cartItemId);
    fetchCart(); 
  };

  if (loading) return <div className="p-20 text-center font-bold text-gray-500">Ładowanie koszyka...</div>;

  const proSellerIds = Object.keys(proGroups);
  const amateurSellerIds = Object.keys(amateurGroups);
  const isEmpty = proSellerIds.length === 0 && amateurSellerIds.length === 0;

  // Obliczanie łącznej wartości produktów PRO do wspólnej płatności
  let totalProPrice = 0;
  proSellerIds.forEach(sellerId => {
    proGroups[sellerId].items.forEach((item: any) => {
      const price = item.variant ? item.variant.price : item.listing.price;
      totalProPrice += price * item.quantity;
    });
  });

  return (
    <main className="max-w-4xl mx-auto p-6 mt-10 mb-20">
      <h1 className="text-4xl font-black mb-8 text-gray-900 flex items-center gap-4">
        <span>🛒</span> Twój Koszyk
      </h1>

      {isEmpty ? (
        <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-3xl p-20 text-center">
          <p className="text-xl font-bold text-gray-400 mb-4">Twój koszyk jest pusty jak terrarium przed wypłatą.</p>
          <Link href="/" className="bg-black text-white font-black px-6 py-3 rounded-xl">Wróć do sklepu</Link>
        </div>
      ) : (
        <div className="space-y-12">
          
          {/* SEKCJA 1: WSPÓLNA PŁATNOŚĆ (KONTA PRO - PRZELEWY24) */}
          {proSellerIds.length > 0 && (
            <div className="bg-white border-2 border-blue-100 rounded-3xl shadow-sm overflow-hidden animate-in fade-in">
              <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black flex items-center gap-2"><span>💳</span> Szybkie zakupy od Firm</h2>
                  <p className="text-blue-200 text-sm mt-1 font-bold">Opłać wszystkie poniższe paczki jedną płatnością Przelewy24</p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {proSellerIds.map(sellerId => {
                  const group = proGroups[sellerId];
                  return (
                    <div key={sellerId} className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center">
                        <span className="font-bold text-gray-700">Paczka od: <span className="text-black">{group.sellerInfo.username}</span></span>
                        <span className="text-xs bg-blue-100 text-blue-700 font-black px-2 py-1 rounded uppercase tracking-wider">Zweryfikowany</span>
                      </div>
                      <div className="p-4 space-y-4">
                        {group.items.map((item: any) => {
                          const price = item.variant ? item.variant.price : item.listing.price;
                          return (
                            <div key={item.id} className="flex gap-4 items-center">
                              {/* KLIKALNY OBRAZEK */}
                              <Link href={`/ogloszenie/${item.listing.id}`} className="w-16 h-16 bg-white rounded-xl overflow-hidden shrink-0 border hover:opacity-80 transition">
                                {item.listing.image_url && <img src={item.listing.image_url} className="w-full h-full object-cover" />}
                              </Link>
                              <div className="flex-1 min-w-0">
                                {/* KLIKALNY TYTUŁ */}
                                <Link href={`/ogloszenie/${item.listing.id}`} className="font-bold text-gray-900 truncate hover:text-blue-600 transition">
                                  {item.listing.title}
                                </Link>
                                {item.variant && <p className="text-xs font-bold text-gray-500">Wariant: {item.variant.name}</p>}
                                <p className="text-xs text-gray-400 mt-1">Ilość: {item.quantity} szt.</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-black text-blue-700">{price * item.quantity} PLN</p>
                                <button onClick={() => handleRemove(item.id)} className="text-[10px] font-black text-red-500 uppercase mt-1 hover:text-red-700">Usuń</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* GŁÓWNY PRZYCISK P24 */}
              <div className="bg-gray-50 p-6 border-t border-blue-100 flex flex-col sm:flex-row justify-between items-center gap-6">
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 font-bold mb-1">
                    <span>Koszty dostawy:</span>
                    <span className="text-blue-600 uppercase">Zostaną wyliczone w kasie</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 font-bold">Wartość produktów:</span>
                    <span className="text-3xl font-black text-gray-900">{totalProPrice.toFixed(2)} PLN</span>
                  </div>
                </div>

                <button 
                  onClick={() => alert(`Przejście do kasy P24 z paczkami na kwotę ${totalProPrice} PLN + dostawy`)}
                  className="px-8 py-4 rounded-2xl font-black text-white text-lg bg-blue-600 hover:bg-blue-700 transition shadow-lg hover:shadow-xl w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  Przejdź do dostawy i płatności ➔
                </button>
              </div>
            </div>
          )}

          {/* SEKCJA 2: PŁATNOŚCI INDYWIDUALNE (AMATORZY - TRUSTAP) */}
          {amateurSellerIds.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2 px-2">
                <span>🛡️</span> Zakupy z Ochroną Kupującego
              </h2>
              <p className="text-sm text-gray-500 font-bold px-2">Każda paczka od hobbysty posiada osobną ochronę i wymaga oddzielnej płatności.</p>

              {amateurSellerIds.map(sellerId => {
                const group = amateurGroups[sellerId];
                
                let groupTotal = 0;
                group.items.forEach((i: any) => {
                   groupTotal += (i.variant ? i.variant.price : i.listing.price) * i.quantity;
                });

                return (
                  <div key={sellerId} className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 relative">
                    <div className="bg-gray-50 p-5 border-b flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📦</span>
                        <div>
                          <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Paczka od hobbysty</p>
                          <p className="font-bold text-gray-900 text-lg">{group.sellerInfo.username}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-6">
                      {group.items.map((item: any) => {
                        const price = item.variant ? item.variant.price : item.listing.price;
                        return (
                          <div key={item.id} className="flex gap-6 items-center">
                            {/* KLIKALNY OBRAZEK */}
                            <Link href={`/ogloszenie/${item.listing.id}`} className="w-20 h-20 bg-gray-100 rounded-2xl overflow-hidden shrink-0 border hover:opacity-80 transition">
                              {item.listing.image_url && <img src={item.listing.image_url} className="w-full h-full object-cover" />}
                            </Link>
                            <div className="flex-1 min-w-0">
                               {/* KLIKALNY TYTUŁ */}
                              <Link href={`/ogloszenie/${item.listing.id}`} className="font-bold text-lg text-gray-900 truncate hover:text-green-600 transition">
                                {item.listing.title}
                              </Link>
                              {item.variant && <p className="text-sm font-bold text-gray-500">Wariant: {item.variant.name}</p>}
                              <p className="text-xs text-gray-400 mt-1">Ilość: {item.quantity} szt.</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-black text-xl text-green-600">{price * item.quantity} PLN</p>
                              <button onClick={() => handleRemove(item.id)} className="text-[10px] font-black text-red-500 uppercase mt-2 hover:text-red-700">Usuń z koszyka</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-green-50 p-6 border-t border-green-100 flex flex-col sm:flex-row justify-between items-center gap-6">
                      <div>
                        <div className="flex items-center gap-2 text-sm text-green-800 font-bold mb-1">
                          <span>Dostawa i prowizja ochrony:</span>
                          <span className="uppercase">Wyliczone w kasie</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-green-800 font-bold">Wartość produktów:</span>
                          <span className="text-3xl font-black text-green-900">{groupTotal.toFixed(2)} PLN</span>
                        </div>
                      </div>

                      <button 
                        onClick={() => alert(`Przekierowanie do kasy Trustap dla paczki od ${group.sellerInfo.username}`)}
                        className="px-8 py-4 rounded-2xl font-black text-white text-lg transition shadow-lg hover:shadow-xl w-full sm:w-auto flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600"
                      >
                        Wybierz dostawę Trustap ➔
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}
    </main>
  );
}