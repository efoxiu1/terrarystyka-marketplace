'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MojeKonto() {
  const router = useRouter();
  
  // --- STANY APLIKACJI ---
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // 1. Profil i Ustawienia
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [organization, setOrganization] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // 2. Kary i Bany
  const [warnings, setWarnings] = useState(0);
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState(''); 
  
  // 3. Ogłoszenia i Limity
  const [myAds, setMyAds] = useState<any[]>([]);
  const [limitStats, setLimitStats] = useState({ current: 0, max: 2 });
  
  // 4. Modale (Pop-upy)
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);
  const [selectedToKeep, setSelectedToKeep] = useState<string[]>([]);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // 5. Social Media
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // --- GŁÓWNA FUNKCJA POBIERAJĄCA DANE ---
  const fetchData = async () => {
    setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();
    let currentUser = session?.user || null;

    if (!currentUser) {
      const { data: { user } } = await supabase.auth.getUser();
      currentUser = user;
    }

    if (!currentUser && typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
       await new Promise(res => setTimeout(res, 1500)); 
       const { data: { user: retryUser } } = await supabase.auth.getUser();
       currentUser = retryUser;
    }

    if (!currentUser) {
      router.push('/rejestracja');
      return;
    }

    setUser(currentUser);

    // 1. POBIERAMY PROFIL (Bez limitów, same dane tekstowe)
    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (profileError && profileError.code === 'PGRST116') {
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([{ id: currentUser.id, username: currentUser.email?.split('@')[0] || 'Nowy Hodowca' }])
        .select()
        .single();
      
      if (!insertError) profile = newProfile;
    }

    if (profile) {
      setUsername(profile.username || '');
      setBio(profile.bio || '');
      setOrganization(profile.organization || '');
      setAvatarUrl(profile.avatar_url || '');
      setStoreAddress(profile.store_address || '');
      setFacebookUrl(profile.facebook_url || '');
      setInstagramUrl(profile.instagram_url || '');
      setYoutubeUrl(profile.youtube_url || '');
      setWarnings(profile.warnings || 0);
      setIsBanned(profile.is_banned || false);
      setBanReason(profile.ban_reason || '');
      
      // 🎓 2. NOWA LOGIKA: LICZENIE LIMITÓW Z TABELI PAKIETÓW
      const BASE_LIMIT = 2;
      const now = new Date().toISOString();
      
      const { data: packages } = await supabase
        .from('purchased_packages')
        .select('slots_added')
        .eq('user_id', currentUser.id)
        .gt('expires_at', now); // Bierzemy tylko aktywne

      let extraSlots = 0;
      if (packages) {
        extraSlots = packages.reduce((sum, pkg) => sum + pkg.slots_added, 0);
      }
      
      const dynamicMaxListings = BASE_LIMIT + extraSlots;
      
      // 3. POBIERAMY OGŁOSZENIA
      const { data: ads } = await supabase
        .from('listings')
        .select('*')
        .eq('seller_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (ads) {
        setMyAds(ads);
        
        const activeAds = ads.filter(ad => ad.status === 'active');
        
        // Ustawiamy nowy, dynamicznie policzony limit
        setLimitStats({ current: activeAds.length, max: dynamicMaxListings });

        // Jeśli ktoś ma więcej aktywnych niż pozwala limit -> ODPALAMY ZŁOTĄ KLATKĘ
        if (activeAds.length > dynamicMaxListings) {
          setShowDowngradeModal(true);
          setSelectedToKeep(activeAds.slice(0, dynamicMaxListings).map((l: any) => l.id));
        }
      }
    }
    
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') fetchData();
    });

    fetchData();

    return () => subscription.unsubscribe();
  }, [router]);

  // --- FUNKCJE OBSŁUGI PROFILU ---
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    const { error } = await supabase.from('profiles').update({
      username, 
      bio, 
      organization, 
      avatar_url: avatarUrl, 
      store_address: storeAddress 
      // USUNIĘTO SOCIALE - Edytuje je tylko admin!
    }).eq('id', user.id);
    
    if (error) alert("Błąd zapisu: " + error.message);
    else alert("Profil zaktualizowany pomyślnie!");
    setUploading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploading(true);
    const file = e.target.files[0];
    const fileName = `avatars/${user.id}-${Date.now()}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage.from('animals').upload(fileName, file);
    if (!uploadError) {
      const { data } = supabase.storage.from('animals').getPublicUrl(fileName);
      setAvatarUrl(data.publicUrl);
    }
    setUploading(false);
  };

  // --- FUNKCJE OBSŁUGI OGŁOSZEŃ ---
  const handleDelete = async (adId: string) => {
    if (!window.confirm("Czy na pewno chcesz usunąć to ogłoszenie? Tej operacji nie można cofnąć.")) return;
    const { error } = await supabase.from('listings').delete().eq('id', adId);
    if (error) alert("Błąd usuwania: " + error.message);
    else fetchData(); 
  };

  const toggleListingStatus = async (ad: any) => {
    const isCurrentlyActive = ad.status === 'active';
    const isExpired = ad.status === 'expired' || ad.status === 'inactive';

    if (isExpired) {
      if (limitStats.current >= limitStats.max) {
        alert(`Osiągnąłeś limit! Masz już ${limitStats.current}/${limitStats.max} aktywnych ogłoszeń.`);
        return;
      }
      await supabase.from('listings').update({ status: 'active' }).eq('id', ad.id);
    } else if (isCurrentlyActive) {
      await supabase.from('listings').update({ status: 'inactive' }).eq('id', ad.id);
    }
    fetchData(); 
  };

  // --- FUNKCJE ZŁOTEJ KLATKI ---
  const toggleKeepListing = (id: string) => {
    if (selectedToKeep.includes(id)) {
      setSelectedToKeep(selectedToKeep.filter(item => item !== id));
    } else {
      if (selectedToKeep.length >= limitStats.max) {
        alert(`Możesz wybrać maksymalnie ${limitStats.max} ogłoszeń!`);
        return;
      }
      setSelectedToKeep([...selectedToKeep, id]);
    }
  };

  const handleDowngradeSave = async () => {
    const activeListings = myAds.filter(l => l.status === 'active');
    const toDeactivate = activeListings
      .filter(l => !selectedToKeep.includes(l.id))
      .map(l => l.id);

    if (toDeactivate.length > 0) {
      const { error } = await supabase
        .from('listings')
        .update({ status: 'inactive' })
        .in('id', toDeactivate);

      if (error) return alert('Błąd: ' + error.message);
    }
    setShowDowngradeModal(false);
    fetchData(); 
  };

  if (loading) return <div className="p-20 text-center font-bold text-gray-400">Ładowanie Twojego panelu...</div>;

  return (
    <main className="p-6 md:p-10 max-w-5xl mx-auto mb-20">
      
      {isBanned && (
        <div className="bg-red-600 text-white p-6 rounded-3xl mb-8 shadow-lg">
          <h2 className="text-2xl font-black mb-2 flex items-center gap-2"><span>🔨</span> Twoje konto zostało zawieszone!</h2>
          <p className="font-medium mb-6 text-red-100">Złamałeś regulamin naszej platformy. Utraciłeś możliwość dodawania ogłoszeń, a Twój sklep został ukryty.</p>
          <div className="bg-red-900/50 p-5 rounded-2xl border border-red-500/50">
            <p className="text-xs font-black uppercase tracking-widest text-red-300 mb-2">Wiadomość od Administratora:</p>
            <p className="text-lg font-medium italic text-white">"{banReason || 'Brak podanego powodu.'}"</p>
          </div>
        </div>
      )}
      {!isBanned && warnings > 0 && (
        <div className="bg-orange-50 border-2 border-orange-300 text-orange-900 p-6 rounded-3xl mb-8 flex items-center gap-6">
          <div className="text-5xl drop-shadow-sm">⚠️</div>
          <div>
            <p className="font-black text-sm uppercase tracking-widest mb-1 text-orange-700">Ostrzeżenie od administracji</p>
            <p className="text-base font-medium">Na Twoim koncie zarejestrowano naruszenia regulaminu. Liczba ostrzeżeń: <span className="font-black text-xl bg-orange-200 px-2 rounded-lg">{warnings}</span></p>
          </div>
        </div>
      )}
      
      <section className="bg-white rounded-3xl shadow-sm border p-8 mb-12">
        <h2 className="text-2xl font-black mb-6 flex items-center gap-2"><span>👤</span> Twój Profil Publiczny</h2>
        <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-green-100 relative group cursor-pointer">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">🦎</div>}
              <label className="absolute inset-0 bg-black/50 text-white text-xs font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition"><input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />Zmień</label>
            </div>
          </div>
          <div className="md:col-span-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-black text-gray-500 mb-1">Nick</label><input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full border p-3 rounded-xl bg-gray-50" /></div>
              <div><label className="block text-xs font-black text-gray-500 mb-1">Hodowla</label><input type="text" value={organization} onChange={e => setOrganization(e.target.value)} className="w-full border p-3 rounded-xl bg-gray-50" /></div>
              <div className="md:col-span-2"><label className="block text-xs font-black text-gray-500 mb-1">Adres sklepu</label><input type="text" value={storeAddress} onChange={e => setStoreAddress(e.target.value)} className="w-full border p-3 rounded-xl bg-gray-50" /></div>
            </div>
            <div><label className="block text-xs font-black text-gray-500 mb-1">Bio</label><textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full border p-3 rounded-xl bg-gray-50 h-24 resize-none" /></div>
          
            <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-sm font-black text-gray-900">Oficjalne Social Media</h3>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Status weryfikacji tożsamości</p>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowVerificationModal(true)} 
                  className="text-xs bg-blue-50 text-blue-700 font-bold px-4 py-2 rounded-xl border border-blue-200 hover:bg-blue-600 hover:text-white transition flex items-center gap-2 shadow-sm"
                >
                  🛡️ { (facebookUrl || instagramUrl || youtubeUrl) ? 'Aktualizuj weryfikację' : 'Zweryfikuj profil' }
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`p-4 rounded-2xl border-2 transition ${facebookUrl ? 'bg-blue-50 border-blue-100' : 'bg-gray-50 border-dashed border-gray-200'}`}>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center gap-1">
                    <span className="text-blue-600">📘</span> Facebook
                  </p>
                  {facebookUrl ? (
                    <a href={facebookUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-700 hover:underline truncate block">
                      {facebookUrl.replace('https://', '')}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-gray-300 italic">Niepodpięty</p>
                  )}
                </div>

                <div className={`p-4 rounded-2xl border-2 transition ${instagramUrl ? 'bg-pink-50 border-pink-100' : 'bg-gray-50 border-dashed border-gray-200'}`}>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center gap-1">
                    <span className="text-pink-600">📸</span> Instagram
                  </p>
                  {instagramUrl ? (
                    <a href={instagramUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-pink-700 hover:underline truncate block">
                      {instagramUrl.replace('https://', '')}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-gray-300 italic">Niepodpięty</p>
                  )}
                </div>

                <div className={`p-4 rounded-2xl border-2 transition ${youtubeUrl ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-dashed border-gray-200'}`}>
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2 flex items-center gap-1">
                    <span className="text-red-600">📺</span> YouTube
                  </p>
                  {youtubeUrl ? (
                    <a href={youtubeUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-red-700 hover:underline truncate block">
                      {youtubeUrl.replace('https://', '')}
                    </a>
                  ) : (
                    <p className="text-sm font-medium text-gray-300 italic">Niepodpięty</p>
                  )}
                </div>
              </div>
            </div>

            <button disabled={uploading} className="bg-black text-white px-8 py-4 rounded-xl font-black text-lg hover:bg-gray-800 transition shadow-md disabled:opacity-50 w-full md:w-auto mt-4">{uploading ? 'Zapisywanie...' : 'Zapisz zmiany profilu'}</button>
            <Link href={`/sklep/${user?.id}`} target="_blank" className="mt-4 block text-center border-2 border-green-600 text-green-600 px-8 py-3 rounded-xl font-bold hover:bg-green-50 transition">👁️ Zobacz sklep</Link>
          </div>
        </form>
      </section>

      <section>
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-2xl font-black">📦 Twoje Ogłoszenia ({myAds.length})</h2>
          <div className="bg-black text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 w-full md:w-auto justify-center">
            <span className="font-bold text-sm">Zużycie pakietu:</span>
            <span className={`text-xl font-black ${limitStats.current >= limitStats.max ? 'text-red-400' : 'text-green-400'}`}>
              {limitStats.current} / {limitStats.max}
            </span>
            <Link href="/cennik" className="bg-amber-500 text-black font-black px-4 py-2 rounded-lg ml-2 hover:bg-amber-400 transition">
              Zwiększ Limit 🚀
            </Link>
          </div>
        </div>

        {myAds.length === 0 ? (
          <div className="bg-white p-10 rounded-xl border text-center shadow-sm">
            <p className="text-gray-500 text-lg mb-4">Nie masz jeszcze żadnych aktywnych ogłoszeń.</p>
            <Link href="/dodaj-ogloszenie" className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition">+ Dodaj pierwsze ogłoszenie</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {myAds.map((ad) => {
              const isActive = ad.status === 'active';
              const isPending = ad.status === 'pending';
              const isRejected = ad.status === 'rejected';
              
              return (
                <div key={ad.id} className={`border rounded-xl p-4 flex flex-col md:flex-row items-center gap-6 transition-all duration-300 ${isActive ? 'bg-white border-green-200 shadow-sm hover:shadow-md' : isPending ? 'bg-yellow-50 border-yellow-200 opacity-80' : isRejected ? 'bg-red-50 border-red-200 opacity-60' : 'bg-gray-100 border-gray-300 opacity-70 grayscale hover:grayscale-0'}`}>
                  <div className="w-24 h-24 shrink-0 bg-gray-200 rounded-lg overflow-hidden border relative">
                    {ad.image_url ? <img src={ad.image_url} alt="Mini" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs font-bold">Brak foto</div>}
                    <div className="absolute top-1 right-1 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{ad.quantity || 1} szt.</div>
                  </div>

                  <div className="flex-1 w-full text-center md:text-left min-w-0">
                    <Link href={`/ogloszenie/${ad.id}`} className="hover:text-green-600 transition block"><h2 className="text-lg md:text-xl font-bold text-gray-900 truncate" title={ad.title}>{ad.title}</h2></Link>
                    <p className="text-green-700 font-black mt-1">{ad.price} PLN</p>
                    <div className="mt-2 flex flex-wrap gap-2 justify-center md:justify-start">
                      {isActive && <span className="bg-green-100 text-green-800 border border-green-300 text-[10px] uppercase font-black px-2 py-1 rounded">✅ Aktywne</span>}
                      {isPending && <span className="bg-yellow-100 text-yellow-800 border border-yellow-300 text-[10px] uppercase font-black px-2 py-1 rounded">⏳ W weryfikacji</span>}
                      {isRejected && <span className="bg-red-100 text-red-800 border border-red-300 text-[10px] uppercase font-black px-2 py-1 rounded">🛑 Odrzucone</span>}
                      {(!isActive && !isPending && !isRejected) && <span className="bg-gray-200 text-gray-700 border border-gray-400 text-[10px] uppercase font-black px-2 py-1 rounded">💤 Wygasłe / Nieaktywne</span>}
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col w-full md:w-auto gap-2 shrink-0">
                    {!isPending && !isRejected && (
                      <button onClick={() => toggleListingStatus(ad)} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${isActive ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-green-500 text-white hover:bg-green-600 shadow-md'}`}>
                        {isActive ? 'Dezaktywuj' : '🔌 Włącz'}
                      </button>
                    )}
                    <Link href={`/edytuj-ogloszenie/${ad.id}`} className="flex-1 bg-blue-50 text-blue-600 border border-blue-200 px-4 py-2 text-sm font-bold rounded-lg hover:bg-blue-600 hover:text-white transition text-center">✏️ Edytuj</Link>
                    <button onClick={() => handleDelete(ad.id)} className="flex-1 bg-red-50 text-red-600 border border-red-200 px-4 py-2 text-sm font-bold rounded-lg hover:bg-red-600 hover:text-white transition">🗑️ Usuń</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* --- MODAL WERYFIKACJI SOCIAL MEDIA --- */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="bg-blue-600 p-6 text-center relative">
              <div className="absolute top-2 right-4 text-6xl opacity-20">🛡️</div>
              <h2 className="text-2xl font-black text-white relative z-10">Weryfikacja Hodowcy</h2>
            </div>
            
            <div className="p-8">
              <p className="text-gray-700 mb-6 font-medium text-center">
                Chcesz udowodnić kupującym, że Twoje social media są autentyczne? Pozytywna weryfikacja znacząco <strong className="text-blue-600">zwiększy zaufanie</strong> do Twojej hodowli i <strong className="text-blue-600">podniesie pozycjonowanie</strong> Twoich ogłoszeń w algorytmie!
              </p>
              
              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-8">
                <h3 className="font-black text-blue-900 mb-4 uppercase text-xs tracking-widest">Instrukcja krok po kroku:</h3>
                <ol className="list-decimal list-outside ml-4 text-sm text-blue-800 space-y-4 font-medium">
                  <li>Dodaj relację (Story) na swoim Facebooku lub Instagramie.</li>
                  <li>Oznacz nasz oficjalny profil: <strong className="bg-blue-200 px-2 py-0.5 rounded text-blue-900">@GieldaEgzotyki</strong>.</li>
                  <li>Umieść na relacji czytelny tekst: <br/><br/>
                    <div className="bg-white p-3 rounded-lg border border-blue-200 font-bold text-gray-900 text-center shadow-sm">
                      "Znajdziecie moje ogłoszenia na giełdzie pod nickiem: <span className="text-blue-600">{username || 'Twój Nick'}</span>"
                    </div>
                  </li>
                  <li>To tyle! Nasza administracja wyłapie Twoje oznaczenie i ręcznie zaktualizuje Twój profil w przeciągu 24 godzin.</li>
                </ol>
              </div>

              <button 
                onClick={() => setShowVerificationModal(false)} 
                className="w-full bg-gray-900 text-white font-black py-4 rounded-xl hover:bg-gray-800 transition shadow-lg"
              >
                Jasne, biorę się za weryfikację!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL ZŁOTEJ KLATKI --- */}
      {showDowngradeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="bg-red-50 p-8 border-b border-red-100 text-center relative overflow-hidden">
              <div className="absolute -top-10 -right-10 text-9xl opacity-10">📉</div>
              <h2 className="text-3xl font-black text-red-900 mb-2 relative z-10">Zmiana limitu konta!</h2>
              <p className="text-red-700 font-medium relative z-10">
                Twój limit wynosi teraz <span className="font-bold text-red-900">{limitStats.max}</span>, ale posiadasz 
                <span className="font-bold text-red-900"> {myAds.filter(l => l.status === 'active').length} </span> 
                aktywnych ogłoszeń.
              </p>
            </div>

            <div className="p-8">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-900 uppercase text-sm tracking-widest">Wybierz, które zatrzymać:</h3>
                <span className={`font-black text-lg ${selectedToKeep.length === limitStats.max ? 'text-green-600' : 'text-gray-500'}`}>
                  Wybrano: {selectedToKeep.length} / {limitStats.max}
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 mb-8 pr-2">
                {myAds.filter(l => l.status === 'active').map(listing => {
                  const isSelected = selectedToKeep.includes(listing.id);
                  const isMaxedOut = selectedToKeep.length >= limitStats.max && !isSelected;

                  return (
                    <div key={listing.id} onClick={() => !isMaxedOut && toggleKeepListing(listing.id)} className={`flex items-center justify-between p-4 border-2 rounded-2xl cursor-pointer transition-all ${isSelected ? 'border-green-500 bg-green-50' : isMaxedOut ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div>
                        <p className={`font-bold ${isSelected ? 'text-green-900' : 'text-gray-900'}`}>{listing.title}</p>
                        <p className="text-sm text-gray-500">{listing.price} PLN</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'}`}>
                        {isSelected && '✓'}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <button onClick={() => router.push('/cennik')} className="flex-1 bg-amber-500 text-black font-black py-4 rounded-xl hover:bg-amber-600 transition shadow-lg flex items-center justify-center gap-2">
                  <span>🚀</span> Zwiększ limit (Cennik)
                </button>
                <button onClick={handleDowngradeSave} disabled={selectedToKeep.length === 0} className="flex-1 bg-gray-900 text-white font-bold py-4 rounded-xl hover:bg-gray-800 transition disabled:opacity-50">
                  Zapisz i dezaktywuj resztę
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}