'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter, useParams } from 'next/navigation';

export default function EdytujOgloszenie() {
  const router = useRouter();
  const params = useParams();
  const adId = params.id as string;
  
  // --- STANY OGŁOSZENIA ---
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState('new');
  const [cites, setCites] = useState(false);
  const [description, setDescription] = useState('');
  
  // --- BAZA DANYCH ---
  const [dbCategories, setDbCategories] = useState<any[]>([]);
  
  // --- ZARZĄDZANIE ZDJĘCIAMI ---
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<{file: File, url: string}[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  
  // --- UI STANY ---
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAdData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/rejestracja');

      const { data: catData } = await supabase.from('categories').select('*').order('name');
      if (catData) setDbCategories(catData);

      const { data, error } = await supabase.from('listings').select('*').eq('id', adId).single();
      if (error || !data) {
        setMessage('Błąd pobierania ogłoszenia.');
        setLoading(false);
        return;
      }

      if (data.seller_id !== user.id) return router.push('/moje-konto');

      setTitle(data.title);
      setCategory(data.category); // Zapisujemy kategorię do odczytu, ale nie pozwolimy jej zmienić
      setPrice(data.price.toString());
      setQuantity(data.quantity?.toString() || '1');
      setCondition(data.condition || 'new');
      setCites(data.has_cites);
      setDescription(data.description || '');
      
      if (data.gallery && data.gallery.length > 0) {
        setExistingGallery(data.gallery);
        setThumbnailUrl(data.image_url || data.gallery[0]);
      } else if (data.image_url) {
        setExistingGallery([data.image_url]);
        setThumbnailUrl(data.image_url);
      }
      
      setLoading(false);
    };

    fetchAdData();
  }, [adId, router]);

  const handleRemoveExistingImage = (urlToRemove: string) => {
    setExistingGallery(prev => prev.filter(url => url !== urlToRemove));
  };

  const handleRemoveNewImage = (indexToRemove: number) => {
    setNewImagePreviews(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const previews = filesArray.map(file => ({
        file,
        url: URL.createObjectURL(file) 
      }));
      setNewImagePreviews(prev => [...prev, ...previews]);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    setSaving(true);
    setMessage('Przetwarzanie danych...');

    let newlyUploadedUrls: string[] = [];
    let uploadedUrlMap = new Map<string, string>(); 

    if (newImagePreviews.length > 0) {
      setMessage(`Wgrywam nowe zdjęcia (${newImagePreviews.length} szt.)...`);
      
      for (const item of newImagePreviews) {
        const fileExt = item.file.name.split('.').pop();
        const fileName = `listings/temp_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from('animals').upload(fileName, item.file);

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('animals').getPublicUrl(fileName);
          newlyUploadedUrls.push(publicUrl);
          uploadedUrlMap.set(item.url, publicUrl); 
        }
      }
    }

    const finalGallery = [...existingGallery, ...newlyUploadedUrls];
    let finalImageUrl = thumbnailUrl;

    if (finalImageUrl && uploadedUrlMap.has(finalImageUrl)) {
      finalImageUrl = uploadedUrlMap.get(finalImageUrl)!;
    }

    if (finalImageUrl && !finalGallery.includes(finalImageUrl)) {
      finalImageUrl = finalGallery.length > 0 ? finalGallery[0] : null;
    } else if (!finalImageUrl && finalGallery.length > 0) {
      finalImageUrl = finalGallery[0];
    }

    setMessage('Zapisuję zmiany w bazie...');

    const selectedCatInfo = dbCategories.find(c => c.name === category);
    const isAccessory = selectedCatInfo ? !selectedCatInfo.requires_species : false;

    // USUNIĘTO "category" Z OBIEKTU UPDATE - BLOKADA BEZPIECZEŃSTWA
    const { error } = await supabase
      .from('listings')
      .update({ 
        title, 
        price: parseFloat(price), 
        quantity: parseInt(quantity),
        condition: isAccessory ? condition : null,
        has_cites: isAccessory ? false : cites,
        description,
        gallery: finalGallery,
        image_url: finalImageUrl 
      })
      .eq('id', adId);

    if (error) {
      setMessage('Błąd zapisu: ' + error.message);
    } else {
      setMessage('Sukces! Zmiany zostały zapisane.');
      setTimeout(() => router.push('/moje-konto'), 1500);
    }
    
    setSaving(false);
  };

  const selectedCatInfo = dbCategories.find(c => c.name === category);
  const isAccessory = selectedCatInfo ? !selectedCatInfo.requires_species : false;

  if (loading) return <div className="p-20 text-center font-bold text-gray-400">Wczytywanie danych do edycji...</div>;

  return (
    <main className="p-6 md:p-10 max-w-4xl mx-auto mt-10 bg-white rounded-xl shadow-md border mb-20 relative">
      <h1 className="text-3xl font-black mb-8 text-gray-900 border-b pb-4">Edytuj Ogłoszenie</h1>
      
      <form onSubmit={handleUpdate} className="space-y-8 relative">
        
        {/* SEKCJA 1: PODSTAWY */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
           <h3 className="text-sm font-black uppercase text-gray-400 mb-4 tracking-widest">Podstawowe Informacje</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="lg:col-span-4">
              <label className="block text-sm font-bold text-gray-700 mb-1">Tytuł ogłoszenia</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border border-gray-200 bg-white p-3 rounded-xl focus:ring-2 focus:ring-black outline-none font-medium" required />
            </div>

            {/* ZABLOKOWANE POLE KATEGORII */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Kategoria</label>
              <div className="w-full border border-gray-200 bg-gray-100 p-3 rounded-xl text-gray-500 font-bold flex justify-between items-center cursor-not-allowed">
                <span>{category || "Ładowanie..."}</span>
                <span title="Kategorii nie można zmienić po dodaniu ogłoszenia" className="text-lg">🔒</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wide">
                Zmiana kategorii jest zablokowana ze względów bezpieczeństwa (CITES).
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Cena (PLN)</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full border border-gray-200 bg-white p-3 rounded-xl focus:ring-2 focus:ring-black outline-none font-black text-green-700" required />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Dostępnych (szt.)</label>
              <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border border-gray-200 bg-white p-3 rounded-xl focus:ring-2 focus:ring-black outline-none font-bold" required />
            </div>
            
            {isAccessory && (
               <div className="lg:col-span-4 mt-2 p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <label className="block text-sm font-black text-amber-900 mb-2 uppercase tracking-widest">Stan przedmiotu</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-800"><input type="radio" name="condition" value="new" checked={condition === 'new'} onChange={e => setCondition(e.target.value)} className="w-5 h-5 accent-amber-600"/> Nowy</label>
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-800"><input type="radio" name="condition" value="used" checked={condition === 'used'} onChange={e => setCondition(e.target.value)} className="w-5 h-5 accent-amber-600"/> Używany</label>
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-800"><input type="radio" name="condition" value="broken" checked={condition === 'broken'} onChange={e => setCondition(e.target.value)} className="w-5 h-5 accent-amber-600"/> Uszkodzony</label>
                  </div>
               </div>
            )}
          </div>
        </div>

        {/* SEKCJA 2: OPIS */}
        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 relative z-20">
           <h3 className="text-sm font-black uppercase text-gray-400 mb-4 tracking-widest">Opis</h3>
           <textarea value={description} onChange={e => setDescription(e.target.value)} rows={6} className="w-full border border-gray-200 bg-white p-4 rounded-xl focus:ring-2 focus:ring-black outline-none resize-y" required placeholder="Opisz dokładnie swój przedmiot lub zwierzę..." />
        </div>

        {/* SEKCJA 3: ZARZĄDZANIE ZDJĘCIAMI */}
        <div className="p-6 border-2 border-gray-100 rounded-2xl bg-white shadow-sm relative z-10">
          <h3 className="text-sm font-black uppercase text-gray-400 mb-4 tracking-widest">Galeria (Wybierz Miniaturkę)</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            
            {/* Wyświetlanie STARYCH zdjęć */}
            {existingGallery.map(url => (
              <div key={url} className={`relative aspect-square rounded-2xl overflow-hidden border-4 transition-all duration-300 ${thumbnailUrl === url ? 'border-yellow-400 shadow-lg scale-105 z-10' : 'border-gray-100'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Zapisane" className="w-full h-full object-cover" />
                
                {thumbnailUrl === url && (
                  <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded shadow-sm uppercase tracking-wider">Miniaturka</div>
                )}

                <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                  {thumbnailUrl !== url && (
                     <button type="button" onClick={() => setThumbnailUrl(url)} className="bg-white text-black text-[10px] uppercase font-black px-3 py-2 rounded-lg hover:bg-yellow-400 transition w-3/4">⭐ Miniaturka</button>
                  )}
                  <button type="button" onClick={() => handleRemoveExistingImage(url)} className="bg-red-600 text-white text-[10px] uppercase font-black px-3 py-2 rounded-lg hover:bg-red-700 transition w-3/4">🗑️ Usuń</button>
                </div>
              </div>
            ))}

            {/* NOWOŚĆ: Wyświetlanie NOWYCH zdjęć z możliwością ustawienia miniatury */}
            {newImagePreviews.map((item, index) => (
              <div key={item.url} className={`relative aspect-square rounded-2xl overflow-hidden border-4 transition-all duration-300 ${thumbnailUrl === item.url ? 'border-yellow-400 shadow-lg scale-105 z-10' : 'border-blue-400 border-dashed opacity-90'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="Nowe" className="w-full h-full object-cover" />
                
                {thumbnailUrl === item.url ? (
                   <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded shadow-sm uppercase tracking-wider">Miniaturka</div>
                ) : (
                   <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-sm uppercase tracking-wider animate-pulse">Nowe</div>
                )}
                
                <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                  {thumbnailUrl !== item.url && (
                     <button type="button" onClick={() => setThumbnailUrl(item.url)} className="bg-white text-black text-[10px] uppercase font-black px-3 py-2 rounded-lg hover:bg-yellow-400 transition w-3/4">⭐ Miniaturka</button>
                  )}
                  <button type="button" onClick={() => handleRemoveNewImage(index)} className="bg-red-600 text-white text-[10px] uppercase font-black px-3 py-2 rounded-lg hover:bg-red-700 w-3/4">🗑️ Usuń z kolejki</button>
                </div>
              </div>
            ))}
            
            {/* Przycisk dodawania */}
            <label className="cursor-pointer aspect-square rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all">
              <span className="text-4xl font-light mb-1">+</span>
              <span className="text-xs font-black uppercase tracking-widest text-center px-2">Wybierz z dysku</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
            </label>

          </div>
        </div>

        {/* SEKCJA 4: CITES (Ukrywamy jeśli to sprzęt) */}
        {!isAccessory && (
          <div className="flex items-start gap-4 bg-blue-50 p-5 rounded-2xl border border-blue-100">
            <input type="checkbox" checked={cites} onChange={e => setCites(e.target.checked)} id="cites" className="mt-1 w-5 h-5 accent-blue-600 rounded" />
            <label htmlFor="cites" className="text-sm text-blue-900 font-medium cursor-pointer leading-relaxed">
              Oświadczam, że zwierzę pochodzi z legalnego źródła i posiadam niezbędne dokumenty (np. CITES), jeśli są wymagane przez polskie prawo.
            </label>
          </div>
        )}

        {/* PRZYCISK ZAPISU */}
        <button type="submit" disabled={saving} className="w-full bg-black text-white p-5 rounded-2xl hover:bg-gray-800 font-black text-lg disabled:bg-gray-300 transition shadow-lg">
          {saving ? 'Zapisywanie na serwerze...' : 'Zapisz wszystkie zmiany'}
        </button>
      </form>

      {message && (
        <div className={`mt-6 p-4 rounded-xl text-sm text-center font-black uppercase tracking-widest ${message.includes('Sukces') ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          {message}
        </div>
      )}
    </main>
  );
}