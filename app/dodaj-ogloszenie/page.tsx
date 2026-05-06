'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// 🔥 SŁOWNIK WOJEWÓDZTW I MIAST (Kaskadowy wybór)
const POLISH_VOIVODESHIPS = [
  'Dolnośląskie', 'Kujawsko-pomorskie', 'Lubelskie', 'Lubuskie',
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

export default function DodajOgloszenie() {
  const router = useRouter();
  
  // --- STANY GŁÓWNE FORMULARZA ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1'); 
  
  // Kategoria
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('new');
  
  // Menu Kategorii
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  // Słownik Gatunków i CITES
  const [speciesList, setSpeciesList] = useState<any[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>('');
  const [customSpeciesName, setCustomSpeciesName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [citesDeclaration, setCitesDeclaration] = useState(false);
  const [citesCertificate, setCitesCertificate] = useState('');
  
  // Zdjęcia
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  
  // 🔥 NOWOŚĆ: LOKALIZACJA
  const [voivodeship, setVoivodeship] = useState('');
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState(''); // Stan dla małych miejscowości, gdy ktoś wybierze "Inne..."

  // Limity i Płatności
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isCheckingLimit, setIsCheckingLimit] = useState(true);
  const [limitStats, setLimitStats] = useState({ current: 0, max: 2 });
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  
  // --- UPROSZCZONE WARIANTY ---
  const [variants, setVariants] = useState<{ id: number, name: string, price: string, stock: string }[]>([]);

  // 1. ŁADOWANIE DANYCH
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: catData } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
      if (catData) setDbCategories(catData);

      const { data: speciesData } = await supabase.from('species').select('*').eq('is_approved', true).order('name');
      if (speciesData) setSpeciesList(speciesData);
    };

    fetchInitialData();

    const savedDraft = localStorage.getItem('ogloszenieDraft');
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.price) setPrice(draft.price);
        if (draft.category) setCategory(draft.category);
        if (draft.condition) setCondition(draft.condition);
        if (draft.selectedSpeciesId) setSelectedSpeciesId(draft.selectedSpeciesId);
        if (draft.searchQuery) setSearchQuery(draft.searchQuery);
        if (draft.customSpeciesName) setCustomSpeciesName(draft.customSpeciesName);
        if (draft.citesDeclaration) setCitesDeclaration(draft.citesDeclaration);
        if (draft.citesCertificate) setCitesCertificate(draft.citesCertificate);
        if (draft.voivodeship) setVoivodeship(draft.voivodeship);
        if (draft.city) setCity(draft.city);
        if (draft.customCity) setCustomCity(draft.customCity);
      } catch (err) {
        console.error("Błąd ładowania brudnopisu", err);
      }
    }
  }, []);

