'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<any[]>([]);
  const [filteredListings, setFilteredListings] = useState<any[]>([]);
  
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [dbSpecies, setDbSpecies] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [selectedSpeciesId, setSelectedSpeciesId] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  // --- NOWOŚĆ: STANY DLA CUSTOMOWYCH DROPDOWNÓW ---
  const [openDropdown, setOpenDropdown] = useState<'parent' | 'sub' | 'species' | null>(null);
  const dropdownsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
   const fetchAllData = async () => {
      // Wymuszamy ŚCIŚLE określoną relację po nazwie naszego klucza (fk_seller_profile)
      const { data: ads, error: adsError } = await supabase
        .from('listings')
        .select('*, seller:profiles!fk_seller_profile(username, store_address)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (adsError) {
        console.warn("Błąd relacji w bazie, ładuję tryb awaryjny:", (adsError as any).message || adsError);
        const { data: fallbackAds } = await supabase.from('listings').select('*').eq('status', 'active').order('created_at', { ascending: false });
        if (fallbackAds) {
          setListings(fallbackAds);
          setFilteredListings(fallbackAds);
        }
      } else if (ads) {
        setListings(ads);
        setFilteredListings(ads);
      }

      const { data: cats } = await supabase.from('categories').select('*').eq('is_active', true);
      const { data: specs } = await supabase.from('species').select('*').eq('is_approved', true).order('name');

      if (cats) setDbCategories(cats);
      if (specs) setDbSpecies(specs);
      setLoading(false);
    };
    fetchAllData();
  }, []);

  // Nasłuchiwacz: Zamknij dropdowny klikając poza nie
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownsRef.current && !dropdownsRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let result = listings;

    if (searchTerm) result = result.filter(ad => ad.title.toLowerCase().includes(searchTerm.toLowerCase()));

    if (selectedSubId) {
      const subCat = dbCategories.find(c => c.id === selectedSubId);
      if (subCat) result = result.filter(ad => ad.category === subCat.name);
    } else if (selectedParentId) {
      const parentCat = dbCategories.find(c => c.id === selectedParentId);
      const childNames = dbCategories.filter(c => c.parent_id === selectedParentId).map(c => c.name);
      const allowedCategoryNames = parentCat ? [parentCat.name, ...childNames] : [];
      result = result.filter(ad => allowedCategoryNames.includes(ad.category));
    }

    if (selectedSpeciesId) result = result.filter(ad => ad.species_id === selectedSpeciesId);
    if (minPrice) result = result.filter(ad => ad.price >= parseFloat(minPrice));
    if (maxPrice) result = result.filter(ad => ad.price <= parseFloat(maxPrice));

    setFilteredListings(result);
  }, [listings, searchTerm, selectedParentId, selectedSubId, selectedSpeciesId, minPrice, maxPrice, dbCategories]);

  // POMOCNICY UI
  const mainCats = dbCategories.filter(c => !c.parent_id);
  const subCats = dbCategories.filter(c => c.parent_id === selectedParentId);
  const currentCatObj = selectedSubId ? dbCategories.find(c => c.id === selectedSubId) : dbCategories.find(c => c.id === selectedParentId);
  const showSpeciesFilter = currentCatObj ? currentCatObj.requires_species : true;

  const availableSpecies = dbSpecies.filter(s => {
    // 1. Jeśli wybrano podkategorię (np. Pytony) - bierzemy tylko gatunki przypisane do niej
    if (selectedSubId) return s.category_id === selectedSubId;
    
    // 2. Jeśli wybrano kategorię główną (np. Węże) - bierzemy gatunki z głównej ORAZ z jej podkategorii
    if (selectedParentId) {
      const childIds = dbCategories.filter(c => c.parent_id === selectedParentId).map(c => c.id);
      return s.category_id === selectedParentId || childIds.includes(s.category_id);
    }
    
    // 3. Brak wybranej kategorii - pokazujemy wszystko
    return true; 
  });

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedParentId('');
    setSelectedSubId('');
    setSelectedSpeciesId('');
    setMinPrice('');
    setMaxPrice('');
  };

  if (loading) return <div className="flex justify-center items-center h-screen font-black text-gray-400 text-2xl animate-pulse">Ładowanie giełdy...</div>;

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      
      <section className="bg-black text-white pt-20 pb-20 md:pb-28 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-green-500 via-black to-black"></div>
        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-7xl font-black mb-6 tracking-tight">Egzotyka w jednym miejscu.</h1>
          <p className="text-lg md:text-2xl text-gray-400 font-medium mb-10">Największa giełda terrarystyczna. Znajdź wymarzonego zwierzaka.</p>
          <Link href="/dodaj-ogloszenie" className="bg-green-500 text-black font-black px-8 py-4 rounded-full text-lg hover:bg-green-400 transition shadow-[0_0_40px_rgba(34,197,94,0.3)]">
            + Dodaj Ogłoszenie
          </Link>
        </div>
      </section>

      {/* FILTRY */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 -mt-8 md:-mt-16 relative z-20">
        <div className="bg-white rounded-3xl p-4 md:p-8 shadow-2xl border border-gray-100" ref={dropdownsRef}>
          
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🔍</span>
              <input 
                type="text" 
                placeholder="Czego szukasz?" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-black font-bold"
              />
            </div>
            <button 
              onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)} 
              className="md:hidden px-6 py-4 bg-black text-white font-bold rounded-2xl transition"
            >
              {isMobileFiltersOpen ? 'Ukryj filtry' : '⚙️ Pokaż filtry'}
            </button>
            <button onClick={clearFilters} className="hidden md:block px-6 py-4 bg-gray-100 text-gray-600 font-bold rounded-2xl hover:bg-gray-200 transition">
              Wyczyść filtry
            </button>
          </div>

          <div className={`${isMobileFiltersOpen ? 'grid' : 'hidden'} md:grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-2`}>
            
            {/* 1. CUSTOM DROPDOWN: Kategoria Główna */}
            <div className="relative">
              <button 
                onClick={() => setOpenDropdown(openDropdown === 'parent' ? null : 'parent')}
                className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none hover:border-gray-300 focus:ring-2 focus:ring-black transition font-medium truncate"
              >
                <span className="truncate">{selectedParentId ? mainCats.find(c => c.id === selectedParentId)?.name : 'Wszystkie działy'}</span>
                <span className={`text-[10px] transition-transform ${openDropdown === 'parent' ? 'rotate-180' : ''}`}>▼</span>
              </button>
              
              {openDropdown === 'parent' && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95">
                  <button 
                    onClick={() => { setSelectedParentId(''); setSelectedSubId(''); setSelectedSpeciesId(''); setOpenDropdown(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 font-bold text-gray-500 border-b border-gray-50"
                  >
                    Wszystkie działy
                  </button>
                  {mainCats.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => { setSelectedParentId(c.id); setSelectedSubId(''); setSelectedSpeciesId(''); setOpenDropdown(null); }}
                      className={`w-full text-left px-4 py-3 hover:bg-green-50 transition ${selectedParentId === c.id ? 'bg-green-50 text-green-700 font-black' : 'text-gray-900 font-medium'}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. CUSTOM DROPDOWN: Podkategoria */}
            <div className="relative">
              <button 
                onClick={() => setOpenDropdown(openDropdown === 'sub' ? null : 'sub')}
                disabled={!selectedParentId || subCats.length === 0}
                className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none hover:border-gray-300 focus:ring-2 focus:ring-black transition font-medium disabled:opacity-50 disabled:cursor-not-allowed truncate"
              >
                <span className="truncate">{selectedSubId ? subCats.find(c => c.id === selectedSubId)?.name : 'Wszystkie podkategorie'}</span>
                <span className={`text-[10px] transition-transform ${openDropdown === 'sub' ? 'rotate-180' : ''}`}>▼</span>
              </button>
              
              {openDropdown === 'sub' && !(!selectedParentId || subCats.length === 0) && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95">
                  <button 
                    onClick={() => { setSelectedSubId(''); setSelectedSpeciesId(''); setOpenDropdown(null); }}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 font-bold text-gray-500 border-b border-gray-50"
                  >
                    Wszystkie podkategorie
                  </button>
                  {subCats.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => { setSelectedSubId(c.id); setSelectedSpeciesId(''); setOpenDropdown(null); }}
                      className={`w-full text-left px-4 py-3 hover:bg-green-50 transition ${selectedSubId === c.id ? 'bg-green-50 text-green-700 font-black' : 'text-gray-900 font-medium'}`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. CUSTOM DROPDOWN: Gatunek */}
            {showSpeciesFilter ? (
              <div className="relative">
                <button 
                  onClick={() => setOpenDropdown(openDropdown === 'species' ? null : 'species')}
                  disabled={availableSpecies.length === 0}
                  className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none hover:border-gray-300 focus:ring-2 focus:ring-black transition font-medium disabled:opacity-50 disabled:cursor-not-allowed truncate"
                >
                  <span className="truncate">
                    {selectedSpeciesId 
                      ? availableSpecies.find(s => s.id === selectedSpeciesId)?.name 
                      : (availableSpecies.length === 0 ? 'Brak gatunków' : 'Wszystkie gatunki')}
                  </span>
                  <span className={`text-[10px] transition-transform ${openDropdown === 'species' ? 'rotate-180' : ''}`}>▼</span>
                </button>
                
                {openDropdown === 'species' && availableSpecies.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto animate-in fade-in zoom-in-95">
                    <button 
                      onClick={() => { setSelectedSpeciesId(''); setOpenDropdown(null); }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 font-bold text-gray-500 border-b border-gray-50"
                    >
                      Wszystkie gatunki
                    </button>
                    {availableSpecies.map(s => (
                      <button 
                        key={s.id} 
                        onClick={() => { setSelectedSpeciesId(s.id); setOpenDropdown(null); }}
                        className={`w-full text-left px-4 py-3 hover:bg-green-50 transition flex flex-col ${selectedSpeciesId === s.id ? 'bg-green-50 border-l-4 border-green-500' : ''}`}
                      >
                        <span className={`font-bold ${selectedSpeciesId === s.id ? 'text-green-800' : 'text-gray-900'}`}>{s.name}</span>
                        <span className="text-[10px] text-gray-500 italic">{s.latin_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-gray-400 font-medium flex items-center justify-center truncate">
                Nie wymaga gatunku
              </div>
            )}

            {/* 4. Cena Od - Do */}
            <div className="flex gap-2">
              <input type="number" placeholder="Cena od" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 outline-none focus:border-gray-400 font-medium text-sm transition" />
              <input type="number" placeholder="Cena do" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="w-1/2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 outline-none focus:border-gray-400 font-medium text-sm transition" />
            </div>
            
            <button onClick={clearFilters} className="md:hidden mt-2 px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl active:bg-gray-200 transition">
              Wyczyść
            </button>
          </div>
        </div>
      </section>

      {/* --- WYNIKI WYSZUKIWANIA --- */}
    {/* --- WYNIKI WYSZUKIWANIA --- */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 mt-8 md:mt-12">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl md:text-2xl font-black text-gray-900">Znalezione ogłoszenia</h2>
          <span className="bg-black text-white px-3 py-1 rounded-full text-sm font-bold">{filteredListings.length}</span>
        </div>

        {filteredListings.length === 0 ? (
          <div className="bg-white p-10 md:p-20 rounded-3xl border text-center">
            <div className="text-5xl md:text-6xl mb-4 opacity-50">🏜️</div>
            <h3 className="text-xl md:text-2xl font-black text-gray-800 mb-2">Pustynia...</h3>
            <p className="text-gray-500 font-medium text-sm md:text-base">Brak ogłoszeń spełniających Twoje kryteria.</p>
            <button onClick={clearFilters} className="mt-6 bg-black text-white px-6 py-2 rounded-xl font-bold hover:bg-gray-800 transition">
              Wyczyść filtry
            </button>
          </div>
        ) : (
          /* Zmiana siatki: Na mobile 1 kolumna, od tabletów 2, potem 3 i 4 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {filteredListings.map(ad => (
              <Link 
                key={ad.id} 
                href={`/ogloszenie/${ad.id}`} 
                // FLEX MAGIA: Na mobile poziomo (flex-row), na desktopie pionowo (md:flex-col)
                className="group bg-white rounded-2xl md:rounded-3xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-gray-300 transition duration-300 flex flex-row md:flex-col"
              >
                {/* ZDJĘCIE - Stała szerokość na mobile (w-32 lub 40%), pełna na desktopie */}
                <div className="w-36 sm:w-48 md:w-full aspect-square bg-gray-100 relative overflow-hidden shrink-0">
                  {ad.image_url ? (
                    <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                      <span className="text-3xl mb-1">📸</span>
                    </div>
                  )}
                  {ad.cites_certificate && (
                    <div className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] md:text-[10px] font-black px-1.5 py-0.5 rounded uppercase shadow-md flex items-center gap-1 z-10">
                      <span>📜</span> CITES
                    </div>
                  )}
                </div>

                {/* TREŚĆ KARTY - min-w-0 pozwala na prawidłowe ucinanie długich tekstów (...) */}
                <div className="p-3 md:p-5 flex flex-col flex-1 min-w-0">
                  
                  {/* TAGI: Kategoria i Stan */}
                  <div className="mb-1.5 flex flex-wrap gap-1.5 items-center">
                    <span className="bg-gray-100 text-gray-600 text-[9px] md:text-[10px] font-black uppercase px-2 py-1 rounded truncate max-w-[120px]">
                      {ad.category}
                    </span>
                    {ad.condition && (
                      <span className={`text-[9px] md:text-[10px] font-black uppercase px-2 py-1 rounded shrink-0 ${ad.condition === 'new' ? 'bg-green-100 text-green-700' : ad.condition === 'used' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                        {ad.condition === 'new' ? 'Nowy' : ad.condition === 'used' ? 'Używany' : 'Uszk.'}
                      </span>
                    )}
                  </div>
                  
                  {/* TYTUŁ - 2 linijki max, potem kropki (...) */}
                  <h3 className="text-sm md:text-lg font-black text-gray-900 leading-tight mb-2 group-hover:text-green-600 transition line-clamp-2 break-words">
                    {ad.title}
                  </h3>
                  
                 {/* DANE SPRZEDAWCY (Lokalizacja i Nazwa) */}
                  <div className="mt-auto flex flex-col gap-1 mb-2">
                    <div className="flex items-center gap-1.5 text-gray-500 text-[10px] md:text-xs">
                      <span className="shrink-0">📍</span> 
                      <span className="truncate font-medium">{ad.seller?.store_address || 'Polska'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-500 text-[10px] md:text-xs">
                      <span className="shrink-0">👤</span> 
                      <span className="truncate font-bold">{ad.seller?.username || 'Anonim'}</span>
                    </div>
                  </div>

                  {/* CENA */}
                  <div className="pt-2 border-t border-gray-100 mt-1">
                    <p className="text-lg md:text-2xl font-black text-green-600 leading-none truncate">
                      {ad.price} <span className="text-xs md:text-sm text-green-700/70">PLN</span>
                    </p>
                  </div>

                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}