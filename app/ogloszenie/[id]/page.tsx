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
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const [sellerAds, setSellerAds] = useState<any[]>([]);
  const [recommendedAds, setRecommendedAds] = useState<any[]>([]);
  const [similarAds, setSimilarAds] = useState<any[]>([]);
  const [extrasLoading, setExtrasLoading] = useState(true);
  const [variants, setVariants] = useState<any[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  
  // --- STANY OBSERWOWANYCH ---
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);

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
        `)
        .eq('id', params.id)
        .single();

      if (error || !data) {
        setAd(null);
      } else {
        setAd(data);
        
        let allImages: string[] = [];
        
        if (data.image_url) {
          allImages.push(data.image_url);
        }
        
        if (data.listing_images && Array.isArray(data.listing_images)) {
          data.listing_images.forEach((img: any) => {
            const url = img.image_url || img.url; 
            if (url && !allImages.includes(url)) {
              allImages.push(url);
            }
          });
        }
        
        setImages(allImages);

        if (data.variants && data.variants.length > 0) {
          const sortedVariants = data.variants.sort((a: any, b: any) => a.price - b.price);
          setVariants(sortedVariants);
          setSelectedVariant(sortedVariants[0]);
        }
      }
      setLoading(false);
    };

    fetchListing();
  }, [params.id]);

  // --- POBIERANIE DANYCH O SERDUSZKACH (LICZNIK + STATUS) ---
  useEffect(() => {
    const fetchFavoriteData = async () => {
      if (!params.id) return;

      // 1. Pobieramy całkowitą liczbę obserwujących to ogłoszenie
      const { count } = await supabase
        .from('favorites')
        .select('*', { count: 'exact', head: true })
        .eq('listing_id', params.id);
      
      setFavoritesCount(count || 0);

      // 2. Sprawdzamy, czy ZALOGOWANY użytkownik ma to w obserwowanych
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('listing_id', params.id)
        .single();

      if (data) setIsFavorite(true);
    };

    fetchFavoriteData();
  }, [params.id]);

  const toggleFavorite = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('Musisz być zalogowany, aby dodać do obserwowanych!');
      return;
    }

    setFavoriteLoading(true);

    if (isFavorite) {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', params.id);
      setIsFavorite(false);
      setFavoritesCount(prev => prev - 1); // Zmniejszamy licznik na żywo
    } else {
      await supabase
        .from('favorites')
        .insert([{ user_id: user.id, listing_id: params.id }]);
      setIsFavorite(true);
      setFavoritesCount(prev => prev + 1); // Zwiększamy licznik na żywo
    }
    
    setFavoriteLoading(false);
  };

  useEffect(() => {
    if (!ad || ad.status !== 'active') return;

    const fetchExtras = async () => {
      setExtrasLoading(true);

      const { data: sellerData } = await supabase
        .from('listings')
        .select('id, title, price, image_url, category, condition')
        .eq('seller_id', ad.seller_id)
        .neq('id', ad.id)
        .eq('status', 'active')
        .limit(5);

      setSellerAds(sellerData || []);

      const { data: similarData } = await supabase
        .from('listings')
        .select('id, title, price, image_url, category, condition')
        .eq('category', ad.category)
        .neq('id', ad.id)
        .eq('status', 'active')
        .limit(5);
        
      setSimilarAds(similarData || []);

      const { data: currentCat } = await supabase.from('categories').select('id').eq('name', ad.category).single();

      if (currentCat) {
        const { data: suggestions } = await supabase
          .from('category_suggestions')
          .select('suggested_category_id')
          .eq('source_category_id', currentCat.id);

        if (suggestions && suggestions.length > 0) {
          const targetIds = suggestions.map(s => s.suggested_category_id);
          const { data: targetCats } = await supabase.from('categories').select('name').in('id', targetIds);

          if (targetCats) {
            const names = targetCats.map(c => c.name);
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
  }, [ad]);

  const handleNextImage = () => {
    setActiveImgIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrevImage = () => {
    setActiveImgIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  useEffect(() => {
    if (isLightboxOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLightboxOpen) return;
      if (e.key === 'Escape') setIsLightboxOpen(false);
      if (e.key === 'ArrowRight') handleNextImage();
      if (e.key === 'ArrowLeft') handlePrevImage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLightboxOpen, images.length]);


  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-black text-2xl text-gray-300 animate-pulse">Wczytywanie...</div>;
  }

  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Musisz być zalogowany, aby dodać do koszyka!");
      setIsAddingToCart(false);
      return;
    }

    try {
      const payload = {
        user_id: user.id,
        listing_id: ad.id,
        variant_id: selectedVariant ? selectedVariant.id : null,
        quantity: 1
      };

      const { error } = await supabase.from('cart_items').insert([payload]);

      if (error) {
        if (error.code === '23505') {
          alert("Ten przedmiot jest już w Twoim koszyku!");
        } else {
          throw error;
        }
      } else {
        alert("✅ Dodano do koszyka!");
      }
    } catch (err: any) {
      alert("Błąd: " + err.message);
    } finally {
      setIsAddingToCart(false);
    }
  };

  if (!ad) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <h1 className="text-6xl mb-4">🕵️‍♂️</h1>
        <h2 className="text-2xl font-black mb-2">Ogłoszenie nie istnieje</h2>
        <p className="text-gray-500 mb-6">Prawdopodobnie zostało całkowicie usunięte z platformy.</p>
        <button onClick={() => router.push('/')} className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition">
          Wróć na stronę główną
        </button>
      </div>
    );
  }

  if (ad.status !== 'active') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6 opacity-50 shadow-inner">
          <span className="text-5xl grayscale">🦎</span>
        </div>
        <h2 className="text-3xl font-black mb-2 text-gray-800">Ogłoszenie jest już nieaktywne</h2>
        <p className="text-gray-500 mb-8 max-w-md font-medium">
          Zostało sprzedane, wygasło lub sprzedawca usunął ofertę. Nie możesz już dokonać zakupu.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => router.back()} className="bg-white border-2 border-gray-200 text-gray-700 px-8 py-4 rounded-xl font-bold hover:bg-gray-50 transition w-full sm:w-auto">
            Wróć
          </button>
          <Link href="/" className="bg-black text-white px-8 py-4 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg w-full sm:w-auto block">
            Strona główna
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-white pb-20 md:pb-12 w-full overflow-x-hidden">
        
        {/* NAWIGACJA */}
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
              
              {/* GALERIA ZDJĘĆ - Z KLIKALNYM LIGHTBOXEM */}
              <div 
                className="w-full relative bg-black md:rounded-3xl overflow-hidden aspect-[4/3] md:aspect-[16/10] group cursor-zoom-in"
                onClick={() => { if (images.length > 0) setIsLightboxOpen(true); }}
              >
                {images.length > 0 ? (
                  <>
                    <img 
                      src={images[activeImgIndex]} 
                      alt="Zdjęcie główne" 
                      className="w-full h-full object-contain animate-in fade-in duration-300 group-hover:opacity-90 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <div className="bg-black/50 text-white backdrop-blur-md px-4 py-2 rounded-full font-bold flex items-center gap-2">
                        <span>🔍</span> Powiększ
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-100 cursor-default">
                    <span className="text-5xl mb-2">📸</span>
                    <span className="font-bold">Brak zdjęć</span>
                  </div>
                )}
              </div>

              {/* MINIATURKI */}
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

              {/* TYTUŁ I CENA */}
              <div className="px-5 md:px-0 pt-6 pb-6 border-b border-gray-100">
                <div className="flex flex-wrap gap-2 items-center mb-3">
                    <span className="bg-gray-100 text-gray-600 text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest">{ad.category}</span>
                    {ad.condition && (
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest ${ad.condition === 'new' ? 'bg-green-100 text-green-700' : ad.condition === 'used' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                        {ad.condition === 'new' ? 'Nowy' : ad.condition === 'used' ? 'Używany' : 'Uszkodzony'}
                      </span>
                    )}
                    
                    {/* --- ZNACZEK "SOCIAL PROOF" (LICZNIK OBSERWUJĄCYCH) --- */}
                    {favoritesCount > 0 && (
                      <span className="bg-red-50 border border-red-100 text-red-600 text-[10px] font-black uppercase px-2 py-1 rounded tracking-widest flex items-center gap-1 shadow-sm">
                        <span className="animate-pulse">❤️</span> {favoritesCount} {favoritesCount === 1 ? 'osoba obserwuje' : 'osób obserwuje'}
                      </span>
                    )}
                </div>
                
                <h1 className="text-2xl md:text-4xl font-black text-gray-900 leading-tight mb-4 break-words">
                  {ad.title}
                </h1>
                
                <p className="text-3xl md:text-5xl font-black text-green-600 md:hidden">
                  {variants.length > 0 && selectedVariant ? selectedVariant.price : ad.price} <span className="text-lg md:text-2xl text-green-700/50">PLN</span>
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

              {/* OPIS */}
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
                
                {/* --- CENA DYNAMICZNA (DESKTOP) --- */}
                <div className="hidden md:block mb-6 pb-6 border-b border-gray-100">
                  <p className="text-4xl font-black text-green-600 tracking-tight">
                    {variants.length > 0 && selectedVariant 
                      ? selectedVariant.price 
                      : ad.price} PLN
                  </p>
                  {variants.length > 0 && (
                    <p className="text-sm font-bold text-gray-400 uppercase mt-1">Cena zależy od wariantu</p>
                  )}
                </div>

                {/* --- WYBÓR WARIANTU --- */}
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
                            <span className={`block text-[10px] mt-1 uppercase ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
                              {isOutOfStock ? 'Brak w magazynie' : `W magazynie: ${variant.stock}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* --- PRZYCISKI AKCJI --- */}
                <div className="flex flex-col gap-3">
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
                  
                  <div>
                    <button 
                      onClick={toggleFavorite} 
                      disabled={favoriteLoading}
                      className={`w-full px-6 py-4 rounded-2xl font-black text-lg border-2 transition flex items-center justify-center gap-2 ${
                        isFavorite 
                          ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' 
                          : 'bg-white border-gray-200 text-gray-700 hover:border-red-400 hover:text-red-600'
                      }`}
                    >
                      {isFavorite ? '❤️ Obserwujesz' : '🤍 Dodaj do obserwowanych'}
                    </button>
                    {/* PSYCHOLOGICZNY LICZNIK POD PRZYCISKIEM */}
                    {favoritesCount > 0 && !isFavorite && (
                      <p className="text-center text-[11px] font-bold text-gray-400 mt-2 animate-in fade-in">
                        To ogłoszenie wpadło już w oko {favoritesCount} {favoritesCount === 1 ? 'osobie' : 'osobom'}!
                      </p>
                    )}
                  </div>
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
        <div className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-2 px-4 flex justify-between items-center z-50 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
          <div>
            <p className="text-[9px] font-bold text-gray-400 uppercase">Cena</p>
            <p className="text-xl font-black text-green-600 leading-none">
              {variants.length > 0 && selectedVariant ? selectedVariant.price : ad.price} <span className="text-xs">PLN</span>
            </p>
          </div>
          <button className="bg-black text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 shadow-lg text-sm">
            ✉️ Napisz
          </button>
        </div>

      </main>

      {/* ========================================= */}
      {/* 🖼️ GALERIA PEŁNOEKRANOWA (LIGHTBOX MODAL)  */}
      {/* ========================================= */}
      {isLightboxOpen && images.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col md:flex-row animate-in fade-in duration-300">
          
          <button 
            onClick={() => setIsLightboxOpen(false)} 
            className="absolute top-4 right-4 md:left-6 md:right-auto z-50 text-white bg-white/10 hover:bg-white/20 p-4 rounded-full backdrop-blur-md transition shadow-xl"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="flex-1 relative flex items-center justify-center p-4 md:p-12 h-[75vh] md:h-screen">
            <img 
              src={images[activeImgIndex]} 
              className="max-w-full max-h-full object-contain drop-shadow-2xl select-none" 
              alt="Powiększone zdjęcie" 
            />

            {images.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.stopPropagation(); handlePrevImage(); }} 
                  className="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 bg-black/50 text-white p-4 md:p-6 rounded-full hover:bg-black/80 backdrop-blur-sm transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6 md:w-8 md:h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleNextImage(); }} 
                  className="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 bg-black/50 text-white p-4 md:p-6 rounded-full hover:bg-black/80 backdrop-blur-sm transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-6 h-6 md:w-8 md:h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                </button>
              </>
            )}

            <div className="absolute bottom-4 md:top-8 md:bottom-auto left-1/2 -translate-x-1/2 bg-black/60 text-white px-4 py-2 rounded-full font-bold text-sm backdrop-blur-md">
              {activeImgIndex + 1} / {images.length}
            </div>
          </div>

          {images.length > 1 && (
            <div className="w-full md:w-40 lg:w-56 bg-black/80 border-t md:border-t-0 md:border-l border-white/10 flex flex-row md:flex-col gap-3 p-4 overflow-x-auto md:overflow-y-auto h-[25vh] md:h-screen custom-scrollbar snap-x md:snap-y snap-mandatory items-center md:items-stretch">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImgIndex(idx)}
                  className={`shrink-0 snap-center w-20 h-20 md:w-full md:h-28 rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                    activeImgIndex === idx 
                      ? 'border-green-500 scale-100 opacity-100 shadow-[0_0_15px_rgba(34,197,94,0.5)]' 
                      : 'border-transparent opacity-40 hover:opacity-100 scale-95 hover:scale-100'
                  }`}
                >
                  <img src={img} className="w-full h-full object-cover" alt={`Miniaturka ${idx + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}