// 2. SPRAWDZANIE LIMITÓW (Zaktualizowane: bierze z purchased_packages)
  useEffect(() => {
    const checkUserLimits = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsCheckingLimit(false); return; }
      setCurrentUser(user);

      // --- LOGIKA LIMITÓW Z CENNIKA ---
      const BASE_LIMIT = 2; // Darmowe miejsca
      const now = new Date().toISOString();
      
      // Pobieramy aktywne pakiety z bazy
      const { data: packages } = await supabase
        .from('purchased_packages')
        .select('slots_added')
        .eq('user_id', user.id)
        .gt('expires_at', now);

      let extraSlots = 0;
      if (packages) {
        extraSlots = packages.reduce((sum, pkg) => sum + pkg.slots_added, 0);
      }

      // Sprawdzamy, ile już mamy aktywnych ogłoszeń
      const { count } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id)
        .eq('status', 'active'); 

      // Ustawiamy zsumowany limit
      setLimitStats({ current: count || 0, max: BASE_LIMIT + extraSlots });
      setIsCheckingLimit(false); 
    };
    checkUserLimits();
  }, []);
  
  // 3. BRUDNOPIS
  useEffect(() => {
    const draft = {
      title, description, price, category, condition, selectedSpeciesId, 
      searchQuery, customSpeciesName, citesDeclaration, citesCertificate,
      voivodeship, city, customCity
    };
    localStorage.setItem('ogloszenieDraft', JSON.stringify(draft));
  }, [title, description, price, category, condition, selectedSpeciesId, searchQuery, customSpeciesName, citesDeclaration, citesCertificate, voivodeship, city, customCity]);

  // 4. DROPDOWNY ZAMYKANIE
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) setIsCategoryDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 5. CZYSZCZENIE WARIANTÓW DLA ZWIERZĄT
  useEffect(() => {
    const selectedCat = dbCategories.find(c => c.name === category);
    if (selectedCat?.requires_species) {
      if (variants.length > 0) setVariants([]); 
    }
  }, [category, dbCategories, variants.length]);

  const mainCats = dbCategories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => dbCategories.filter(c => c.parent_id === parentId);
  
  const getSelectedCategoryPath = () => {
    if (!category) return 'Wybierz kategorię...';
    const selectedCat = dbCategories.find(c => c.name === category);
    if (!selectedCat) return category;
    if (selectedCat.parent_id) {
      const parent = dbCategories.find(c => c.id === selectedCat.parent_id);
      return parent ? `${parent.name} ❯ ${selectedCat.name}` : selectedCat.name;
    }
    return selectedCat.name;
  };

  const handleCategorySelect = (mainCat: any, hasChildren: boolean) => {
    if (hasChildren) {
      setExpandedParentId(prev => prev === mainCat.id ? null : mainCat.id);
    } else {
      setCategory(mainCat.name);
      setIsCategoryDropdownOpen(false);
      if (mainCat.requires_species === false) {
        setSelectedSpeciesId(''); setSearchQuery(''); setCustomSpeciesName(''); setCitesDeclaration(false); setCitesCertificate('');
      }
    }
  };

  const addVariant = () => setVariants([...variants, { id: Date.now(), name: '', price: price || '', stock: '1' }]);
  const removeVariant = (idToRemove: number) => setVariants(variants.filter(v => v.id !== idToRemove));
  const updateVariant = (id: number, field: string, value: string) => setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));

  const selectedCategoryData = dbCategories.find(c => c.name === category);
  const needsSpecies = selectedCategoryData?.requires_species ?? true;
  const isCategoryBig = selectedCategoryData?.is_big ?? false;
  const selectedSpeciesData = speciesList.find(s => s.id === selectedSpeciesId);
  const isCustom = selectedSpeciesId === 'other';
  const isBlocked = needsSpecies && selectedSpeciesData && (selectedSpeciesData.is_igo || selectedSpeciesData.is_dangerous);
  const filteredSpecies = speciesList.filter(species =>
    species.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    species.latin_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImages(prev => [...prev, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  // --- WYSYŁKA FORMULARZA ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (limitStats.current >= limitStats.max) { setShowPaywallModal(true); return; }
    if (isBlocked) return alert('Nie możesz dodać tego gatunku.');
    if (needsSpecies && selectedSpeciesData?.cites_appendix === 'B' && !citesDeclaration) return alert('Musisz zaakceptować oświadczenie CITES.');
    if (needsSpecies && selectedSpeciesData?.cites_appendix === 'A' && !citesCertificate) return alert('Musisz podać numer certyfikatu CITES.');
    if (!currentUser) return alert('Musisz być zalogowany!');
    
    if (!voivodeship) return alert('Wybierz województwo!');
    if (!city) return alert('Wybierz miasto!');
    if (city === 'Inne...' && !customCity) return alert('Wpisz nazwę swojej miejscowości!');

    // 🔥 Ostateczna nazwa miasta
    const finalCity = city === 'Inne...' ? customCity.trim() : city;

    const adStatus = isCustom && needsSpecies ? 'pending' : 'active';
    setIsCheckoutLoading(true); 

    try {
      const uploadedImageUrls: string[] = [];
      if (images.length > 0) {
        const imagePromises = images.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `listings/${fileName}`;
          const { error: uploadError } = await supabase.storage.from('animals').upload(filePath, file);
          if (uploadError) throw new Error('Wystąpił problem z wgraniem zdjęć. Sprawdź połączenie.'); 
          const { data: { publicUrl } } = supabase.storage.from('animals').getPublicUrl(filePath);
          return publicUrl; 
        });
        const results = await Promise.all(imagePromises);
        uploadedImageUrls.push(...results);
      }

      const { data: newListing, error: listingError } = await supabase.from('listings').insert([{
        title,
        description,
        category,
        condition: !needsSpecies ? condition : null,
        price: parseFloat(price), 
        quantity: parseInt(quantity),
        seller_id: currentUser.id,
        species_id: isCustom || !needsSpecies ? null : selectedSpeciesId,
        custom_species_name: isCustom && needsSpecies ? customSpeciesName : null,
        cites_certificate: selectedSpeciesData?.cites_appendix === 'A' && needsSpecies ? citesCertificate : null,
        status: adStatus,
        allow_buy_now: false,
        is_big: isCategoryBig,
        image_url: uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : null,
        voivodeship: voivodeship, 
        city: finalCity // Zapisujemy z listy albo z inputa "Inne..."
      }]).select().single();

      if (listingError || !newListing) throw new Error('Błąd tworzenia ogłoszenia w bazie.');

      if (variants.length > 0) {
        const variantsToInsert = variants.map(v => ({ listing_id: newListing.id, name: v.name, price: parseFloat(v.price), stock: parseInt(v.stock) }));
        const { error: variantError } = await supabase.from('listing_variants').insert(variantsToInsert);
        if (variantError) console.error('Błąd wariantów:', variantError);
      }

      if (uploadedImageUrls.length > 0) {
        const imagesToInsert = uploadedImageUrls.map(url => ({ listing_id: newListing.id, image_url: url }));
        const { error: relationError } = await supabase.from('listing_images').insert(imagesToInsert);
        if (relationError) console.error('Ostrzeżenie: Błąd relacji zdjęć:', relationError);
      }

      localStorage.removeItem('ogloszenieDraft');
      if (isCustom && needsSpecies) alert('Ogłoszenie z nowym gatunkiem wysłane do weryfikacji!');
      else alert('Ogłoszenie dodane pomyślnie!');
      
      router.push('/moje-konto');

    } catch (err: any) {
      alert(err.message || 'Wystąpił nieoczekiwany błąd.');
    } finally {
      setIsCheckoutLoading(false); 
    }
  };

  if (isCheckingLimit) {
    return <div className="flex justify-center items-center h-64"><p className="text-gray-500 animate-pulse">Trwa łączenie z serwerem...</p></div>;
  }

  return (
    <main className="max-w-2xl mx-auto p-6 mt-10 mb-20 bg-white rounded-3xl shadow-xl border relative">
      <h1 className="text-3xl font-black mb-8 text-gray-900">Dodaj Ogłoszenie</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* --- KROK 1: KATEGORIE --- */}
        <div className="bg-gray-50 p-6 rounded-3xl border space-y-4 relative" ref={categoryDropdownRef}>
          <label className="block text-sm font-black text-gray-700 uppercase tracking-widest">Wybierz kategorię</label>
          <div className="relative">
            <button type="button" onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)} className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 text-left outline-none focus:ring-2 focus:ring-black transition flex justify-between items-center font-bold text-gray-800 shadow-sm">
              <span className={!category ? 'text-gray-400' : ''}>{getSelectedCategoryPath()}</span>
              <span className={`transform transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isCategoryDropdownOpen && (
              <div className="absolute z-30 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {mainCats.map(mainCat => {
                    const children = getChildren(mainCat.id);
                    const hasChildren = children.length > 0;
                    const isExpanded = expandedParentId === mainCat.id;

                    return (
                      <div key={mainCat.id} className="flex flex-col">
                        <button type="button" onClick={() => handleCategorySelect(mainCat, hasChildren)} className={`flex justify-between items-center px-5 py-4 hover:bg-gray-50 transition ${isExpanded ? 'bg-gray-50' : ''}`}>
                          <span className="font-black text-gray-900">{mainCat.name}</span>
                          {hasChildren && <span className={`text-gray-400 text-sm transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>}
                        </button>

                        {hasChildren && isExpanded && (
                          <div className="bg-gray-50/50 flex flex-col border-t border-gray-100 animate-in slide-in-from-top-1">
                            {children.map(subCat => (
                              <button
                                key={subCat.id} type="button"
                                onClick={() => {
                                  setCategory(subCat.name);
                                  setIsCategoryDropdownOpen(false);
                                  if (subCat.requires_species === false) {
                                    setSelectedSpeciesId(''); setSearchQuery(''); setCustomSpeciesName(''); setCitesDeclaration(false); setCitesCertificate('');
                                  }
                                }}
                                className="text-left px-5 py-3 pl-10 hover:bg-green-50 focus:bg-green-50 transition border-b border-gray-100 last:border-0 font-bold text-gray-700"
                              >
                                {subCat.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- KROK 2: DYNAMIKA (GATUNEK vs STAN) --- */}
        {category && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            {needsSpecies ? (
              <div className="bg-green-50/50 p-6 rounded-3xl border border-green-100 space-y-6" ref={dropdownRef}>
                <p className="text-xs font-bold text-green-700 uppercase mb-2">Informacje o zwierzęciu</p>
                <div className="relative">
                  <input type="text" placeholder="Wyszukaj gatunek zwierzaka..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setIsDropdownOpen(true); if (selectedSpeciesId) setSelectedSpeciesId(''); }} onFocus={() => setIsDropdownOpen(true)} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black transition font-medium" />
                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden flex flex-col">
                      <div className="max-h-60 overflow-y-auto">
                        {filteredSpecies.length > 0 ? (
                          filteredSpecies.map(species => (
                            <button key={species.id} type="button" onClick={() => { setSelectedSpeciesId(species.id); setSearchQuery(`${species.name} (${species.latin_name})`); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-3 hover:bg-green-50 focus:bg-green-50 transition border-b border-gray-50 last:border-0">
                              <span className="font-bold text-gray-900">{species.name}</span>
                              <span className="text-gray-500 text-sm ml-2 italic">{species.latin_name}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-gray-500 text-sm italic">Nie znaleziono...</div>
                        )}
                      </div>
                      <button type="button" onMouseDown={(e) => { e.preventDefault(); setSelectedSpeciesId('other'); setSearchQuery('Inny gatunek (Wymaga akceptacji)'); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-yellow-50 focus:bg-yellow-50 transition border-t border-gray-200 font-black text-green-700 flex items-center gap-2">
                        <span className="text-lg">➕</span> Dodaj nowy gatunek
                      </button>
                    </div>
                  )}
                </div>

                {isCustom && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl animate-in slide-in-from-top-2">
                    <input type="text" required placeholder="Wpisz pełną nazwę gatunku..." value={customSpeciesName} onChange={(e) => setCustomSpeciesName(e.target.value)} className="w-full bg-white border border-yellow-300 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-yellow-500" />
                  </div>
                )}

                {isBlocked && (
                  <div className="bg-red-50 border-2 border-red-500 p-6 rounded-2xl">
                    <h3 className="text-red-700 font-black flex items-center gap-2"><span>🛑</span> ZAKAZ SPRZEDAŻY</h3>
                  </div>
                )}

                {selectedSpeciesData?.cites_appendix === 'B' && !isBlocked && (
                  <label className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex gap-3 items-start cursor-pointer">
                    <input type="checkbox" required checked={citesDeclaration} onChange={(e) => setCitesDeclaration(e.target.checked)} className="mt-1 w-5 h-5 accent-blue-600" />
                    <div>
                      <p className="text-blue-900 font-bold text-sm">Oświadczenie CITES (Załącznik B)</p>
                      <p className="text-blue-700 text-xs mt-1">Oświadczam, że zwierzę posiada dokument potwierdzający legalne pochodzenie.</p>
                    </div>
                  </label>
                )}

                {selectedSpeciesData?.cites_appendix === 'A' && !isBlocked && (
                  <div className="bg-purple-50 border border-purple-200 p-6 rounded-xl">
                    <label className="block text-purple-900 font-black text-sm uppercase mb-2"><span>📜</span> Certyfikat CITES (Zał. A)</label>
                    <input type="text" required placeholder="np. PL/123456/2023" value={citesCertificate} onChange={(e) => setCitesCertificate(e.target.value)} className="w-full bg-white border border-purple-300 rounded-lg px-4 py-3 outline-none" />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                <p className="text-xs font-bold text-blue-700 uppercase mb-4">Stan przedmiotu</p>
                <div className="flex gap-4">
                  {['new', 'used', 'damaged'].map((s) => (
                    <button key={s} type="button" onClick={() => setCondition(s)} className={`flex-1 py-3 rounded-xl font-bold border-2 transition ${condition === s ? 'border-blue-600 bg-blue-600 text-white shadow-md' : 'border-blue-200 bg-white text-blue-600 hover:bg-blue-50'}`}>
                      {s === 'new' ? 'Nowy' : s === 'used' ? 'Używany' : 'Uszkodzony'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- KROK 3: ZDJĘCIA --- */}
        <div className="bg-gray-50 p-6 rounded-3xl border">
          <div className="flex justify-between items-center mb-4">
            <label className="text-sm font-black text-gray-700 uppercase">Zdjęcia</label>
            <span className="text-xs font-bold text-gray-500">{images.length} / 8</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {previews.map((src, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-sm relative group">
                <img src={src} className="w-full h-full object-cover" />
                <button type="button" onClick={() => { setImages(images.filter((_, idx) => idx !== i)); setPreviews(previews.filter((_, idx) => idx !== i)); }} className="absolute inset-0 bg-red-600/80 text-white font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center backdrop-blur-sm">Usuń</button>
                {i === 0 && <span className="absolute top-2 left-2 bg-black text-white text-[10px] font-black px-2 py-1 rounded uppercase shadow-md">Główne</span>}
              </div>
            ))}
            {images.length < 8 && (
              <label className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-black hover:bg-white transition group">
                <span className="text-2xl group-hover:scale-125 transition">📸</span>
                <span className="text-[10px] font-bold text-gray-400 mt-2 uppercase">Dodaj foto</span>
                <input type="file" multiple accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            )}
          </div>
        </div>

        {/* --- KROK 3.5: WARIANTY --- */}
        {!needsSpecies && category && (
          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-sm font-black uppercase tracking-widest text-gray-800">Warianty produktu</h4>
              <button type="button" onClick={addVariant} className="bg-black text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-gray-800 transition">
                + Dodaj wariant (np. Rozmiar)
              </button>
            </div>
            {variants.length === 0 && <p className="text-xs text-gray-400 italic">Jeśli nie dodasz wariantów, przedmiot zostanie wystawiony jako jedna sztuka bazowa.</p>}
            <div className="space-y-3">
              {variants.map((variant) => (
                <div key={variant.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex gap-3 items-start">
                  <div className="flex-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nazwa Wariantu</label>
                    <input type="text" placeholder="np. S, M, L..." value={variant.name} onChange={e => updateVariant(variant.id, 'name', e.target.value)} className="w-full border border-gray-200 p-2.5 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-black" required />
                  </div>
                  <div className="w-28">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cena (PLN)</label>
                    <input type="number" step="0.01" value={variant.price} onChange={e => updateVariant(variant.id, 'price', e.target.value)} className="w-full border border-gray-200 p-2.5 rounded-lg text-sm font-bold text-green-700 outline-none focus:ring-2 focus:ring-green-500" required />
                  </div>
                  <div className="w-20">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ilość</label>
                    <input type="number" min="1" value={variant.stock} onChange={e => updateVariant(variant.id, 'stock', e.target.value)} className="w-full border border-gray-200 p-2.5 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-black" required />
                  </div>
                  <button type="button" onClick={() => removeVariant(variant.id)} className="mt-5 text-red-400 hover:text-red-600 p-2 text-xl transition">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- KROK 4: TYTUŁ, OPIS, CENA I ILOŚĆ --- */}
        <div className="space-y-4">
           <input type="text" required placeholder="Tytuł ogłoszenia" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-black transition font-bold text-lg" />
           <textarea required placeholder="Opis. Bądź dokładny i opisz wszystko szczegółowo..." value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-black transition resize-none" />
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">{variants.length > 0 ? 'Cena od (PLN)' : 'Cena (PLN)'}</label>
               <div className="relative">
                 <input type="number" required placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} min="0" step="0.01" className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-16 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-black transition font-black text-xl text-green-700" />
                 <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">PLN</span>
               </div>
             </div>
             {variants.length === 0 ? (
               <div className="animate-in fade-in">
                 <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Dostępnych (szt.)</label>
                 <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-black transition font-bold text-xl" required />
               </div>
             ) : (
               <div className="flex flex-col justify-center bg-gray-100 rounded-xl p-3 border border-gray-200 mt-6">
                 <span className="text-[10px] font-black uppercase text-gray-400 mb-1 text-center">Magazyn</span>
                 <span className="text-xs font-bold text-gray-600 text-center">Ilość zarządzana w wariantach ➔</span>
               </div>
             )}
           </div>
        </div>

        {/* --- 🔥 KROK 5: KASKADOWA LOKALIZACJA 🔥 --- */}
        <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
          <h4 className="text-sm font-black uppercase tracking-widest text-blue-900 mb-4 flex items-center gap-2">
            <span className="text-xl">📍</span> Gdzie znajduje się przedmiot?
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WOJEWÓDZTWO */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Województwo</label>
              <select 
                required 
                value={voivodeship} 
                onChange={(e) => {
                  setVoivodeship(e.target.value);
                  setCity(''); // Resetujemy miasto, gdy ktoś zmieni województwo!
                  setCustomCity('');
                }} 
                className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition font-bold text-gray-800 cursor-pointer shadow-sm"
              >
                <option value="" disabled>Wybierz z listy...</option>
                {POLISH_VOIVODESHIPS.map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            
            {/* MIASTO (KASKADOWE) */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Miasto</label>
              <select 
                required 
                disabled={!voivodeship} // Zablokowane, dopóki nie wybrano województwa
                value={city} 
                onChange={e => setCity(e.target.value)} 
                className="w-full appearance-none disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 transition font-bold text-gray-800 cursor-pointer shadow-sm"
              >
                <option value="" disabled>{voivodeship ? 'Wybierz miasto...' : 'Najpierw wybierz województwo'}</option>
                {voivodeship && CITIES_BY_VOIVODESHIP[voivodeship]?.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* POLE "INNE..." DLA MAŁYCH MIEJSCOWOŚCI */}
          {city === 'Inne...' && (
            <div className="mt-4 p-4 bg-white border border-gray-200 rounded-xl animate-in slide-in-from-top-2 shadow-sm">
              <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider">Wpisz nazwę swojej miejscowości</label>
              <input 
                type="text" 
                required 
                placeholder="np. Kórnik" 
                value={customCity} 
                onChange={e => setCustomCity(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition font-bold" 
              />
            </div>
          )}
        </div>

     <button type="submit" disabled={isBlocked || (needsSpecies && selectedSpeciesId === '') || isCheckoutLoading} className="w-full bg-black text-white font-black py-5 rounded-2xl hover:bg-gray-800 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-2xl">
          {isBlocked ? 'Dodawanie zablokowane' : isCheckoutLoading ? 'Przetwarzanie...' : 'Opublikuj Ogłoszenie 🚀'}
        </button>
      </form>

      {/* --- 🔥 BRAKUJĄCY MODAL BRAKU LIMITU 🔥 --- */}
      {showPaywallModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-8 shadow-2xl animate-in zoom-in-95">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">🛑</div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">Limit wyczerpany!</h2>
              <p className="text-gray-600 font-medium">
                Masz już {limitStats.current} z {limitStats.max} aktywnych ogłoszeń. Twoje ogłoszenie jest gotowe do publikacji, ale musisz zwiększyć limit.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-2 border-gray-200 rounded-2xl p-6 hover:border-gray-300 transition flex flex-col justify-between">
                <div>
                  <h3 className="text-xl font-bold mb-1">Pojedyncza Sztuka</h3>
                  <p className="text-sm text-gray-500 mb-4">Kup miejsce tylko na to jedno ogłoszenie.</p>
                  <p className="text-3xl font-black mb-6">9 <span className="text-sm font-medium">zł</span></p>
                </div>
                <button onClick={() => alert('Moduł płatności wkrótce!')} className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition">
                  Kup 1 ogłoszenie
                </button>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-400 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -right-6 -top-6 text-6xl opacity-20">🚀</div>
                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-amber-900 mb-1">Zwiększ Pakiet</h3>
                  <p className="text-sm text-amber-800/70 mb-4">Dopłać różnicę i przejdź na wyższy plan (np. Pro).</p>
                  <p className="text-xl font-black text-amber-700 mb-6 mt-3">Tylko różnica w cenie</p>
                </div>
                <button onClick={() => router.push('/cennik')} className="w-full bg-amber-500 text-black font-black py-3 rounded-xl hover:bg-amber-600 transition shadow-lg relative z-10">
                  Zobacz Cennik Dopłat
                </button>
              </div>
            </div>

            <button onClick={() => setShowPaywallModal(false)} className="mt-6 w-full text-gray-400 font-bold hover:text-gray-600 transition">
              Anuluj i wróć do edycji
            </button>
          </div>
        </div>
      )}
    </main>
  );
}