'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DodajOgloszenie() {
  const router = useRouter();
  
  // --- STANY GŁÓWNE FORMULARZA ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  
  // Kategoria (przechowuje końcową wybraną nazwę)
  const [category, setCategory] = useState('');
  const [condition, setCondition] = useState('new');
  
  // --- NOWOŚĆ: STANY DLA NOWEGO MENU KATEGORII ---
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [expandedParentId, setExpandedParentId] = useState<string | null>(null);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [dbCategories, setDbCategories] = useState<any[]>([]);

  // Stany dla Słownika Gatunków i CITES
  const [speciesList, setSpeciesList] = useState<any[]>([]);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState<string>('');
  const [customSpeciesName, setCustomSpeciesName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [citesDeclaration, setCitesDeclaration] = useState(false);
  const [citesCertificate, setCitesCertificate] = useState('');
  
  // Stany dla wielu zdjęć
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  // --- STANY LOGISTYCZNE (Dla Bin-Packera) ---
  const [weight, setWeight] = useState('');
  const [dimLength, setDimLength] = useState('');
  const [dimWidth, setDimWidth] = useState('');
  const [dimHeight, setDimHeight] = useState('');
  // Stany logiki limitów i płatności
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isCheckingLimit, setIsCheckingLimit] = useState(true);
  const [limitStats, setLimitStats] = useState({ current: 0, max: 2 });
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [allowBuyNow, setAllowBuyNow] = useState(false);
  
  // Tablica przechowująca warianty. Używamy Date.now() jako tymczasowego ID dla Reacta
 const [variants, setVariants] = useState<{
  id: number, 
  name: string, 
  price: string, 
  stock: string,
  weight: string,   // <-- NOWE
  length: string,   // <-- NOWE
  width: string,    // <-- NOWE
  height: string    // <-- NOWE
}[]>([]);
  // 1. ŁADOWANIE DANYCH (Kategorie, Gatunki, Brudnopis)
  const [quantity, setQuantity] = useState('1');
  useEffect(() => {
    const fetchInitialData = async () => {
      // Pobieranie Kategorii
      const { data: catData } = await supabase.from('categories').select('*').eq('is_active', true).order('name');
      if (catData) setDbCategories(catData);

      // Pobieranie Gatunków
      const { data: speciesData } = await supabase.from('species').select('*').eq('is_approved', true).order('name');
      if (speciesData) setSpeciesList(speciesData);
    };

    fetchInitialData();

    // Ładowanie brudnopisu
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
      } catch (err) {
        console.error("Błąd ładowania brudnopisu", err);
      }
    }
  }, []);

  // 2. SPRAWDZANIE LIMITÓW UŻYTKOWNIKA
  useEffect(() => {
    const checkUserLimits = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsCheckingLimit(false);
        return; 
      }
      
      setCurrentUser(user);

      const { data: profile } = await supabase.from('profiles').select('max_active_listings').eq('id', user.id).single();
      const maxListings = profile?.max_active_listings ?? 2; 

      const { count } = await supabase.from('listings').select('*', { count: 'exact', head: true }).eq('seller_id', user.id).eq('status', 'active'); 
      const currentActive = count || 0;

      setLimitStats({ current: currentActive, max: maxListings });
      setIsCheckingLimit(false); 
    };

    checkUserLimits();
  }, []);


  // 3. ZAPISYWANIE BRUDNOPISU PO KAŻDEJ ZMIANIE
  useEffect(() => {
    const draft = {
      title, description, price, category, condition, selectedSpeciesId, 
      searchQuery, customSpeciesName, citesDeclaration, citesCertificate
    };
    localStorage.setItem('ogloszenieDraft', JSON.stringify(draft));
  }, [title, description, price, category, condition, selectedSpeciesId, searchQuery, customSpeciesName, citesDeclaration, citesCertificate]);

  // 4. OBSŁUGA ZAMYKANIA DROPDOWNÓW (Kliknięcie poza oknem)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
