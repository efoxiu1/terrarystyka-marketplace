'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

const ITEMS_PER_PAGE = 25;

// 🔥 FUZZY MATCHER DLA WYNIKÓW WYSZUKIWANIA
const normalizeFuzzy = (str: string) => {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ł/g, "l").replace(/[^a-z0-9\s]/g, '').replace(/(.)\1+/g, '$1');
};

const isFuzzyMatch = (text: string, query: string) => {
  if (!text || !query) return false;
  const nText = normalizeFuzzy(text);
  const nQuery = normalizeFuzzy(query);
  const queryWords = nQuery.split(/\s+/).filter(w => w.length > 0);
  if (queryWords.length === 0) return false;
  return queryWords.every(word => nText.includes(word));
};

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [listings, setListings] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [speciesList, setSpeciesList] = useState<any[]>([]); 
  
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  const q = searchParams.get('q');
  const category = searchParams.get('category');
  const woj = searchParams.get('woj');
  const loc = searchParams.get('loc');
  const min = searchParams.get('min');
  const max = searchParams.get('max');
  const condition = searchParams.get('condition');

  const loadListings = async (currentPage: number) => {
    const from = currentPage * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    // Pobranie gatunków z bazy jeśli ich jeszcze nie mamy (żeby rozszyfrować łacinę)
    let currentSpecies = speciesList;
    if (currentSpecies.length === 0) {
      const { data } = await supabase.from('species').select('id, name, latin_name');
      if (data) {
        setSpeciesList(data);
        currentSpecies = data;
      }
    }

    let query = supabase
      .from('listings')
      .select('id, title, price, image_url, category, created_at, condition, voivodeship, city', { count: 'exact' })
      .eq('status', 'active');

    // Proste filtry
    if (category) query = query.eq('category', category);
    if (woj && woj !== 'Cała Polska') query = query.eq('voivodeship', woj);
    if (loc) query = query.eq('city', loc);
    if (min && !isNaN(parseFloat(min))) query = query.gte('price', parseFloat(min));
    if (max && !isNaN(parseFloat(max))) query = query.lte('price', parseFloat(max));
    if (condition) query = query.eq('condition', condition);

    // 🔥 POTEŻNY FILTR WYSZUKIWANIA ('q')
    if (q) {
      let orStrings = [];
      const words = q.trim().split(/\s+/).filter(w => w.length > 1);
      
      // Szukanie w tytule z obsługą wielu słów "AND" 
      if (words.length > 0) {
        const titleAnds = words.map(w => `title.ilike.%${w}%`).join(',');
        orStrings.push(`and(${titleAnds})`);
      }

      // Tłumaczenie łaciny/literówek na czyste ID w bazie
      const matchedSpeciesIds = currentSpecies
        .filter(s => isFuzzyMatch(s.name, q) || isFuzzyMatch(s.latin_name, q))
        .map(s => s.id);

      if (matchedSpeciesIds.length > 0) {
        orStrings.push(`species_id.in.(${matchedSpeciesIds.join(',')})`);
      }

      if (orStrings.length > 0) {
        query = query.or(orStrings.join(','));
      }
    }

    query = query.order('ranking_score', { ascending: false }).order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (!error && data) {
      if (currentPage === 0) {
        setListings(data);
        setTotalCount(count || 0);
      } else {
        setListings(prev => {
          const existingIds = new Set(prev.map(item => item.id));
          return [...prev, ...data.filter(item => !existingIds.has(item.id))];
        });
      }
      setHasMore(data.length === ITEMS_PER_PAGE);
    }
  };

  useEffect(() => {
    setPage(0);
    setHasMore(true);
    setIsLoading(true);
    loadListings(0).finally(() => setIsLoading(false));
  }, [q, category, woj, loc, min, max, condition]);

  useEffect(() => {
    if (page > 0) {
      setIsFetchingMore(true);
      loadListings(page).finally(() => setIsFetchingMore(false));
    }
  }, [page]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoading && !isFetchingMore) {
        setPage((prevPage) => prevPage + 1);
      }
    }, { threshold: 0.1 });

    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isFetchingMore]);

  const removeFilter = (keyToRemove: string) => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete(keyToRemove);
    router.push(`/szukaj?${newParams.toString()}`);
  };

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">{q ? `Wyniki dla: "${q}"` : category ? `Ogłoszenia w: ${category}` : 'Wszystkie ogłoszenia'}</h1>
        <p className="text-sm font-bold text-gray-500">Znaleźliśmy {isLoading ? '...' : totalCount} ogłoszeń</p>
      </div>

      {(q || category || (woj && woj !== 'Cała Polska') || loc || min || max || condition) && (
        <div className="flex flex-wrap gap-2 mb-8">
          <span className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center mr-2">Filtry:</span>
          {category && <button onClick={() => removeFilter('category')} className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition group">Kategoria: {category} <span className="text-green-500 group-hover:text-red-500">✕</span></button>}
          {woj && woj !== 'Cała Polska' && <button onClick={() => removeFilter('woj')} className="flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition group">{woj} <span className="text-gray-400 group-hover:text-red-500">✕</span></button>}
          {loc && <button onClick={() => removeFilter('loc')} className="flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition group">Miasto: {loc} <span className="text-gray-400 group-hover:text-red-500">✕</span></button>}
          {(min || max) && <button onClick={() => { removeFilter('min'); removeFilter('max'); }} className="flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition group">Cena: {min ? `${min} zł` : '0 zł'} - {max ? `${max} zł` : 'Max'} <span className="text-gray-400 group-hover:text-red-500">✕</span></button>}
          {condition && <button onClick={() => removeFilter('condition')} className="flex items-center gap-2 bg-gray-100 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition group">Stan: {condition === 'new' ? 'Nowy' : condition === 'used' ? 'Używany' : 'Uszkodzony'} <span className="text-gray-400 group-hover:text-red-500">✕</span></button>}
          <button onClick={() => router.push('/szukaj')} className="text-xs font-bold text-gray-500 underline hover:text-gray-900 ml-2">Wyczyść wszystko</button>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex flex-col animate-pulse">
              <div className="w-full aspect-square bg-gray-200 rounded-2xl mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            </div>
          ))}
        </div>
      ) : listings.length > 0 ? (
        <div className="flex flex-col">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
            {listings.map((listing) => (
              <Link key={listing.id} href={`/ogloszenie/${listing.id}`} className="group flex flex-col relative bg-white rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <div className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-100 relative border border-gray-100 mb-3">
                  {listing.image_url ? <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" /> : <div className="w-full h-full flex flex-col items-center justify-center text-gray-300"><span className="text-3xl mb-1">📸</span></div>}
                  {listing.condition && <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-widest">{listing.condition === 'new' ? 'Nowe' : listing.condition === 'used' ? 'Używane' : 'Uszkodzone'}</div>}
                </div>
                <div className="flex flex-col flex-1 px-1">
                  <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1 truncate">{listing.category}</p>
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-snug mb-1 line-clamp-2 group-hover:text-green-700 transition-colors">{listing.title}</h3>
                  <p className="text-xs text-gray-500 font-medium truncate mb-2 mt-auto flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                    {listing.city ? `${listing.city}, ${listing.voivodeship}` : listing.voivodeship || 'Cała Polska'}
                  </p>
                  <p className="text-lg font-black text-gray-900 mt-1">{listing.price.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} <span className="text-xs text-gray-500 font-bold">PLN</span></p>
                </div>
              </Link>
            ))}
          </div>
          <div ref={observerTarget} className="w-full py-12 flex justify-center items-center">
            {isFetchingMore ? <div className="w-8 h-8 border-4 border-gray-200 border-t-green-600 rounded-full animate-spin"></div> : hasMore ? <div className="h-4 w-full"></div> : <div className="text-center py-6"><p className="text-sm font-bold text-gray-400 bg-gray-50 px-6 py-3 rounded-full">Dotarłeś na sam dół!</p></div>}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50">
          <div className="text-6xl mb-4 opacity-50">🌵</div>
          <h3 className="text-2xl font-black text-gray-900 mb-2">Brak wyników</h3>
          <p className="text-gray-500 font-medium mb-6 max-w-md">Nie znaleźliśmy ogłoszeń. Spróbuj zmienić filtry.</p>
          <button onClick={() => router.push('/szukaj')} className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition">Wyczyść filtry i szukaj dalej</button>
        </div>
      )}
    </main>
  );
}

export default function SzukajPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div></div>}>
      <SearchResults />
    </Suspense>
  );
}