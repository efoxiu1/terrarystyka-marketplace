'use client';
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function KategoriaPage() {
  const params = useParams();
  const rawNazwa = params.nazwa as string;
  const kategoriaNazwa = decodeURIComponent(rawNazwa);

  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- STANY ZAKŁADEK ---
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('Wszystkie');
  const [pageTitle, setPageTitle] = useState<string>(kategoriaNazwa);

  useEffect(() => {
    const fetchKategoria = async () => {
      setLoading(true);

      // 1. ODCZYTUJEMY CAŁĄ STRUKTURĘ KATEGORII Z BAZY
      const { data: cats, error: catsError } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true);

      if (catsError) {
        console.error('Błąd kategorii:', catsError);
        setLoading(false);
        return;
      }

      let categoriesToFetch = [kategoriaNazwa];
      let foundSubcats: string[] = [];
      let initialTab = 'Wszystkie';
      let heroTitle = kategoriaNazwa;

      if (cats && cats.length > 0) {
        // Szukamy kategorii, ignorując wielkość liter z URL
        const currentCat = cats.find(c => c.name.toLowerCase() === kategoriaNazwa.toLowerCase());

        if (currentCat) {
          if (!currentCat.parent_id) {
            // OPCJA A: Wszedłeś w GŁÓWNĄ kategorię (np. Węże)
            heroTitle = currentCat.name;
            const children = cats.filter(c => c.parent_id === currentCat.id);
            foundSubcats = children.map(c => c.name);
            
            categoriesToFetch = [currentCat.name, ...foundSubcats];
          } else {
            // OPCJA B: Wszedłeś w PODKATEGORIĘ (np. Pytony)
            const parentCat = cats.find(c => c.id === currentCat.parent_id);
            if (parentCat) {
              heroTitle = parentCat.name; // Ustawiamy tytuł strony na rodzica (Węże)
              const siblings = cats.filter(c => c.parent_id === parentCat.id);
              foundSubcats = siblings.map(c => c.name);
              
              // Pobieramy CAŁĄ rodzinę z bazy, żeby zakładki mogły działać bez przeładowania!
              categoriesToFetch = [parentCat.name, ...foundSubcats];
            } else {
              categoriesToFetch = [currentCat.name];
            }
            // Zaznaczamy od razu zakładkę "Pytony"
            initialTab = currentCat.name;
          }
        }
      }

      setSubcategories(foundSubcats);
      setActiveTab(initialTab);
      setPageTitle(heroTitle);

      // ZABEZPIECZENIE: Zapobiega wysłaniu pustego zapytania do bazy (to wywoływało błąd 406!)
      if (categoriesToFetch.length === 0) {
        setListings([]);
        setLoading(false);
        return;
      }

      // 2. POBIERAMY OGŁOSZENIA (Z prawidłowymi nazwami)
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, price, image_url, condition, city, voivodeship, category')
        .eq('status', 'active')
        .in('category', categoriesToFetch) 
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Błąd pobierania ogłoszeń:', error);
      }

      if (data) setListings(data);
      setLoading(false);
    };

    fetchKategoria();
  }, [kategoriaNazwa]);

  // 3. LOGIKA FILTROWANIA ZAKŁADKAMI
  const filteredListings = activeTab === 'Wszystkie' 
    ? listings 
    : listings.filter(ad => ad.category === activeTab);

  if (loading) {
    return <div className="p-20 text-center font-bold text-gray-400 animate-pulse">Ładowanie działu {kategoriaNazwa}...</div>;
  }

  return (
    <main className="max-w-6xl mx-auto p-4 md:p-6 mt-6 md:mt-10 mb-20 animate-in fade-in">
      
      {/* --- HERO BANNER KATEGORII --- */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-800 text-white rounded-[2rem] md:rounded-[3rem] p-8 md:p-16 mb-8 md:mb-12 shadow-xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 text-8xl md:text-9xl opacity-10">🦎</div>
        <h1 className="text-3xl md:text-6xl font-black capitalize relative z-10">{pageTitle}</h1>
        <p className="mt-3 md:mt-4 text-green-100 font-medium text-sm md:text-lg max-w-2xl relative z-10">
          Przeglądasz dedykowaną sekcję dla kategorii <strong>{pageTitle}</strong>. 
          Odkryj najciekawsze okazy i sprzęt dodany przez naszą społeczność.
        </p>
      </div>

      {/* --- ZAKŁADKI (TABS) PODKATEGORII --- */}
      {subcategories.length > 0 && (
        <div className="mb-8">
          <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar snap-x">
            <button
              onClick={() => setActiveTab('Wszystkie')}
              className={`shrink-0 snap-start px-6 py-3 rounded-full font-bold text-sm transition-all shadow-sm ${
                activeTab === 'Wszystkie' 
                  ? 'bg-black text-white' 
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-black hover:text-black'
              }`}
            >
              Wszystkie ({listings.length})
            </button>
            
            {subcategories.map(subCat => {
              const count = listings.filter(ad => ad.category === subCat).length;
              
              return (
                <button
                  key={subCat}
                  onClick={() => setActiveTab(subCat)}
                  className={`shrink-0 snap-start px-6 py-3 rounded-full font-bold text-sm transition-all shadow-sm ${
                    activeTab === subCat 
                      ? 'bg-black text-white' 
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-black hover:text-black'
                  }`}
                >
                  {subCat} <span className="opacity-60 ml-1">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* --- LISTA OGŁOSZEŃ --- */}
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-xl md:text-2xl font-black text-gray-900">
          Aktywne ogłoszenia
        </h2>
      </div>

      {filteredListings.length === 0 ? (
        <div className="text-center py-16 md:py-24 bg-gray-50 rounded-[2rem] md:rounded-[3rem] border-2 border-dashed border-gray-200">
          <span className="text-5xl md:text-6xl mb-4 block opacity-50">🦗</span>
          <p className="text-gray-500 font-bold text-lg md:text-xl mb-2">Pustki w tym dziale</p>
          <p className="text-gray-400 font-medium text-sm md:text-base px-4">Bądź pierwszym, który wystawi tu ogłoszenie!</p>
          <Link href="/dodaj-ogloszenie" className="inline-block mt-6 bg-black text-white px-6 py-3 md:px-8 md:py-4 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg text-sm md:text-base">
            Dodaj pierwsze ogłoszenie
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredListings.map(ad => (
            <Link key={ad.id} href={`/ogloszenie/${ad.id}`} className="group bg-white rounded-2xl md:rounded-3xl border border-gray-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
              
              {/* ZDJĘCIE */}
              <div className="w-full aspect-square bg-gray-100 relative overflow-hidden shrink-0">
                {ad.image_url ? (
                  <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <span className="text-3xl md:text-4xl">📸</span>
                  </div>
                )}
                {ad.condition && (
                  <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md text-white text-[9px] md:text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest">
                    {ad.condition === 'new' ? 'Nowe' : ad.condition === 'used' ? 'Używane' : 'Uszk.'}
                  </div>
                )}
              </div>

              {/* DANE */}
              <div className="p-3 md:p-4 flex flex-col flex-1">
                <p className="text-[9px] md:text-[10px] font-black text-green-600 uppercase tracking-widest mb-1 truncate">{ad.category}</p>
                
                <h3 className="font-bold text-gray-900 text-sm md:text-base leading-snug mb-2 line-clamp-2 group-hover:text-green-600 transition-colors">
                  {ad.title}
                </h3>
                
                <p className="text-[10px] md:text-xs text-gray-500 font-medium truncate mt-auto mb-2 flex items-center gap-1">
                  📍 {ad.city ? `${ad.city}, ${ad.voivodeship}` : ad.voivodeship || 'Polska'}
                </p>
                
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-lg md:text-xl font-black text-gray-900 truncate">
                    {ad.price} <span className="text-[10px] md:text-xs text-gray-400 font-bold">PLN</span>
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}