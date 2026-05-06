'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useRouter } from 'next/navigation';

const categorySynonyms: Record<string, string[]> = {
  'Węże': ['wąż', 'waz', 'weze', 'wężyk', 'pyton', 'boa', 'zbożówka', 'mleczny'],
  'Jaszczurki': ['jaszczurka', 'gekon', 'agama', 'kameleon', 'legwan', 'scynk'],
  'Pająki': ['pajak', 'pająk', 'ptasznik', 'skorpion', 'tarantula', 'skakun'],
  'Żaby i Płazy': ['zaba', 'żaba', 'plaz', 'płaz', 'drzewołaz', 'kumak', 'traszka'],
  'Owady': ['owad', 'karmówka', 'swierszcz', 'świerszcz', 'modliszka', 'karaczan', 'mrówki', 'straszyk'],
  'Akcesoria': ['sprzet', 'sprzęt', 'kabel', 'mata', 'zarowka', 'żarówka', 'lampa', 'termostat', 'pęseta'],
  'Terraria': ['terrarium', 'box', 'zbiornik', 'faunabox', 'szkło', 'pvc'],
  'Pokarm': ['myszy', 'szczury', 'karma', 'mrożonka', 'mrozonka', 'suplement', 'witaminy', 'wapń']
};

const POLISH_VOIVODESHIPS = [
  'Cała Polska', 'Dolnośląskie', 'Kujawsko-pomorskie', 'Lubelskie', 'Lubuskie',
  'Łódzkie', 'Małopolskie', 'Mazowieckie', 'Opolskie', 'Podkarpackie',
  'Podlaskie', 'Pomorskie', 'Śląskie', 'Świętokrzyskie', 'Warmińsko-mazurskie',
  'Wielkopolskie', 'Zachodniopomorskie'
];

const CITIES_BY_VOIVODESHIP: Record<string, string[]> = {
  'Dolnośląskie': ['Wrocław', 'Wałbrzych', 'Legnica', 'Jelenia Góra', 'Lubin', 'Głogów', 'Świdnica', 'Bolesławiec', 'Oleśnica', 'Oława', 'Inne...'],
  'Kujawsko-pomorskie': ['Bydgoszcz', 'Toruń', 'Włocławek', 'Grudziądz', 'Inowrocław', 'Brodnica', 'Świecie', 'Chełmno', 'Inne...'],
  'Lubelskie': ['Lublin', 'Zamość', 'Chełm', 'Biała Podlaska', 'Puławy', 'Świdnik', 'Kraśnik', 'Łuków', 'Biłgoraj', 'Inne...'],
  'Lubuskie': ['Zielona Góra', 'Gorzów Wielkopolski', 'Nowa Sól', 'Żary', 'Żagań', 'Świebodzin', 'Międzyrzecz', 'Inne...'],
  'Łódzkie': ['Łódź', 'Piotrków Trybunalski', 'Pabianice', 'Tomaszów Mazowiecki', 'Bełchatów', 'Zgierz', 'Skierniewice', 'Radomsko', 'Kutno', 'Inne...'],
  'Małopolskie': ['Kraków', 'Tarnów', 'Nowy Sącz', 'Oświęcim', 'Chrzanów', 'Olkusz', 'Nowy Targ', 'Bochnia', 'Gorlice', 'Zakopane', 'Inne...'],
  'Mazowieckie': ['Warszawa', 'Radom', 'Płock', 'Siedlce', 'Pruszków', 'Legionowo', 'Ostrołęka', 'Piaseczno', 'Otwock', 'Ciechanów', 'Inne...'],
  'Opolskie': ['Opole', 'Kędzierzyn-Koźle', 'Nysa', 'Brzeg', 'Kluczbork', 'Prudnik', 'Strzelce Opolskie', 'Inne...'],
  'Podkarpackie': ['Rzeszów', 'Przemyśl', 'Stalowa Wola', 'Mielec', 'Tarnobrzeg', 'Krosno', 'Dębica', 'Jarosław', 'Sanok', 'Jasło', 'Inne...'],
  'Podlaskie': ['Białystok', 'Suwałki', 'Łomża', 'Augustów', 'Bielsk Podlaski', 'Zambrów', 'Grajewo', 'Hajnówka', 'Inne...'],
  'Pomorskie': ['Gdańsk', 'Gdynia', 'Sopot', 'Słupsk', 'Tczew', 'Wejherowo', 'Rumia', 'Starogard Gdański', 'Chojnice', 'Malbork', 'Inne...'],
  'Śląskie': ['Katowice', 'Częstochowa', 'Sosnowiec', 'Gliwice', 'Zabrze', 'Bielsko-Biała', 'Bytom', 'Rybnik', 'Ruda Śląska', 'Tychy', 'Dąbrowa Górnicza', 'Chorzów', 'Inne...'],
  'Świętokrzyskie': ['Kielce', 'Ostrowiec Świętokrzyski', 'Starachowice', 'Skarżysko-Kamienna', 'Sandomierz', 'Końskie', 'Inne...'],
  'Warmińsko-mazurskie': ['Olsztyn', 'Elbląg', 'Ełk', 'Ostróda', 'Iława', 'Giżycko', 'Kętrzyn', 'Szczytno', 'Mrągowo', 'Inne...'],
  'Wielkopolskie': ['Poznań', 'Kalisz', 'Konin', 'Piła', 'Ostrów Wielkopolski', 'Gniezno', 'Leszno', 'Swarzędz', 'Luboń', 'Śrem', 'Inne...'],
  'Zachodniopomorskie': ['Szczecin', 'Koszalin', 'Świnoujście', 'Stargard', 'Kołobrzeg', 'Szczecinek', 'Police', 'Wałcz', 'Białogard', 'Inne...']
};

