'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const MiniAdCard = ({ item }: { item: any }) => (
  <Link href={`/ogloszenie/${item.id}`} className="block w-40 md:w-48 shrink-0 snap-start group cursor-pointer">
    <div className="w-full aspect-square bg-gray-100 rounded-2xl overflow-hidden mb-3 relative border border-gray-200">
      {item.image_url ? (
        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
           <span className="text-2xl">📸</span>
        </div>
      )}
    </div>
    <p className="text-xs font-bold text-gray-500 uppercase truncate mb-1">{item.category}</p>
    <h4 className="text-sm font-black text-gray-900 leading-tight mb-1 truncate">{item.title}</h4>
    <p className="text-lg font-black text-green-600">{item.price} <span className="text-xs">PLN</span></p>
  </Link>
);
export default function OgloszeniePage() {
  const params = useParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [ad, setAd] = useState<any>(null);
  
  const [images, setImages] = useState<string[]>([]);
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [sellerAds, setSellerAds] = useState<any[]>([]);
  const [recommendedAds, setRecommendedAds] = useState<any[]>([]);
  const [similarAds, setSimilarAds] = useState<any[]>([]);
  const [extrasLoading, setExtrasLoading] = useState(true);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  useEffect(() => {
    const fetchListing = async () => {
      if (!params.id) return;

      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          seller:profiles!fk_seller_profile(username, store_address, avatar_url),
          species:species(*),
          listing_images(image_url),
          variants:listing_variants(*) 
        `) // ^^^ TUTAJ DOKLEJAMY WARIANTY ^^^
        .eq('id', params.id)
        .single();

      if (error || !data) {
        setAd(null);
      } else {
        setAd(data);
        
        // 1. Obsługa zdjęć (Zostaje tak jak miałeś)
        let allImages: string[] = [];
        if (data.listing_images && data.listing_images.length > 0) {
          allImages = data.listing_images.map((img: any) => img.image_url);
        } else if (data.image_url) {
          allImages = [data.image_url];
        }
        setImages(allImages);

        // 2. NOWOŚĆ: Obsługa Wariantów
        if (data.allow_buy_now && data.variants && data.variants.length > 0) {
          // Sortujemy od najtańszego do najdroższego
          const sortedVariants = data.variants.sort((a: any, b: any) => a.price - b.price);
          setVariants(sortedVariants);
          setSelectedVariant(sortedVariants[0]); // Domyślnie zaznaczamy najtańszy
        }
      }
      setLoading(false);
    };

    fetchListing();
  }, [params.id]);

  useEffect(() => {
    if (!ad) return;

    const fetchExtras = async () => {
      setExtrasLoading(true);

      // 1. INNE OD TEGO SPRZEDAWCY
      const { data: sellerData } = await supabase
        .from('listings')
        .select('id, title, price, image_url, category, condition')
        .eq('seller_id', ad.seller_id)
        .neq('id', ad.id) // Omijamy aktualne ogłoszenie
        .eq('status', 'active')
        .limit(5);

      setSellerAds(sellerData || []);

      // 3. Z TEJ SAMEJ KATEGORII
      const { data: similarData } = await supabase
        .from('listings')
        .select('id, title, price, image_url, category, condition')
        .eq('category', ad.category)
        .neq('id', ad.id)
        .eq('status', 'active')
        .limit(5);
        
      setSimilarAds(similarData || []);

      // 2. MOŻE CI SIĘ PRZYDAĆ (Na podstawie Twoich powiązań w bazie)
      // UWAGA: Dopasuj to zapytanie do tego, jak dokładnie nazwałeś tabele w panelu admina!
      // 2. MOŻE CI SIĘ PRZYDAĆ (Logika z Debuggerem)
     const { data: currentCat } = await supabase.from('categories').select('id').eq('name', ad.category).single();

        if (currentCat) {
          // KROK B: Szukamy powiązań (TERAZ Z POPRAWNĄ NAZWĄ KOLUMNY!)
          const { data: suggestions } = await supabase
            .from('category_suggestions')
            .select('suggested_category_id') // <-- TU BYŁ MÓJ BŁĄD
            .eq('source_category_id', currentCat.id);

          if (suggestions && suggestions.length > 0) {
            // Mapujemy też poprawną nazwę z obiektu
            const targetIds = suggestions.map(s => s.suggested_category_id); // <-- I TUTAJ TEŻ

            // KROK C: Pobieramy NAZWY tych kategorii
            const { data: targetCats } = await supabase.from('categories').select('name').in('id', targetIds);

            if (targetCats) {
              const names = targetCats.map(c => c.name);

              // KROK D: Pobieramy gotowe ogłoszenia
              const { data: recData } = await supabase
                .from('listings')
                .select('*')
                .in('category', names)
                .eq('status', 'active')
                .limit(6);
              
              setRecommendedAds(recData || []);
            }
          }
        }

      setExtrasLoading(false);
    };

    fetchExtras();
  }, [ad]); // Odpali się, gdy 'ad' ulegnie zmianie
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-black text-2xl text-gray-300 animate-pulse">Wczytywanie...</div>;
  }
  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    
    // Sprawdzamy czy użytkownik jest zalogowany
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Musisz być zalogowany, aby dodać do koszyka!");
      // router.push('/logowanie'); // Odkomentuj jeśli masz stronę logowania
      setIsAddingToCart(false);
      return;
    }

    try {
      // Przygotowujemy dane do wstawienia
      const payload = {
        user_id: user.id,
        listing_id: ad.id,
        variant_id: selectedVariant ? selectedVariant.id : null,
        quantity: 1 // Na start dodajemy 1 sztukę
      };

      // Używamy .upsert(), co oznacza: "Wstaw nowy, a jeśli już taki wariant jest w koszyku, to go zaktualizuj"
      // Aby upsert zwiększał ilość, musimy najpierw sprawdzić czy istnieje, ale dla uproszczenia zrobimy po prostu insert z obsługą błędu
      const { error } = await supabase.from('cart_items').insert([payload]);

      if (error) {
        if (error.code === '23505') { // Kod błędu dla naruszenia UNIQUE
          alert("Ten przedmiot jest już w Twoim koszyku!");
        } else {
          throw error;
        }
      } else {
        alert("✅ Dodano do koszyka!");
        // Opcjonalnie: odśwież licznik koszyka w nawigacji
      }
    } catch (err: any) {
      alert("Błąd: " + err.message);
    } finally {
      setIsAddingToCart(false);
    }
  };

  if (!ad) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <h1 className="text-6xl mb-4">🕵️‍♂️</h1>
        <h2 className="text-2xl font-black mb-2">Ogłoszenie nie istnieje</h2>
        <p className="text-gray-500 mb-6">Prawdopodobnie zostało usunięte lub sprzedane.</p>
        <button onClick={() => router.push('/')} className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition">
          Wróć na stronę główną
        </button>
      </div>
    );
  }

  return (
    // FIX NA "LATA NA BOKI": overflow-x-hidden + w-full w tagu main. Zmniejszony padding pb-20 (ponieważ pasek na dole jest chudszy).
    <main className="min-h-screen bg-white pb-20 md:pb-12 w-full overflow-x-hidden">
      
      {/* NAWIGACJA: Ukrywamy całkowicie na mobile */}
      <div className="hidden md:block border-b border-gray-100 pt-24 pb-4 px-6 mb-8">
        <div className="max-w-5xl mx-auto flex gap-2 text-sm font-medium text-gray-400 overflow-x-auto whitespace-nowrap">
          <Link href="/" className="hover:text-black transition">Strona Główna</Link>
          <span>❯</span>
          <span className="hover:text-black transition cursor-pointer">{ad.category}</span>
          <span>❯</span>
          <span className="text-gray-900 font-bold truncate max-w-[200px]">{ad.title}</span>
        </div>
      </div>

      {/* GŁÓWNY KONTENER */}
      <div className="max-w-5xl mx-auto px-0 md:px-6 md:pt-4">
        <div className="flex flex-col lg:flex-row gap-0 md:gap-12">
          
          {/* KOLUMNA LEWA */}
          <div className="flex-1 min-w-0">
            
            {/* GALERIA ZDJĘĆ */}
            <div className="w-full relative bg-black md:rounded-3xl overflow-hidden aspect-[4/3] md:aspect-[16/10]">
              {images.length > 0 ? (
                <img 
                  src={images[activeImgIndex]} 
                  alt="Zdjęcie główne" 
                  className="w-full h-full object-contain animate-in fade-in duration-300"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-100">
                   <span className="text-5xl mb-2">📸</span>
                   <span className="font-bold">Brak zdjęć</span>
                </div>
              )}
            </div>

            {/* MINIATURKI (Nieco zmniejszone na desktopie) */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto px-4 md:px-0 py-4 custom-scrollbar">
                {images.map((img, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveImgIndex(idx)}
                      className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden transition-all ${activeImgIndex === idx ? 'border-2 border-black opacity-100 scale-95' : 'border border-gray-200 opacity-60 hover:opacity-100'}`}
                    >
                      <img src={img} className="w-full h-full object-cover" />
                    </button>
                ))}
              </div>
            )}

            {/* TYTUŁ I CENA (PŁASKI DESIGN) */}
            <div className="px-5 md:px-0 pt-6 pb-6 border-b border-gray-100">
               <div className="flex flex-wrap gap-2 items-center mb-3">
                  <span className="bg-gray-100 text-gray-600 text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest">{ad.category}</span>
                  {ad.condition && (
                    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest ${ad.condition === 'new' ? 'bg-green-100 text-green-700' : ad.condition === 'used' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                      {ad.condition === 'new' ? 'Nowy' : ad.condition === 'used' ? 'Używany' : 'Uszkodzony'}
                    </span>
                  )}
               </div>
               
               {/* FIX NA DŁUGIE TEKSTY */}
               <h1 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight mb-4 break-words">
                 {ad.title}
               </h1>
               
               {/* ODCHUDZONA CENA NA MOBILE: text-3xl zamiast text-4xl, adjustacja PLN */}
               <p className="text-3xl md:text-5xl font-black text-green-600">
                 {ad.price} <span className="text-lg md:text-2xl text-green-700/50">PLN</span>
               </p>
            </div>

            {/* SEKCJA GATUNKU */}
            {ad.species && (
              <div className="px-5 md:px-0 py-8 border-b border-gray-100">
                <h3 className="text-sm font-black uppercase text-gray-400 mb-4">Informacje o zwierzęciu</h3>
                <div className="bg-gray-50 rounded-2xl p-4 md:p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                    <span className="text-sm font-bold text-gray-500">Nazwa polska</span>
                    <span className="font-black text-gray-900 text-right">{ad.species.name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-sm font-bold text-gray-500">Nazwa łacińska</span>
                    <span className="font-bold text-gray-600 italic text-right">{ad.species.latin_name}</span>
                  </div>
                  {/* CITES */}
                  {ad.species.cites_appendix && (
                    <div className="mt-4 bg-blue-50/50 border border-blue-100 p-4 rounded-xl">
                      <p className="text-blue-800 font-bold text-sm mb-1 flex items-center gap-2"><span>📜</span> CITES Zał. {ad.species.cites_appendix}</p>
                      {ad.cites_certificate ? (
                        <p className="text-blue-900 font-mono text-xs mt-2 bg-white px-3 py-1 rounded inline-block border border-blue-200">{ad.cites_certificate}</p>
                      ) : (
                        <p className="text-blue-600/70 text-xs">Oświadczono o legalnym pochodzeniu.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OPIS: Dodano max-w-full i overflow-hidden, żeby wewnątrz description obrazki nie psuły layoutu */}
            <div className="px-5 md:px-0 py-8 border-b md:border-none border-gray-100 max-w-full overflow-hidden">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 mb-6">Opis</h2>
              <p className="whitespace-pre-wrap text-gray-700 leading-relaxed font-medium break-words">
                {ad.description}
              </p>
            </div>
            
          </div>

          {/* KOLUMNA PRAWA */}
          <div className="w-full lg:w-[380px] shrink-0 px-5 md:px-0 mt-8 md:mt-0 pb-10 md:pb-0">
            <div className="sticky top-28 space-y-6">
              
              {/* KARTA AKCJI (Desktop Only) */}
             {/* --- CENA DYNAMICZNA --- */}
          <div className="mb-6 pb-6 border-b border-gray-100">
            <p className="text-4xl font-black text-green-600 tracking-tight">
              {/* Jeśli są warianty, pokazujemy cenę wybranego. Jeśli nie, cenę bazową. */}
              {variants.length > 0 && selectedVariant 
                ? selectedVariant.price 
                : ad.price} PLN
            </p>
            {variants.length > 0 && (
              <p className="text-sm font-bold text-gray-400 uppercase mt-1">Cena zależy od wariantu</p>
            )}
          </div>

          {/* --- WYBÓR WARIANTU (Tylko jeśli istnieją) --- */}
          {variants.length > 0 && (
            <div className="mb-8">
              <h3 className="text-sm font-black uppercase text-gray-900 mb-3 tracking-widest">Dostępne warianty</h3>
              <div className="flex flex-wrap gap-3">
                {variants.map(variant => {
                  const isSelected = selectedVariant?.id === variant.id;
                  const isOutOfStock = variant.stock <= 0;

                  return (
                    <button
                      key={variant.id}
                      onClick={() => !isOutOfStock && setSelectedVariant(variant)}
                      disabled={isOutOfStock}
                      className={`
                        relative px-5 py-3 rounded-xl border-2 font-bold transition-all text-sm
                        ${isSelected 
                          ? 'border-black bg-black text-white shadow-md transform scale-105' 
                          : isOutOfStock
                            ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }
                      `}
                    >
                      <span className="block">{variant.name}</span>
                      {/* Jeśli to jest wybrany kafel, zmieniamy kolor tekstu dodatkowego */}
                      <span className={`block text-[10px] mt-1 uppercase ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                         {isOutOfStock ? 'Brak w magazynie' : `W magazynie: ${variant.stock}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* --- PRZYCISKI AKCJI (Kup Teraz vs Wiadomość) --- */}
          <div className="flex flex-col gap-3">
           {/* Przycisk Kup Teraz pojawia się tylko, jeśli sprzedawca na to pozwolił i mamy stan magazynowy */}
            {ad.allow_buy_now && (!variants.length || (selectedVariant && selectedVariant.stock > 0)) && (
              <button 
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-black text-lg py-5 rounded-2xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300 disabled:bg-green-300"
              >
                <span>🛒</span> {isAddingToCart ? 'Dodawanie...' : 'Dodaj do koszyka'}
              </button>
            )}
            
            <button className="w-full border-2 border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white font-black text-lg py-5 rounded-2xl transition-all flex items-center justify-center gap-2">
              <span>💬</span> Napisz do sprzedawcy
            </button>
          </div>

              {/* SPRZEDAWCA */}
              <div className="py-6 md:p-6 md:bg-gray-50 md:rounded-3xl border-t border-b border-gray-100 md:border-none flex flex-col gap-4">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Sprzedający</h3>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-2xl border border-gray-200 shrink-0">
                    {ad.seller?.avatar_url ? <img src={ad.seller.avatar_url} className="w-full h-full rounded-full object-cover" /> : '👤'}
                  </div>
                  <div className="overflow-hidden min-w-0">
                    <p className="font-black text-lg text-gray-900 truncate">{ad.seller?.username || 'Anonim'}</p>
                    <p className="text-sm text-gray-500 font-medium flex items-center gap-1 truncate">
                      <span>📍</span> {ad.seller?.store_address || 'Polska'}
                    </p>
                  </div>
                </div>
                <Link href={`/sklep/${ad.seller_id}`} className="mt-2 w-full block text-center bg-white border border-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-50 transition text-sm">
                  Zobacz inne ogłoszenia
                </Link>
              </div>

              {/* BEZPIECZEŃSTWO */}
              <div className="py-6 md:py-0">
                <h4 className="text-gray-900 font-black text-sm mb-2 flex items-center gap-2"><span>🛡️</span> Bądź bezpieczny</h4>
                <p className="text-gray-500 text-xs font-medium leading-relaxed">
                  Zawsze sprawdzaj dokumenty CITES przy odbiorze zwierzaka. Unikaj wysyłania zaliczek w ciemno przed podpisaniem umowy.
                </p>
              </div>

            </div>
          </div>

        </div>
      </div>
      {/* --- SEKCJE REKOMENDACJI --- */}
      {!extrasLoading && (
        <div className="max-w-5xl mx-auto px-5 md:px-6 mt-16 pb-12 space-y-12 border-t border-gray-100 pt-12">
          
          {/* 1. Od tego samego sprzedawcy */}
          {sellerAds.length > 0 && (
            <section>
              <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                <span>📦</span> Inne ogłoszenia tego sprzedawcy
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
                {sellerAds.map(item => <MiniAdCard key={item.id} item={item} />)}
              </div>
            </section>
          )}

          {/* 2. Może Ci się przydać */}
          {recommendedAds.length > 0 && (
            <section>
              <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                <span>💡</span> Może Ci się przydać
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
                {recommendedAds.map(item => <MiniAdCard key={item.id} item={item} />)}
              </div>
            </section>
          )}

          {/* 3. Podobne z tej kategorii */}
          {similarAds.length > 0 && (
            <section>
              <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
                <span>🦎</span> Podobne w tej kategorii
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar snap-x snap-mandatory">
                {similarAds.map(item => <MiniAdCard key={item.id} item={item} />)}
              </div>
            </section>
          )}

        </div>
      )}
      {/* --- ODCHUDZONY MOBILE STICKY BOTTOM BAR --- */}
      {/* ODCHUDZANIE: Zmniejszony padding (p-2 px-4 zamiast p-4 px-5). */}
      <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-2 px-4 flex justify-between items-center z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
         <div>
           {/* Zmniejszony font etykiety (text-[9px]) i ceny (text-xl) */}
           <p className="text-[9px] font-bold text-gray-400 uppercase">Cena</p>
           <p className="text-xl font-black text-green-600 leading-none">{ad.price} <span className="text-xs">PLN</span></p>
         </div>
         {/* Odchudzony przycisk (py-2.5 px-4) */}
         <button className="bg-black text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 shadow-lg text-sm">
           ✉️ Napisz
         </button>
      </div>

    </main>
  );
}