useEffect(() => {
  const selectedCat = dbCategories.find(c => c.name === category);

  // Jeśli kategoria wymaga gatunku (czyli to zwierzę), czyścimy dane e-commerce
  if (selectedCat?.requires_species) {
    if (allowBuyNow) setAllowBuyNow(false); // Wyłączamy "Kup Teraz"
    if (variants.length > 0) setVariants([]); // Usuwamy wpisane warianty z pamięci RAM
  }
}, [category, dbCategories, allowBuyNow, variants.length]);
  // --- LOGIKA KATEGORII (POMOCNICY) ---
  const mainCats = dbCategories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => dbCategories.filter(c => c.parent_id === parentId);
  
  // Wyświetlanie ścieżki w głównym przycisku (np. Węże ❯ Pytony)
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

 const addVariant = () => {
    setVariants([...variants, { 
      id: Date.now(), 
      name: '', 
      price: price || '', 
      stock: '1',
      weight: '',
      length: '',
      width: '',
      height: ''
    }]);
  };

  const removeVariant = (idToRemove: number) => {
    setVariants(variants.filter(v => v.id !== idToRemove));
  };

  const updateVariant = (id: number, field: string, value: string) => {
    setVariants(variants.map(v => v.id === id ? { ...v, [field]: value } : v));
  };
const handleCategorySelect = (mainCat: any, hasChildren: boolean) => {
    if (hasChildren) {
      setExpandedParentId(prev => prev === mainCat.id ? null : mainCat.id);
    } else {
      setCategory(mainCat.name);
      setIsCategoryDropdownOpen(false);
      
      // ODKURZACZ DLA KATEGORII GŁÓWNEJ BEZ DZIECI:
      if (mainCat.requires_species === false) {
        setSelectedSpeciesId('');
        setSearchQuery('');
        setCustomSpeciesName('');
        setCitesDeclaration(false);
        setCitesCertificate('');
      }
    }
  };

  // --- LOGIKA GATUNKÓW I FORMULARZA ---
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
  // --- DYNAMICZNY ANALIZATOR LOGISTYKI ---
  const getShippingTier = () => {
    if (isCategoryBig) return 'pallet';
    if (!allowBuyNow) return 'none';

    // --- KONFIGURACJA BUFORA ---
    const BUFFER_CM = 2;   // Dodajemy 2 cm na karton i folię bąbelkową
    const BUFFER_KG = 0.3; // Dodajemy 300g na wagę opakowania i wypełniaczy

    const itemsToCheck = variants.length > 0 
      ? variants.map(v => ({ 
          w: (parseFloat(v.weight)||0) + BUFFER_KG, 
          x: (parseInt(v.length)||0) + BUFFER_CM, 
          y: (parseInt(v.width)||0) + BUFFER_CM, 
          z: (parseInt(v.height)||0) + BUFFER_CM 
        }))
      : [{ 
          w: (parseFloat(weight)||0) + BUFFER_KG, 
          x: (parseInt(dimLength)||0) + BUFFER_CM, 
          y: (parseInt(dimWidth)||0) + BUFFER_CM, 
          z: (parseInt(dimHeight)||0) + BUFFER_CM 
        }];

    let maxTier = 'inpost';

    for (const item of itemsToCheck) {
      if (item.w <= BUFFER_KG && item.x <= BUFFER_CM) continue;

      const sides = [item.x, item.y, item.z].sort((a, b) => b - a);

      // Limity Paletowe (>30kg lub boki)
      if (item.w > 30 || sides[0] > 120 || (sides[0] + sides[1] + sides[2]) > 220) {
        return 'pallet';
      }

      // Limity Kuriera (Paczkomat InPost Gabaryt C: 64x41x38, waga 25kg)
      if (item.w > 25 || sides[0] > 64 || sides[1] > 41 || sides[2] > 38) {
        maxTier = 'courier';
      }
    }
    return maxTier;
  };
  const shippingTier = getShippingTier();
  // --- WYSYŁKA FORMULARZA (Z obsługą wielu zdjęć!) ---
