'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useRouter, useParams } from 'next/navigation';

export default function EdytujOgloszenie() {
  const router = useRouter();
  const params = useParams();
  const adId = params.id as string;
  
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Gady');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [cites, setCites] = useState(false);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  
  // --- ZARZĄDZANIE ZDJĘCIAMI ---
  // 1. Lista starych zdjęć (linków URL prosto z bazy)
  const [existingGallery, setExistingGallery] = useState<string[]>([]);
  // 2. Lista nowych zdjęć (plików, które dopiero wgramy)
  const [newImages, setNewImages] = useState<File[]>([]);
  
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchAdData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/rejestracja');
        return;
      }

      const { data, error } = await supabase.from('listings').select('*').eq('id', adId).single();

      if (error || !data) {
        setMessage('Błąd pobierania ogłoszenia.');
        setLoading(false);
        return;
      }

      if (data.seller_id !== user.id) {
        router.push('/moje-konto');
        return;
      }

      setTitle(data.title);
      setCategory(data.category);
      setPrice(data.price.toString());
      setQuantity(data.quantity?.toString() || '1');
      setCites(data.has_cites);
      setDescription(data.description || '');
      setLocation(data.location || '');
      
      // Pobieramy starą galerię. Jeśli była pusta, sprawdzamy czy nie było starego pojedynczego zdjęcia
      if (data.gallery && data.gallery.length > 0) {
        setExistingGallery(data.gallery);
      } else if (data.image_url) {
        setExistingGallery([data.image_url]);
      }
      
      setLoading(false);
    };

    fetchAdData();
  }, [adId, router]);

  // Funkcja do usuwania zdjęcia ze STAREJ galerii
  const handleRemoveExistingImage = (urlToRemove: string) => {
    // Zostawiamy w tablicy tylko te linki, które NIE są tym usuwanym
    setExistingGallery(prevGallery => prevGallery.filter(url => url !== urlToRemove));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('Przetwarzanie danych...');

    let newlyUploadedUrls: string[] = [];

    // Jeśli użytkownik dodał NOWE zdjęcia, musimy je najpierw wgrać do chmury (Storage)
    if (newImages.length > 0) {
      setMessage(`Wgrywam nowe zdjęcia (${newImages.length} szt.)...`);
      
      for (const file of newImages) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('animals')
          .upload(fileName, file);

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage.from('animals').getPublicUrl(fileName);
          newlyUploadedUrls.push(publicUrlData.publicUrl);
        } else {
          console.error("Błąd wgrywania pliku:", uploadError);
        }
      }
    }

    // Łączymy stare (nieusunięte) zdjęcia z nowo wgranymi w jedną, ostateczną tablicę
    const finalGallery = [...existingGallery, ...newlyUploadedUrls];
    
    // Zabezpieczenie na wypadek usunięcia wszystkich zdjęć
    const finalImageUrl = finalGallery.length > 0 ? finalGallery[0] : null;

    setMessage('Zapisuję zmiany w bazie...');

    const { error } = await supabase
      .from('listings')
      .update({ 
        title: title, 
        category: category,
        price: parseFloat(price), 
        quantity: parseInt(quantity),
        has_cites: cites,
        description: description,
        location: location,
        gallery: finalGallery,       // Nadpisujemy galerię zaktualizowaną listą
        image_url: finalImageUrl     // Ustawiamy pierwsze zdjęcie jako główną miniaturkę
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

  if (loading) return <div className="p-20 text-center font-bold text-gray-400">Wczytywanie danych do edycji...</div>;

  return (
    <main className="p-6 md:p-10 max-w-2xl mx-auto mt-10 bg-white rounded-xl shadow-md border mb-20">
      <h1 className="text-3xl font-bold mb-8 text-center text-gray-800">Edytuj Ogłoszenie</h1>
      
      <form onSubmit={handleUpdate} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-3">
            <label className="block text-sm font-bold text-gray-700 mb-1">Tytuł ogłoszenia</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border bg-gray-50 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Kategoria</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border bg-gray-50 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="Gady">Gady</option>
              <option value="Płazy">Płazy</option>
              <option value="Pajęczaki">Pajęczaki</option>
              <option value="Owady karmowe">Owady karmowe</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Cena (PLN)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full border bg-gray-50 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Dostępna ilość (szt.)</label>
            <input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border bg-gray-50 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Lokalizacja (Miasto)</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)} className="w-full border bg-gray-50 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1">Opis zwierzaka</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5} className="w-full border bg-gray-50 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y" required />
        </div>

        {/* --- SEKCJA EDYCJI ZDJĘĆ --- */}
        <div className="p-4 border border-gray-200 rounded-xl bg-gray-50 space-y-4">
          <label className="block text-sm font-bold text-gray-700">Galeria zdjęć</label>
          
          {/* Wyświetlanie STARYCH zdjęć z opcją usunięcia */}
          {existingGallery.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium">Obecne zdjęcia (kliknij X, aby usunąć):</p>
              <div className="flex flex-wrap gap-3">
                {existingGallery.map((url, index) => (
                  <div key={index} className="relative w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-200 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Stare zdjęcie ${index}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingImage(url)}
                      className="absolute inset-0 bg-red-600/80 text-white font-bold opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dodawanie NOWYCH zdjęć */}
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500 mb-2 font-medium">Dodaj nowe zdjęcia do ogłoszenia:</p>
            <input 
              type="file" 
              accept="image/*"
              multiple 
              onChange={e => {
                if (e.target.files) {
                  setNewImages(Array.from(e.target.files));
                }
              }} 
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" 
            />
            {newImages.length > 0 && (
              <p className="text-xs text-blue-600 font-bold mt-2">Wybrano {newImages.length} nowych zdjęć do wgrania.</p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <input type="checkbox" checked={cites} onChange={e => setCites(e.target.checked)} id="cites" className="mt-1 w-4 h-4 text-blue-600 rounded" />
          <label htmlFor="cites" className="text-sm text-gray-700 font-medium cursor-pointer">
            Oświadczam, że zwierzę pochodzi z legalnego źródła i posiadam niezbędne dokumenty (np. CITES), jeśli są wymagane przez polskie prawo.
          </label>
        </div>

        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white p-4 rounded-xl hover:bg-blue-700 font-bold text-lg disabled:bg-gray-400 transition shadow-md">
          {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
        </button>
      </form>

      {message && (
        <div className={`mt-6 p-4 rounded-lg text-sm text-center font-bold ${message.includes('Sukces') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}
    </main>
  );
}