// 🔥 SUPER-MOC WYSZUKIWARKI: Tolerancja na błędy ortograficzne i literówki
const normalizeFuzzy = (str: string) => {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Usuwa ogonki (ą, ę -> a, e)
    .toLowerCase()
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9\s]/g, '') // Usuwa znaki specjalne
    .replace(/(.)\1+/g, '$1'); // Usuwa podwójne litery (Correlophus -> corelofus, Terrarium -> terarium)
};

const isFuzzyMatch = (text: string, query: string) => {
  if (!text || !query) return false;
  const nText = normalizeFuzzy(text);
  const nQuery = normalizeFuzzy(query);
  const queryWords = nQuery.split(/\s+/).filter(w => w.length > 0);
  
  if (queryWords.length === 0) return false;
  // Każde wpisane słowo musi się znaleźć w tytule/nazwie (niezależnie od kolejności!)
  return queryWords.every(word => nText.includes(word));
};

interface SearchBarProps {
  initialQuery?: string;
  className?: string;
}

export default function SearchBar({ initialQuery = '', className = '' }: SearchBarProps) {
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  const [speciesList, setSpeciesList] = useState<any[]>([]); 
  const [suggestedListings, setSuggestedListings] = useState<any[]>([]); 
  
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isSearchingDB, setIsSearchingDB] = useState(false); 
  
  const [isFiltersModalOpen, setIsFiltersModalOpen] = useState(false);
  const [selectedParentCategory, setSelectedParentCategory] = useState('');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedVoivodeship, setSelectedVoivodeship] = useState('Cała Polska');
  const [selectedCity, setSelectedCity] = useState(''); // Zmienione na kaskadowe
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedCondition, setSelectedCondition] = useState(''); 

  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const [isSubCatDropdownOpen, setIsSubCatDropdownOpen] = useState(false);
  const [isWojDropdownOpen, setIsWojDropdownOpen] = useState(false);

  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: catData } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
      if (catData) setDbCategories(catData);

      const { data: speciesData } = await supabase.from('species').select('id, name, latin_name');
      if (speciesData) setSpeciesList(speciesData);
    };
    fetchInitialData();
  }, []);

  const parentCategories = dbCategories.filter(c => !c.parent_id);
  const childCategories = dbCategories.filter(c => c.parent_id);
  const selectedParentId = parentCategories.find(c => c.name === selectedParentCategory)?.id;

  const animalCategories = parentCategories.filter(c => c.requires_species !== false);
  const hardwareCategories = parentCategories.filter(c => c.requires_species === false);
  const isHardwareSelected = hardwareCategories.some(c => c.name === selectedParentCategory);

  useEffect(() => {
    if (!isHardwareSelected) setSelectedCondition('');
  }, [isHardwareSelected]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) setIsSuggestionsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // -------------------------------------------------------------
  // MÓZG WYSZUKIWARKI: Tolerancyjne przeszukiwanie
  // -------------------------------------------------------------
  const matchedCategories = dbCategories.filter(c => 
    isFuzzyMatch(c.name, searchQuery) || 
    (categorySynonyms[c.name] && categorySynonyms[c.name].some(alias => isFuzzyMatch(alias, searchQuery)))
  );
  
  const matchedParents = matchedCategories.filter(c => !c.parent_id).slice(0, 2);
  const matchedSubs = matchedCategories.filter(c => c.parent_id).slice(0, 3);

  const matchedSpecies = speciesList.filter(s => 
    (searchQuery.length >= 2) && (isFuzzyMatch(s.name, searchQuery) || isFuzzyMatch(s.latin_name, searchQuery))
  );
  const topMatchedSpecies = matchedSpecies.slice(0, 3); 

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSuggestedListings([]);
      setIsSearchingDB(false);
      return;
    }
    setIsSearchingDB(true);
    
    const delayDebounceFn = setTimeout(async () => {
      let query = supabase.from('listings').select('id, title, price, image_url, category').eq('status', 'active').order('ranking_score', { ascending: false }).limit(3);

      let orStrings = [];
      const words = searchQuery.trim().split(/\s+/).filter(w => w.length > 1);
      
      // Szukanie w tytule (każde wpisane słowo musi być w tytule)
      if (words.length > 0) {
        const titleAnds = words.map(w => `title.ilike.%${w}%`).join(',');
        orStrings.push(`and(${titleAnds})`);
      }

      // Szukanie w kategoriach
      if (matchedCategories.length > 0) {
        orStrings.push(`category.in.(${matchedCategories.map(c => `"${c.name}"`).join(',')})`);
      }

      // Szukanie w Gatunkach (Łacina i Polskie)
      if (matchedSpecies.length > 0) {
        const topSpeciesIds = matchedSpecies.slice(0, 20).map(s => `"${s.id}"`);
        orStrings.push(`species_id.in.(${topSpeciesIds.join(',')})`);
      }

      if (orStrings.length > 0) {
        query = query.or(orStrings.join(','));
      }

      const { data } = await query;
      if (data) setSuggestedListings(data);
      setIsSearchingDB(false);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, dbCategories, speciesList]); 

  const applySearch = (newQuery: string, overrideCategory?: string) => {
    setIsSuggestionsOpen(false);
    setIsFiltersModalOpen(false);
    
    const params = new URLSearchParams();
    if (newQuery) params.append('q', newQuery); 

    const finalCategory = overrideCategory || selectedSubcategory || selectedParentCategory;

    if (selectedVoivodeship !== 'Cała Polska') params.append('woj', selectedVoivodeship);
    if (selectedCity && selectedCity !== 'Inne...') params.append('loc', selectedCity);
    if (minPrice) params.append('min', minPrice);
    if (maxPrice) params.append('max', maxPrice);
    if (selectedCondition) params.append('condition', selectedCondition); 

    if (finalCategory && (!newQuery || newQuery.toLowerCase() === finalCategory.toLowerCase())) {
      router.push(`/kategoria/${encodeURIComponent(finalCategory.toLowerCase())}?${params.toString()}`);
    } else {
      if (finalCategory) params.append('category', finalCategory);
      router.push(`/szukaj?${params.toString()}`);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (matchedParents.length === 1 && searchQuery.toLowerCase().trim() !== matchedParents[0].name.toLowerCase()) {
       applySearch(matchedParents[0].name, matchedParents[0].name);
    } else {
       applySearch(searchQuery);
    }
  };

  const isFilterActive = selectedParentCategory || selectedVoivodeship !== 'Cała Polska' || selectedCity || minPrice || maxPrice || selectedCondition;

  return (
    <div className={`relative w-full ${className}`} ref={suggestionsRef}>
      
      {/* GŁÓWNY PASEK */}
      <form onSubmit={handleSearchSubmit} className="relative z-50 flex flex-row items-center bg-white border border-gray-200 rounded-xl p-1 focus-within:border-green-500 transition-all shadow-sm w-full animate-in zoom-in-95 duration-300">
        <div className="flex-1 relative flex items-center bg-transparent rounded-xl px-2 py-0.5">
          <input type="text" placeholder="Szukaj gatunku lub sprzętu..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setIsSuggestionsOpen(true); }} onFocus={() => setIsSuggestionsOpen(true)} className="w-full bg-transparent border-none py-1.5 px-1 outline-none font-bold text-gray-900 placeholder:font-medium placeholder:text-gray-400 text-sm md:text-base" />
        </div>
        <div className="w-px h-6 bg-gray-200 mx-1"></div>
        <button type="button" onClick={() => setIsFiltersModalOpen(true)} className="flex items-center gap-1.5 text-gray-500 hover:text-green-600 px-2 py-1.5 md:px-3 md:py-2 rounded-lg font-bold text-sm transition-colors relative">
          {isFilterActive && <span className="absolute top-1 right-1 md:right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" /></svg>
          <span className="hidden md:block">Filtry</span>
        </button>
        <button type="submit" className="bg-black text-white px-3 py-1.5 md:px-5 md:py-2 rounded-lg font-black text-sm hover:bg-gray-800 transition-colors shrink-0 flex items-center justify-center ml-1">
          <span className="md:hidden"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg></span>
          <span className="hidden md:block">Szukaj</span>
        </button>
      </form>

      {/* DROPDOWN PODPOWIEDZI */}
      {isSuggestionsOpen && searchQuery.length >= 2 && (
        <div className="absolute top-full left-0 right-0 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.12)] z-[9999] animate-in fade-in slide-in-from-top-2 overflow-hidden">
          <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
            
            {(matchedParents.length > 0 || matchedSubs.length > 0) && (
              <div className="mb-2">
                <p className="text-[9px] font-black uppercase text-gray-400 px-3 py-1.5 tracking-widest">Działy i Kategorie</p>
                {matchedParents.map(cat => <button key={cat.id} type="button" onClick={() => applySearch(cat.name, cat.name)} className="w-full text-left flex flex-col px-3 py-2 hover:bg-gray-50 rounded-lg transition group"><span className="font-bold text-green-600 group-hover:text-green-700 transition text-sm">{cat.name}</span></button>)}
                {matchedSubs.map(cat => <button key={cat.id} type="button" onClick={() => applySearch(cat.name, cat.name)} className="w-full text-left flex flex-col px-3 py-2 hover:bg-gray-50 rounded-lg transition group"><span className="font-bold text-gray-900 group-hover:text-green-600 transition text-sm">{cat.name}</span></button>)}
              </div>
            )}

            {topMatchedSpecies.length > 0 && (
              <div className="mb-2">
                <p className="text-[9px] font-black uppercase text-blue-400 px-3 py-1.5 tracking-widest flex items-center gap-1"><span>🧬</span> Gatunki</p>
                {topMatchedSpecies.map(s => (
                  <button key={s.id} type="button" onClick={() => applySearch(s.name)} className="w-full text-left flex flex-col px-3 py-2 hover:bg-blue-50 rounded-lg transition group">
                    <span className="font-bold text-gray-900 group-hover:text-blue-700 transition text-sm">{s.name}</span>
                    {s.latin_name && <span className="text-[10px] font-medium text-gray-400 italic truncate w-full group-hover:text-blue-500 transition">{s.latin_name}</span>}
                  </button>
                ))}
              </div>
            )}

            {((matchedParents.length > 0 || matchedSubs.length > 0) || topMatchedSpecies.length > 0) && suggestedListings.length > 0 && (
              <div className="h-px bg-gray-100 mx-3 my-1"></div>
            )}

            <div className="mt-1">
               <p className="text-[9px] font-black uppercase text-amber-500 px-3 py-1.5 tracking-widest flex items-center gap-1"><span>★</span> Najlepsze trafienia</p>
               {isSearchingDB ? (
                 <div className="px-3 py-4 text-center"><span className="text-xs font-bold text-gray-400 animate-pulse">Szukam w bazie...</span></div>
               ) : suggestedListings.length > 0 ? (
                 suggestedListings.map(listing => (
                   <button key={listing.id} type="button" onClick={() => router.push(`/ogloszenie/${listing.id}`)} className="w-full text-left flex items-center gap-3 px-3 py-2 hover:bg-amber-50 rounded-lg transition group">
                     <div className="w-10 h-10 bg-gray-100 rounded-md overflow-hidden shrink-0 border border-gray-200">
                        {listing.image_url ? <img src={listing.image_url} alt={listing.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">📸</div>}
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-sm font-bold text-gray-900 truncate group-hover:text-amber-700 transition">{listing.title}</p>
                       <p className="text-[10px] font-black text-green-600 uppercase tracking-wider">{listing.price} PLN</p>
                     </div>
                   </button>
                 ))
               ) : (
                 <div className="px-3 py-3"><span className="text-xs font-medium text-gray-400">Brak ogłoszeń.</span></div>
               )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL FILTRÓW */}
      {isFiltersModalOpen && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] z-[99999] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsFiltersModalOpen(false)}></div>
          <div className="relative bg-white w-full sm:w-[500px] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90dvh] sm:max-h-[85dvh] animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300">
            
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-3xl sm:rounded-t-3xl shrink-0">
              <h3 className="font-black text-xl text-gray-900">Filtruj wyniki</h3>
              <button onClick={() => setIsFiltersModalOpen(false)} className="text-gray-400 hover:text-red-500 bg-gray-50 p-2 rounded-full transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-8 custom-scrollbar bg-white">
              
              <div className="space-y-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-2"><span className="text-xl">🐍</span> Co Cię interesuje?</h4>
                <div className="flex flex-col border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <button type="button" onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)} className="w-full flex justify-between items-center px-4 py-3.5 bg-gray-50 hover:bg-gray-100 transition">
                    <span className="font-bold text-gray-900">{selectedParentCategory || 'Wszystkie działy'}</span>
                    <svg className={`w-4 h-4 text-gray-500 transform transition-transform duration-300 ${isCatDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                  </button>
                  {isCatDropdownOpen && (
                    <div className="max-h-60 overflow-y-auto bg-white border-t border-gray-100 flex flex-col animate-in slide-in-from-top-2">
                      <button onClick={() => { setSelectedParentCategory(''); setIsCatDropdownOpen(false); setSelectedSubcategory(''); }} className="text-left px-4 py-3 hover:bg-green-50 font-bold text-sm text-gray-700">Wszystkie działy</button>
                      {animalCategories.length > 0 && <div className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 border-y border-gray-100">🦎 Zwierzęta</div>}
                      {animalCategories.map(c => <button key={c.id} onClick={() => { setSelectedParentCategory(c.name); setIsCatDropdownOpen(false); setSelectedSubcategory(''); }} className="text-left px-4 py-3 hover:bg-green-50 font-bold text-sm text-gray-900 border-b border-gray-50 last:border-0">{c.name}</button>)}
                      {hardwareCategories.length > 0 && <div className="px-4 py-2 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 border-y border-gray-100">📦 Sprzęt i Pokarm</div>}
                      {hardwareCategories.map(c => <button key={c.id} onClick={() => { setSelectedParentCategory(c.name); setIsCatDropdownOpen(false); setSelectedSubcategory(''); }} className="text-left px-4 py-3 hover:bg-green-50 font-bold text-sm text-gray-900 border-b border-gray-50 last:border-0">{c.name}</button>)}
                    </div>
                  )}
                </div>
                {selectedParentId && childCategories.filter(c => c.parent_id === selectedParentId).length > 0 && (
                  <div className="flex flex-col border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white animate-in slide-in-from-top-2">
                    <button type="button" onClick={() => setIsSubCatDropdownOpen(!isSubCatDropdownOpen)} className="w-full flex justify-between items-center px-4 py-3.5 bg-gray-50 hover:bg-gray-100 transition">
                      <span className="font-bold text-gray-900">{selectedSubcategory || 'Wybierz podkategorię...'}</span>
                      <svg className={`w-4 h-4 text-gray-500 transform transition-transform duration-300 ${isSubCatDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                    </button>
                    {isSubCatDropdownOpen && (
                      <div className="max-h-48 overflow-y-auto bg-white border-t border-gray-100 flex flex-col">
                        <button onClick={() => { setSelectedSubcategory(''); setIsSubCatDropdownOpen(false); }} className="text-left px-4 py-3 hover:bg-green-50 font-bold text-sm text-gray-700">Wszystkie z tego działu</button>
                        {childCategories.filter(c => c.parent_id === selectedParentId).map(c => <button key={c.id} onClick={() => { setSelectedSubcategory(c.name); setIsSubCatDropdownOpen(false); }} className="text-left px-4 py-3 hover:bg-green-50 font-bold text-sm text-gray-900 border-t border-gray-50">{c.name}</button>)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isHardwareSelected && (
                <>
                  <div className="h-px w-full bg-gray-100"></div>
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <h4 className="font-bold text-gray-900 flex items-center gap-2"><span className="text-xl">🏷️</span> Stan przedmiotu</h4>
                    <div className="flex flex-wrap gap-2">
                      {[{ value: '', label: 'Wszystkie' }, { value: 'new', label: 'Nowy' }, { value: 'used', label: 'Używany' }, { value: 'damaged', label: 'Uszkodzony' }].map((cond) => (
                        <button key={cond.value} type="button" onClick={() => setSelectedCondition(cond.value)} className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${selectedCondition === cond.value ? 'bg-black text-white border-black shadow-md' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                          {cond.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="h-px w-full bg-gray-100"></div>

              {/* LOKALIZACJA - KASKADOWA */}
              <div className="space-y-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-2"><span className="text-xl">📍</span> Lokalizacja</h4>
                
                <div className="flex flex-col border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <button type="button" onClick={() => setIsWojDropdownOpen(!isWojDropdownOpen)} className="w-full flex justify-between items-center px-4 py-3.5 bg-gray-50 hover:bg-gray-100 transition">
                    <span className="font-bold text-gray-900">{selectedVoivodeship}</span>
                    <svg className={`w-4 h-4 text-gray-500 transform transition-transform duration-300 ${isWojDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                  </button>
                  {isWojDropdownOpen && (
                    <div className="max-h-48 overflow-y-auto bg-white border-t border-gray-100 flex flex-col animate-in slide-in-from-top-2">
                      <button onClick={() => { setSelectedVoivodeship('Cała Polska'); setSelectedCity(''); setIsWojDropdownOpen(false); }} className="text-left px-4 py-3 hover:bg-green-50 font-bold text-sm text-gray-900 border-b border-gray-50">Cała Polska</button>
                      {POLISH_VOIVODESHIPS.map(woj => <button key={woj} onClick={() => { setSelectedVoivodeship(woj); setSelectedCity(''); setIsWojDropdownOpen(false); }} className="text-left px-4 py-3 hover:bg-green-50 font-bold text-sm text-gray-900 border-b border-gray-50 last:border-0">{woj}</button>)}
                    </div>
                  )}
                </div>

                {selectedVoivodeship !== 'Cała Polska' && (
                  <div className="relative animate-in slide-in-from-top-2">
                    <select 
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 block pl-4 pr-10 py-3.5 outline-none font-bold cursor-pointer transition-all shadow-sm hover:bg-gray-100"
                    >
                      <option value="">Wszystkie miasta ({selectedVoivodeship})</option>
                      {CITIES_BY_VOIVODESHIP[selectedVoivodeship]?.filter(c => c !== 'Inne...').map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px w-full bg-gray-100"></div>

              <div className="space-y-4">
                <h4 className="font-bold text-gray-900 flex items-center gap-2"><span className="text-xl">💵</span> Cena (PLN)</h4>
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <input type="number" placeholder="Od" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 block p-4 pl-5 outline-none font-bold placeholder:font-medium placeholder:text-gray-400 shadow-sm transition-all" />
                    <span className="absolute right-4 top-4 text-sm font-bold text-gray-400">zł</span>
                  </div>
                  <span className="text-gray-300 font-black">-</span>
                  <div className="flex-1 relative">
                    <input type="number" placeholder="Do" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 block p-4 pl-5 outline-none font-bold placeholder:font-medium placeholder:text-gray-400 shadow-sm transition-all" />
                    <span className="absolute right-4 top-4 text-sm font-bold text-gray-400">zł</span>
                  </div>
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-gray-100 bg-white shrink-0 flex gap-3 pb-6 sm:pb-4 rounded-b-3xl">
              <button onClick={() => { setSelectedParentCategory(''); setSelectedSubcategory(''); setSelectedVoivodeship('Cała Polska'); setSelectedCity(''); setMinPrice(''); setMaxPrice(''); setSelectedCondition(''); }} className="px-5 py-4 bg-gray-50 border border-gray-200 text-gray-600 rounded-xl font-black text-sm hover:bg-gray-100 transition-colors shadow-sm">
                Wyczyść
              </button>
              <button onClick={() => setIsFiltersModalOpen(false)} className="flex-1 bg-black text-white py-4 rounded-xl font-black text-lg hover:bg-gray-800 transition-colors shadow-xl">
                Zapisz filtry
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}