const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // --- WALIDACJE (Zostają bez zmian) ---
    if (limitStats.current >= limitStats.max) {
      setShowPaywallModal(true);
      return; 
    }
    if (isBlocked) return alert('Nie możesz dodać tego gatunku.');
    if (needsSpecies && selectedSpeciesData?.cites_appendix === 'B' && !citesDeclaration) return alert('Musisz zaakceptować oświadczenie CITES.');
    if (needsSpecies && selectedSpeciesData?.cites_appendix === 'A' && !citesCertificate) return alert('Musisz podać numer certyfikatu CITES.');
    if (!currentUser) return alert('Musisz być zalogowany!');

    const adStatus = isCustom && needsSpecies ? 'pending' : 'active';
    
    // Zabezpieczenie UX: Ustawiamy stan ładowania, by zablokować przycisk "Submit"
    setIsCheckoutLoading(true); 

    try {
      // --- KROK 1: WGRYWANIE ZDJĘĆ DO POCZEKALNI (STORAGE) ---
      const uploadedImageUrls: string[] = [];

      if (images.length > 0) {
        // Mapujemy pliki na tablicę obietnic (Promises)
        const imagePromises = images.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          // Tworzymy tymczasową unikalną nazwę, bo nie znamy jeszcze ID ogłoszenia
          const fileName = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `listings/${fileName}`;

          const { error: uploadError } = await supabase.storage.from('animals').upload(filePath, file);
          if (uploadError) {
            console.error('Błąd wgrywania zdjęcia:', uploadError);
            // Jeśli choć jedno zdjęcie zrzuci błąd, przerywamy cały proces (rzucamy wyjątek do catch)
            throw new Error('Wystąpił problem z wgraniem zdjęć. Sprawdź połączenie.'); 
          }
          
          const { data: { publicUrl } } = supabase.storage.from('animals').getPublicUrl(filePath);
          return publicUrl; 
        });

        // Uruchamiamy wgrywanie równolegle! To ogromne przyspieszenie.
        // Czekamy, aż WSZYSTKIE pliki wrócą z sukcesem.
        const results = await Promise.all(imagePromises);
        uploadedImageUrls.push(...results);
      }

      // --- KROK 2: ZAPIS OGŁOSZENIA DO BAZY (Mamy pewność, że zdjęcia są gotowe) ---
      const { data: newListing, error: listingError } = await supabase.from('listings').insert([{
        title,
        description,
        category,
        condition: !needsSpecies ? condition : null,
        // Jeśli sprzedawca podał warianty, to główna cena ogłoszenia jest tylko "poglądowa" (np. "od 15 PLN")
        price: parseFloat(price), 
        quantity: parseInt(quantity),
        seller_id: currentUser.id,
        species_id: isCustom || !needsSpecies ? null : selectedSpeciesId,
        custom_species_name: isCustom && needsSpecies ? customSpeciesName : null,
        cites_certificate: selectedSpeciesData?.cites_appendix === 'A' && needsSpecies ? citesCertificate : null,
        status: adStatus,
        allow_buy_now: allowBuyNow, // <--- Zapisujemy decyzję użytkownika
        is_big: isCategoryBig,
        image_url: uploadedImageUrls.length > 0 ? uploadedImageUrls[0] : null,
        weight: variants.length === 0 ? parseFloat(weight) || 0 : null,
        dim_length: variants.length === 0 ? parseInt(dimLength) || 0 : null,
        dim_width: variants.length === 0 ? parseInt(dimWidth) || 0 : null,
        dim_height: variants.length === 0 ? parseInt(dimHeight) || 0 : null,
      }]).select().single();

      if (listingError || !newListing) throw new Error('Błąd tworzenia ogłoszenia w bazie.');

      // --- KROK 2.5: ZAPIS WARIANTÓW (Jeśli Kup Teraz jest włączone i dodano warianty) ---
      if (allowBuyNow && variants.length > 0) {
        // Mapujemy nasz stan z frontu na format akceptowany przez tabelę w Supabase
        const variantsToInsert = variants.map(v => ({
          listing_id: newListing.id,
          name: v.name,
          price: parseFloat(v.price),
          stock: parseInt(v.stock),
          // NOWE: Dane logistyczne wariantu
          weight: parseFloat(v.weight) || 0,
          dim_length: parseInt(v.length) || 0,
          dim_width: parseInt(v.width) || 0,
          dim_height: parseInt(v.height) || 0
        }));

        const { error: variantError } = await supabase.from('listing_variants').insert(variantsToInsert);
       if (variantError) {
          // JSON.stringify wyciągnie "ukrytą" treść błędu
          console.error('Błąd szczegółowy:', JSON.stringify(variantError, null, 2));
        }
      }

      // --- KROK 3: ŁĄCZENIE ZDJĘĆ Z OGŁOSZENIEM (Tabela relacyjna) ---
      if (uploadedImageUrls.length > 0) {
        // Przygotowujemy od razu całą paczkę do wstawienia
        const imagesToInsert = uploadedImageUrls.map(url => ({
          listing_id: newListing.id,
          image_url: url
        }));

        // Zapisujemy całą tablicę jednym zapytaniem do bazy
        const { error: relationError } = await supabase.from('listing_images').insert(imagesToInsert);
        if (relationError) console.error('Ostrzeżenie: Błąd relacji zdjęć:', relationError);
      }

      // --- KROK 4: SUKCES I CZYSZCZENIE ---
      localStorage.removeItem('ogloszenieDraft');
      
      if (isCustom && needsSpecies) {
        alert('Ogłoszenie z nowym gatunkiem wysłane do weryfikacji!');
        router.push('/moje-konto');
      } else {
        alert('Ogłoszenie dodane pomyślnie!');
        router.push('/');
      }

    } catch (err: any) {
      // Wyłapujemy wszystkie błędy rzucone w kodzie wyżej i informujemy użytkownika
      alert(err.message || 'Wystąpił nieoczekiwany błąd.');
    } finally {
      // Niezależnie od sukcesu czy błędu, odblokowujemy formularz
      setIsCheckoutLoading(false); 
    }
  };

  const handleBuyExtra = async (packageId: string) => {
    setIsCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser?.id, packageId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert('Błąd: ' + data.error);
    } catch (err) {
      alert('Błąd płatności');
    }
    setIsCheckoutLoading(false);
  };

  if (isCheckingLimit) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-500 animate-pulse">Trwa łączenie z serwerem...</p>
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6 mt-10 mb-20 bg-white rounded-3xl shadow-xl border relative">
      <h1 className="text-3xl font-black mb-8 text-gray-900">Dodaj Ogłoszenie</h1>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* --- KROK 1: KATEGORIE (ACCORDION MENU) --- */}
        <div className="bg-gray-50 p-6 rounded-3xl border space-y-4 relative" ref={categoryDropdownRef}>
          <label className="block text-sm font-black text-gray-700 uppercase tracking-widest">Wybierz kategorię</label>
          
          <div className="relative">
            {/* Przycisk Menu */}
            <button
              type="button"
              onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
              className="w-full bg-white border border-gray-200 rounded-xl px-5 py-4 text-left outline-none focus:ring-2 focus:ring-black transition flex justify-between items-center font-bold text-gray-800 shadow-sm"
            >
              <span className={!category ? 'text-gray-400' : ''}>{getSelectedCategoryPath()}</span>
              <span className={`transform transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {/* Rozwijana Lista Kategorii */}
            {isCategoryDropdownOpen && (
              <div className="absolute z-30 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                  {mainCats.map(mainCat => {
                    const children = getChildren(mainCat.id);
                    const hasChildren = children.length > 0;
                    const isExpanded = expandedParentId === mainCat.id;

                    return (
                      <div key={mainCat.id} className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => handleCategorySelect(mainCat, hasChildren)}
                          className={`flex justify-between items-center px-5 py-4 hover:bg-gray-50 transition ${isExpanded ? 'bg-gray-50' : ''}`}
                        >
                          <span className="font-black text-gray-900">{mainCat.name}</span>
                          {hasChildren && (
                            <span className={`text-gray-400 text-sm transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                          )}
                        </button>

                        {/* Podkategorie pojawiające się pod spodem (Accordion) */}
                        {hasChildren && isExpanded && (
                          <div className="bg-gray-50/50 flex flex-col border-t border-gray-100 animate-in slide-in-from-top-1">
                            {children.map(subCat => (
                              <button
                                key={subCat.id}
                                type="button"
                                onClick={() => {
                                        setCategory(subCat.name);
                                        setIsCategoryDropdownOpen(false);
                                        
                                        // ODKURZACZ DLA PODKATEGORII:
                                        if (subCat.requires_species === false) {
                                          setSelectedSpeciesId('');
                                          setSearchQuery('');
                                          setCustomSpeciesName('');
                                          setCitesDeclaration(false);
                                          setCitesCertificate('');
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
                  <input
                    type="text"
                    placeholder="Wyszukaj gatunek zwierzaka..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      if (selectedSpeciesId) setSelectedSpeciesId(''); 
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black transition font-medium"
                  />
                  {isDropdownOpen && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden flex flex-col">
                      <div className="max-h-60 overflow-y-auto">
                        {filteredSpecies.length > 0 ? (
                          filteredSpecies.map(species => (
                            <button
                              key={species.id}
                              type="button"
                              onClick={() => {
                                setSelectedSpeciesId(species.id);
                                setSearchQuery(`${species.name} (${species.latin_name})`);
                                setIsDropdownOpen(false);
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-green-50 focus:bg-green-50 transition border-b border-gray-50 last:border-0"
                            >
                              <span className="font-bold text-gray-900">{species.name}</span>
                              <span className="text-gray-500 text-sm ml-2 italic">{species.latin_name}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-gray-500 text-sm italic">Nie znaleziono...</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault(); 
                          setSelectedSpeciesId('other');
                          setSearchQuery('Inny gatunek (Wymaga akceptacji)');
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-yellow-50 focus:bg-yellow-50 transition border-t border-gray-200 font-black text-green-700 flex items-center gap-2"
                      >
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
                      <p className="text-blue-700 text-xs mt-1">Oświadczam, że zwierzę posiada dokument potwierdzający legalne pochodzenie, który przekażę kupującemu.</p>
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
                    <button
                      key={s}
                      type="button"
                      onClick={() => setCondition(s)}
                      className={`flex-1 py-3 rounded-xl font-bold border-2 transition ${condition === s ? 'border-blue-600 bg-blue-600 text-white shadow-md' : 'border-blue-200 bg-white text-blue-600 hover:bg-blue-50'}`}
                    >
                      {s === 'new' ? 'Nowy' : s === 'used' ? 'Używany' : 'Uszkodzony'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- KROK 3: ZDJĘCIA (MAX 8) --- */}
        <div className="bg-gray-50 p-6 rounded-3xl border">
          <div className="flex justify-between items-center mb-4">
            <label className="text-sm font-black text-gray-700 uppercase">Zdjęcia</label>
            <span className="text-xs font-bold text-gray-500">{images.length} / 8</span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {previews.map((src, i) => (
              <div key={i} className="aspect-square rounded-2xl overflow-hidden border-2 border-white shadow-sm relative group">
                <img src={src} className="w-full h-full object-cover" />
                <button 
                  type="button" 
                  onClick={() => {
                    setImages(images.filter((_, idx) => idx !== i));
                    setPreviews(previews.filter((_, idx) => idx !== i));
                  }}
                  className="absolute inset-0 bg-red-600/80 text-white font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center backdrop-blur-sm"
                >
                  Usuń
                </button>
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
        {/* SEKCJA: E-COMMERCE I WARIANTY */}
        {dbCategories.find(c => c.name === category)?.requires_species === false && (
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black uppercase text-gray-900 tracking-widest flex items-center gap-2">
                <span>🛒</span> Opcja "Kup Teraz"
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Zezwól na automatyczny zakup przez platformę (Przelewy24 / Trustap) i integrację z InPost.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={allowBuyNow} onChange={e => setAllowBuyNow(e.target.checked)} className="sr-only peer" />
              <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>

          {/* DYNAMICZNA LISTA WARIANTÓW (Pojawia się tylko gdy Kup Teraz jest ON) */}
          {allowBuyNow && (
            <div className="mt-6 border-t border-gray-200 pt-6 animate-in fade-in slide-in-from-top-4">
              {/* --- DYNAMICZNY ANALIZATOR LOGISTYKI --- */}
              {shippingTier !== 'none' && (
                <div className={`mb-6 p-4 rounded-xl border-2 flex items-start gap-4 shadow-sm transition-all duration-300 ${
                  shippingTier === 'pallet' ? 'bg-red-50 border-red-200' :
                  shippingTier === 'courier' ? 'bg-amber-50 border-amber-200' :
                  'bg-green-50 border-green-200'
                }`}>
                  <span className="text-4xl mt-1">
                    {shippingTier === 'pallet' ? '🏗️' : shippingTier === 'courier' ? '🚚' : '📦'}
                  </span>
                  <div>
                    <p className={`font-black text-sm uppercase tracking-widest mb-1 ${
                      shippingTier === 'pallet' ? 'text-red-900' :
                      shippingTier === 'courier' ? 'text-amber-900' :
                      'text-green-900'
                    }`}>
                      {shippingTier === 'pallet' ? 'Wysyłka Paletowa / Gabaryt' :
                       shippingTier === 'courier' ? 'Tylko Kurier pod drzwi' :
                       'Zmieści się w Paczkomacie!'}
                    </p>
                    <p className={`text-xs font-medium leading-relaxed ${
                      shippingTier === 'pallet' ? 'text-red-800' :
                      shippingTier === 'courier' ? 'text-amber-800' :
                      'text-green-800'
                    }`}>
                      {shippingTier === 'pallet' 
                        ? (isCategoryBig 
                            ? 'Ta kategoria wymusza transport specjalistyczny (paleta/gabaryt). Tani kurierzy i paczkomaty będą zablokowane w koszyku klienta.' 
                            : 'Wprowadzone przez Ciebie wymiary lub waga są zbyt duże na standardowego kuriera (>30kg lub >120cm). W koszyku dostępna będzie najdroższa opcja transportu.') 
                        : shippingTier === 'courier' 
                        ? 'Przedmiot jest za duży lub za ciężki (>25kg) na Paczkomat InPost. Kupujący zobaczy w koszyku tylko opcję dostawy kurierem na adres.' 
                        : 'Wymiary są idealne. Kupujący będzie mógł wybrać w koszyku tanią i wygodną dostawę do Paczkomatu InPost.'}
                    </p>
                  </div>
                </div>
              )}
              {/* -------------------------------------- */}
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm font-bold text-gray-700">Warianty produktu (Opcjonalnie)</h4>
                <button type="button" onClick={addVariant} className="bg-black text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-gray-800 transition">
                  + Dodaj wariant (np. Rozmiar)
                </button>
              </div>

              {variants.length === 0 && (
                <p className="text-xs text-gray-400 italic">Jeśli nie dodasz wariantów, przedmiot zostanie wystawiony jako jedna sztuka bazowa.</p>
              )}

              <div className="space-y-3">
                {variants.map((variant, index) => (
                  <div key={variant.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nazwa</label>
                        <input type="text" value={variant.name} onChange={e => updateVariant(variant.id, 'name', e.target.value)} className="w-full border p-2 rounded-lg text-sm font-bold outline-none" required />
                      </div>
                      <div className="w-24">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Cena</label>
                        <input type="number" step="0.01" value={variant.price} onChange={e => updateVariant(variant.id, 'price', e.target.value)} className="w-full border p-2 rounded-lg text-sm font-bold text-green-700 outline-none" required />
                      </div>
                      <div className="w-20">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ilość</label>
                        <input type="number" min="1" value={variant.stock} onChange={e => updateVariant(variant.id, 'stock', e.target.value)} className="w-full border p-2 rounded-lg text-sm font-bold outline-none" required />
                      </div>
                      <button type="button" onClick={() => removeVariant(variant.id)} className="mt-5 text-red-500 hover:text-red-700 p-2">🗑️</button>
                    </div>
                    
                    {/* Logistyka dla wariantu */}
                    <div className="grid grid-cols-4 gap-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                      <div>
                         <label className="block text-[9px] font-black text-blue-800 uppercase mb-1">Waga (kg)</label>
                         <input type="number" step="0.1" value={variant.weight} onChange={e => updateVariant(variant.id, 'weight', e.target.value)} className="w-full border-blue-200 p-1.5 rounded text-xs font-bold" required placeholder="0.5"/>
                      </div>
                      <div>
                         <label className="block text-[9px] font-black text-blue-800 uppercase mb-1">Dł. (cm)</label>
                         <input type="number" value={variant.length} onChange={e => updateVariant(variant.id, 'length', e.target.value)} className="w-full border-blue-200 p-1.5 rounded text-xs font-bold" required placeholder="X"/>
                      </div>
                      <div>
                         <label className="block text-[9px] font-black text-blue-800 uppercase mb-1">Szer. (cm)</label>
                         <input type="number" value={variant.width} onChange={e => updateVariant(variant.id, 'width', e.target.value)} className="w-full border-blue-200 p-1.5 rounded text-xs font-bold" required placeholder="Y"/>
                      </div>
                      <div>
                         <label className="block text-[9px] font-black text-blue-800 uppercase mb-1">Wys. (cm)</label>
                         <input type="number" value={variant.height} onChange={e => updateVariant(variant.id, 'height', e.target.value)} className="w-full border-blue-200 p-1.5 rounded text-xs font-bold" required placeholder="Z"/>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
        {/* --- KROK 4: TYTUŁ, OPIS, CENA I ILOŚĆ --- */}
        <div className="space-y-4">
           <input type="text" required placeholder="Tytuł ogłoszenia" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-black transition font-bold text-lg" />
           <textarea required placeholder="Opis. Bądź dokładny i opisz wszystko szczegółowo..." value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-black transition resize-none" />
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* 4A. CENA (Dynamiczna Etykieta) */}
             <div>
               <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">
                 {variants.length > 0 ? 'Cena bazowa (PLN)' : 'Cena (PLN)'}
               </label>
               <div className="relative">
                 <input type="number" required placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} min="0" step="0.01" className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-4 pr-16 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-black transition font-black text-xl text-green-700" />
                 <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">PLN</span>
               </div>
             </div>

             {/* 4B. ILOŚĆ (Znika, jeśli są warianty) */}
             {variants.length === 0 ? (
               <div className="animate-in fade-in">
                 <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Dostępnych (szt.)</label>
                 <input 
                   type="number" 
                   min="1" 
                   // Używamy zmyślonej zmiennej, dodaj const [quantity, setQuantity] = useState('1'); na górze pod setPrice
                   value={quantity} 
                   onChange={e => setQuantity(e.target.value)} 
                   className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:bg-white focus:ring-2 focus:ring-black transition font-bold text-xl" 
                   required 
                 />
               </div>
             ) : (
               <div className="flex flex-col justify-center bg-gray-100 rounded-xl p-3 border border-gray-200 mt-6">
                 <span className="text-[10px] font-black uppercase text-gray-400 mb-1 text-center">Magazyn</span>
                 <span className="text-xs font-bold text-gray-600 text-center">Ilość zarządzana w wariantach ➔</span>
               </div>
             )}
             {allowBuyNow && variants.length === 0 && (
              <div className="lg:col-span-2 grid grid-cols-4 gap-3 bg-blue-50 p-4 rounded-xl border border-blue-100 animate-in fade-in">
                <div className="col-span-4 mb-1">
                  <span className="text-[10px] font-black uppercase text-blue-800 tracking-widest">Dane do wysyłki (Bin-Packer)</span>
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Waga (kg)</label>
                   <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} className="w-full border border-gray-200 p-2 rounded-lg font-bold" required placeholder="0.5"/>
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Dł. (cm)</label>
                   <input type="number" value={dimLength} onChange={e => setDimLength(e.target.value)} className="w-full border border-gray-200 p-2 rounded-lg font-bold" required placeholder="X"/>
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Szer. (cm)</label>
                   <input type="number" value={dimWidth} onChange={e => setDimWidth(e.target.value)} className="w-full border border-gray-200 p-2 rounded-lg font-bold" required placeholder="Y"/>
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Wys. (cm)</label>
                   <input type="number" value={dimHeight} onChange={e => setDimHeight(e.target.value)} className="w-full border border-gray-200 p-2 rounded-lg font-bold" required placeholder="Z"/>
                </div>
              </div>
            )}
           </div>
        </div>
        <button 
          type="submit" 
          disabled={isBlocked || (needsSpecies && selectedSpeciesId === '')} 
          className="w-full bg-black text-white font-black py-5 rounded-2xl hover:bg-gray-800 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-2xl"
        >
          {isBlocked ? 'Dodawanie zablokowane' : 'Opublikuj Ogłoszenie 🚀'}
        </button>
      </form>

      {/* --- MODAL (POP-UP) BRAKU LIMITU --- */}
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
                <button 
                  onClick={() => handleBuyExtra('single')}
                  disabled={isCheckoutLoading}
                  className="w-full bg-gray-900 text-white font-bold py-3 rounded-xl hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {isCheckoutLoading ? 'Przekierowanie...' : 'Kup 1 ogłoszenie'}
                </button>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-amber-100 border-2 border-amber-400 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -right-6 -top-6 text-6xl opacity-20">🚀</div>
                <div className="relative z-10">
                  <h3 className="text-xl font-bold text-amber-900 mb-1">Zwiększ Pakiet</h3>
                  <p className="text-sm text-amber-800/70 mb-4">Dopłać różnicę i przejdź na wyższy plan (np. Pro).</p>
                  <p className="text-xl font-black text-amber-700 mb-6 mt-3">Tylko różnica w cenie</p>
                </div>
                <button 
                  onClick={() => router.push('/cennik')}
                  className="w-full bg-amber-500 text-black font-black py-3 rounded-xl hover:bg-amber-600 transition relative z-10 shadow-lg"
                >
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