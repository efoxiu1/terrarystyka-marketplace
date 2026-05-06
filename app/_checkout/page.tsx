'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Script from 'next/script';

export default function Checkout() {
  const widgetRef = useRef<any>(null);
  const router = useRouter();
  const InpostGeowidgetTag = 'inpost-geowidget' as any;
  // NOWE STANY MULTI-VENDOR
  const [groupedPackages, setGroupedPackages] = useState<any>({});
  const [shippingOptionsPerPackage, setShippingOptionsPerPackage] = useState<any>({});
  const [selectedMethods, setSelectedMethods] = useState<any>({}); // np. { 'id-sprzedawcy-1': 'inpost', 'id-sprzedawcy-2': 'dpd' }
  
  const [shippingData, setShippingData] = useState({ name: '', street: '', city: '', zip: '', phone: '', lockerId: '' });
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedLockerIds, setSelectedLockerIds] = useState<any>({}); // { 'id-sprzedawcy-1': 'POZ01M' }
  const [isMapOpenForSeller, setIsMapOpenForSeller] = useState<string | null>(null); // Pamiętamy, dla którego sprzedawcy klient otwiera mapę

  useEffect(() => { 
    const fetchCheckoutData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/');

      const { data } = await supabase
        .from('cart_items')
        .select(`
          id,
          quantity,
          listing:listings(id, title, price, dim_length, dim_width, dim_height, weight, seller:profiles!fk_seller_profile(id, username, is_verified_seller)),
          variant:listing_variants(id, name, price, dim_length, dim_width, dim_height, weight)
        `)
        .eq('user_id', user.id);

      const proItems = data?.filter((i: any) => i.listing.seller.is_verified_seller) || [];
      
      // 1. GRUPOWANIE PO SPRZEDAWCY (Tworzymy osobne paczki)
      const groups: any = {};
      proItems.forEach((item: any) => {
        const sellerId = item.listing.seller.id;
        if (!groups[sellerId]) groups[sellerId] = { seller: item.listing.seller, items: [] };
        groups[sellerId].items.push(item);
      });
      
      setGroupedPackages(groups);

      // 2. POBIERANIE OPCJI DOSTAWY DLA KAŻDEJ PACZKI OSOBNO
      const newOptionsMap: any = {};
      const newSelectedMethods: any = {};

      for (const sellerId of Object.keys(groups)) {
        const itemsInPackage = groups[sellerId].items;
        
        // Formatujemy wymiary dla Bin-Packera (z zabezpieczeniem Array.isArray)
        const packingItems = itemsInPackage.map((item: any) => {
          const variant = Array.isArray(item.variant) ? item.variant[0] : item.variant;
          const listing = Array.isArray(item.listing) ? item.listing[0] : item.listing;
          return {
            quantity: item.quantity,
            length: variant?.dim_length || listing?.dim_length || 0,
            width: variant?.dim_width || listing?.dim_width || 0,
            height: variant?.dim_height || listing?.dim_height || 0,
            weight: variant?.weight || listing?.weight || 0
          };
        });

        // Pytamy serwer logistyczny o cenę dla tej JEDNEJ paczki
        try {
          const res = await fetch('/api/shipping/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: packingItems })
          });
          const apiData = await res.json();
          
          if (!apiData.error) {
            newOptionsMap[sellerId] = apiData;
            // Ustawiamy domyślną metodę dostawy (InPost, jeśli dostępny, jak nie to pierwsza z brzegu)
            newSelectedMethods[sellerId] = apiData.available.includes('inpost') ? 'inpost' : apiData.available[0];
          }
        } catch (err) {
          console.error("Błąd kalkulatora dla sprzedawcy " + sellerId, err);
        }
      }

      setShippingOptionsPerPackage(newOptionsMap);
      setSelectedMethods(newSelectedMethods);
      setLoading(false);
    };

    fetchCheckoutData();
  }, [router]);
  // ------------------------------------------------------------------
  // NASŁUCHIWANIE KLIKNIĘCIA W MAPĘ INPOSTU
  // ------------------------------------------------------------------
  useEffect(() => {
    const handlePointSelect = (event: any) => {
      if (event.detail && event.detail.name && isMapOpenForSeller) {
        // Zapisujemy wybrany paczkomat dla konkretnego sprzedawcy
        setSelectedLockerIds((prev: any) => ({
          ...prev,
          [isMapOpenForSeller]: event.detail.name
        }));
        
        // Zamykamy mapę
        setIsMapOpenForSeller(null);
      }
    };

    window.addEventListener('inpost.geowidget.point.select', handlePointSelect);
    return () => window.removeEventListener('inpost.geowidget.point.select', handlePointSelect);
  }, [isMapOpenForSeller]);
  // Funkcja zmieniająca metodę dostawy dla konkretnej paczki
  useEffect(() => {
    // Jeśli mapa się pojawi i mamy do niej dostęp przez ref
    if (widgetRef.current) {
      // Ustawiamy atrybuty ręcznie - to omija błąd "only a getter"
      const widget = widgetRef.current;
  widget.setAttribute('language', 'pl');
    widget.setAttribute('config', 'parcelCollect'); // To wyłącza configname=null
    widget.setAttribute('token', ''); // Pusty string zamiast null
    }
  }, [isMapOpenForSeller]); // Odpali się, gdy otworzysz modal z mapą
  const handleMethodChange = (sellerId: string, methodCode: string) => {
    setSelectedMethods({ ...selectedMethods, [sellerId]: methodCode });
  };

  // Całkowity koszt do zapłaty P24
  const calculateTotal = () => {
    let total = 0;
    Object.keys(groupedPackages).forEach(sellerId => {
      // 1. Dodaj koszt produktów w tej paczce
      groupedPackages[sellerId].items.forEach((item: any) => {
        const price = item.variant ? item.variant.price : item.listing.price;
        total += price * item.quantity;
      });
      // 2. Dodaj koszt wybranej wysyłki dla tej paczki
      const selectedMethod = selectedMethods[sellerId];
      const shippingCost = shippingOptionsPerPackage[sellerId]?.methods[selectedMethod]?.price || 0;
      total += shippingCost;
    });
    return total;
  };

 const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Musisz być zalogowany");

        // Front oblicza tylko szacunkowy koszt wysyłki (resztę załatwi serwer)
        let estimatedShippingCost = 0;
        Object.keys(groupedPackages).forEach(sellerId => {
            const selectedMethod = selectedMethods[sellerId];
            estimatedShippingCost += shippingOptionsPerPackage[sellerId]?.methods[selectedMethod]?.price || 0;
        });

        // 1. Zlecamy czarną robotę naszemu nowemu API! Front jest teraz "głupi" i bezpieczny.
        const res = await fetch('/api/orders/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: user.id,
                shippingData,
                selectedMethods,
                selectedLockerIds,
                estimatedShippingCost
            })
        });

        const data = await res.json();

        if (data.error) throw new Error(data.error);

        // 2. Przekierowanie prosto do banku
        window.location.href = data.url;

    } catch (err: any) {
        alert("Wystąpił błąd: " + err.message);
        setIsProcessing(false);
    }
};
  if (loading) return <div className="p-20 text-center">Inicjalizacja systemu Multi-Vendor Checkout...</div>;

  const sellerIds = Object.keys(groupedPackages);

  return (
    <main className="max-w-5xl mx-auto p-6 mt-10 mb-20">
      <link rel="stylesheet" href="https://geowidget.inpost.pl/inpost-geowidget.css" />
       <Script 
        src="https://geowidget.inpost.pl/inpost-geowidget.js" 
        strategy="afterInteractive" 
      />
      <link rel="stylesheet" href="https://geowidget.inpost.pl/inpost-geowidget.css" />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12">
        
        {/* LEWA STRONA (FORMULARZ I PACZKI) */}
        <div className="xl:col-span-2 space-y-10">
          
          <form id="checkout-form" onSubmit={handlePlaceOrder} className="space-y-6">
            <h2 className="text-2xl font-black mb-4">1. Dane Odbiorcy</h2>
            <div className="bg-white p-6 rounded-3xl border shadow-sm space-y-4">
              <input type="text" placeholder="Imię i Nazwisko" required className="w-full p-3 border rounded-xl outline-none focus:border-blue-500 font-bold" onChange={e => setShippingData({...shippingData, name: e.target.value})} />
              <input type="tel" placeholder="Numer telefonu" required className="w-full p-3 border rounded-xl outline-none focus:border-blue-500 font-bold" onChange={e => setShippingData({...shippingData, phone: e.target.value})} />
              
              <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-4">
                <input type="text" placeholder="Ulica i numer" required className="col-span-2 w-full p-3 border rounded-xl outline-none focus:border-blue-500 font-bold" onChange={e => setShippingData({...shippingData, street: e.target.value})} />
                <input type="text" placeholder="Kod pocztowy" required className="w-full p-3 border rounded-xl outline-none focus:border-blue-500 font-bold" onChange={e => setShippingData({...shippingData, zip: e.target.value})} />
                <input type="text" placeholder="Miasto" required className="w-full p-3 border rounded-xl outline-none focus:border-blue-500 font-bold" onChange={e => setShippingData({...shippingData, city: e.target.value})} />
              </div>

              {/* Jeśli którakolwiek paczka ma wybrany InPost, żądamy kodu paczkomatu */}
              {Object.values(selectedMethods).includes('inpost') && (
                <div className="bg-amber-50 p-4 border border-amber-200 rounded-xl mt-4">
                  <label className="block text-xs font-black uppercase text-amber-800 mb-2">Wybrałeś Paczkomat w jednym z zamówień</label>
                  <input type="text" placeholder="Wpisz kod Paczkomatu (np. POZ01M)" required className="w-full p-3 border-2 border-amber-400 rounded-xl outline-none font-black text-amber-900" onChange={e => setShippingData({...shippingData, lockerId: e.target.value})} />
                </div>
              )}
            </div>
          </form>

          <div>
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2"><span>📦</span> Twoje Przesyłki ({sellerIds.length})</h2>
            <div className="space-y-6">
              {sellerIds.map((sellerId, idx) => {
                const group = groupedPackages[sellerId];
                const options = shippingOptionsPerPackage[sellerId];
                const selectedMethod = selectedMethods[sellerId];

                return (
                  <div key={sellerId} className="bg-white rounded-3xl border-2 border-blue-100 shadow-sm overflow-hidden">
                    <div className="bg-blue-50 p-4 border-b border-blue-100 flex justify-between items-center">
                      <span className="font-bold text-blue-900">Paczka #{idx + 1} od: <span className="font-black">{group.seller.username}</span></span>
                    </div>
                    
                    {/* Lista produktów w tej paczce */}
                    <div className="p-4 bg-gray-50/50 space-y-2 border-b">
                      {group.items.map((item: any, itemIndex: number) => (
                        <div key={item.id || itemIndex} className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.quantity}x {item.listing.title}</span>
                        </div>
                      ))}
                    </div>

                    {/* Wybór kuriera dla TEJ KONKRETNEJ paczki */}
                    <div className="p-6">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Wybierz dostawę dla tej paczki</p>
                      
                      {options ? (
                        <div className="space-y-3">
                          {/* GRID METOD DOSTAWY */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {options.available.map((methodCode: string) => {
                              const isSelected = selectedMethod === methodCode;
                              const methodData = options.methods[methodCode];
                              
                              return (
                                <label
                                  key={methodCode}
                                  className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition ${isSelected ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-600/20' : 'border-gray-200 hover:border-blue-300'}`}
                                >
                                  <input 
                                    type="radio" 
                                    name={`shipping-${sellerId}`} 
                                    value={methodCode} 
                                    checked={isSelected} 
                                    onChange={() => handleMethodChange(sellerId, methodCode)} 
                                    className="w-5 h-5 accent-blue-600 mr-3" 
                                  />
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-black text-gray-900">{methodData.name}</span>
                                      <span className="font-bold text-blue-700">{methodData.price.toFixed(2)} zł</span>
                                    </div>
                                    <p className="text-xs text-gray-500">{methodData.message}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>

                          {/* INPOST - POLE NA WYBÓR PACZKOMATU (Pojawia się pod gridem, jeśli wybrano inpost) */}
                          {selectedMethod === 'inpost' && (
                            <div className="mt-4 p-5 rounded-2xl bg-yellow-50 border border-yellow-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                              {selectedLockerIds[sellerId] ? (
                                <div className="flex items-center gap-3">
                                  <span className="text-3xl">📍</span>
                                  <div>
                                    <p className="text-[10px] font-black uppercase text-yellow-800 tracking-widest mb-0.5">Paczka trafi do</p>
                                    <p className="font-black text-lg text-yellow-900">{selectedLockerIds[sellerId]}</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-yellow-800 font-bold">
                                  <span className="text-xl">⚠️</span> Wybierz punkt odbioru
                                </div>
                              )}
                              
                              <button 
                                type="button" 
                                onClick={() => setIsMapOpenForSeller(sellerId)} 
                                className="bg-yellow-400 hover:bg-yellow-500 text-black font-black py-3 px-6 rounded-xl transition shadow-sm w-full sm:w-auto"
                              >
                                Pokaż Mapę ➔
                              </button>
                            </div>
                          )}

                        </div>
                      ) : (
                        <p className="text-gray-400 animate-pulse text-sm">Ładowanie opcji logistycznych...</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* PRAWA STRONA (PODSUMOWANIE) */}
        <aside className="xl:col-span-1">
          <div className="bg-gray-900 text-white p-8 rounded-3xl shadow-2xl sticky top-8">
            <h2 className="text-2xl font-black mb-6">Rozliczenie P24</h2>
            
            <div className="space-y-4 mb-6 text-sm border-b border-gray-800 pb-6">
              {sellerIds.map((sellerId, idx) => {
                const group = groupedPackages[sellerId];
                const selectedMethod = selectedMethods[sellerId];
                const shippingCost = shippingOptionsPerPackage[sellerId]?.methods[selectedMethod]?.price || 0;
                
                let productsCost = 0;
                group.items.forEach((item: any) => {
                  productsCost += (item.variant ? item.variant.price : item.listing.price) * item.quantity;
                });

                return (
                  <div key={sellerId} className="flex justify-between text-gray-400">
                    <span>Paczka #{idx + 1} (Produkty + Wysyłka)</span>
                    <span className="text-white font-bold">{(productsCost + shippingCost).toFixed(2)} PLN</span>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-end mb-8">
              <span className="font-bold text-gray-400">Łącznie (BLIK / Karta)</span>
              <span className="text-4xl font-black text-green-400">{calculateTotal().toFixed(2)} PLN</span>
            </div>

            <button 
              type="submit" 
              form="checkout-form"
              disabled={isProcessing}
              className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-5 rounded-2xl text-xl transition shadow-lg disabled:opacity-50"
            >
              {isProcessing ? 'Przetwarzanie...' : 'Opłać Zamówienie ➔'}
            </button>
            <p className="text-[10px] text-gray-500 text-center mt-4 uppercase tracking-widest">
                Bezpieczne płatności obsługuje Przelewy24
            </p>
          </div>
        </aside>

      </div>
      {isMapOpenForSeller && (
  <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl overflow-hidden flex flex-col relative animate-in zoom-in-95">
      
      {/* NAGŁÓWEK MODALA */}
      <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
        <h3 className="font-black">
          Znajdź Paczkomat (Dla: {groupedPackages[isMapOpenForSeller]?.seller?.username})
        </h3>
        <button type="button" onClick={() => setIsMapOpenForSeller(null)} className="text-2xl font-black hover:scale-110 transition">✕</button>
      </div>
      
      {/* MAPA - OPCJA ATOMOWA */}
      <div 
        className="flex-1 w-full h-full relative"
        dangerouslySetInnerHTML={{
          __html: `
            <inpost-geowidget 
              language="pl" 
              config="parcelCollect" 
              token=""
              style="width: 100%; height: 100%; display: block;"
            ></inpost-geowidget>
          `
        }}
      />
    </div>
  </div>
)}
    </main>
  );
}