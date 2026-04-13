'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function StronaSklepu() {
  const params = useParams();
  const router = useRouter();
  const sellerId = params.id as string;

  // STANY GŁÓWNE
  const [profile, setProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('Wszystkie');
  const [loading, setLoading] = useState(true);

  // STANY OPINII I ADMINA
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isVerifiedOption, setIsVerifiedOption] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    const fetchStoreData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);

      if (user) {
        const { data: viewerProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
        setIsAdmin(viewerProfile?.is_admin || false);
      }

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', sellerId).single();
      const { data: listingsData } = await supabase.from('listings').select('*').eq('seller_id', sellerId).order('created_at', { ascending: false });
      const { data: reviewsData } = await supabase
        .from('reviews')
        .select('*, author:profiles!reviews_author_id_fkey(username, avatar_url)')
        .eq('target_user_id', sellerId)
        .order('created_at', { ascending: false });

      setProfile(profileData);
      setListings(listingsData || []);
      setReviews(reviewsData || []);
      setLoading(false);
    };

    fetchStoreData();
  }, [sellerId]);

  // FUNKCJE ADMINA
  const handleAdminAction = async (action: string, id?: string) => {
    if (!isAdmin) return;

    if (action === 'warn') {
      const reason = prompt('Podaj powód ostrzeżenia:');
      if (!reason) return;
      
      const newWarnings = (profile.warnings || 0) + 1;
      const { error } = await supabase.from('profiles').update({ warnings: newWarnings }).eq('id', sellerId);
      
      if (error) {
        alert('❌ Błąd bazy danych:\n' + error.message);
      } else {
        setProfile({ ...profile, warnings: newWarnings });
        alert('✅ Ostrzeżenie wysłane pomyślnie.');
      }
    } 
    else if (action === 'ban') {
      const isCurrentlyBanned = profile.is_banned;
      let reason = '';
      
      if (!isCurrentlyBanned) {
         const inputReason = prompt('Podaj powód bana:');
         if (inputReason === null) return;
         reason = inputReason;
      } else {
         if (!confirm('Czy na pewno chcesz odblokować to konto?')) return;
      }

      const newBanStatus = !isCurrentlyBanned;
      const { error } = await supabase.from('profiles').update({ 
        is_banned: newBanStatus,
        ban_reason: reason
      }).eq('id', sellerId);
      
      if (error) {
        alert('❌ Błąd bazy danych:\n' + error.message);
      } else {
        setProfile({ ...profile, is_banned: newBanStatus, ban_reason: reason });
        alert(newBanStatus ? '🔨 Użytkownik zbanowany.' : '✅ Konto odblokowane.');
      }
    }
    else if (action === 'delete_review' && id) {
      if (!confirm('Usunąć tę opinię?')) return;
      await supabase.from('reviews').delete().eq('id', id);
      setReviews(reviews.filter(r => r.id !== id));
    }
    else if (action === 'delete_listing' && id) {
      if (!confirm('Skasować to ogłoszenie z giełdy?')) return;
      await supabase.from('listings').delete().eq('id', id);
      setListings(listings.filter(l => l.id !== id));
    }
  };

  // DODAWANIE OPINII
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return alert('Zaloguj się!');
    if (currentUser.id === sellerId) return alert('Nie możesz oceniać siebie!');
    
    setSubmittingReview(true);
    const { error } = await supabase.from('reviews').insert([{
      target_user_id: sellerId, author_id: currentUser.id, rating, comment, is_verified: isVerifiedOption
    }]);
    
    if (error) alert('Błąd: ' + error.message);
    else window.location.reload(); 
    setSubmittingReview(false);
  };

  const handleReportSeller = async () => {
    if (!currentUser) return alert('Musisz się zalogować, aby zgłosić użytkownika.');
    const reason = prompt('Opisz problem (np. oszustwo, wulgaryzmy):');
    if (!reason) return;

    const { error } = await supabase.from('reports').insert([{
      reporter_id: currentUser.id,
      reported_item_id: sellerId,
      item_type: 'user',
      reason: reason
    }]);

    if (error) alert('Błąd wysyłania: ' + error.message);
    else alert('🚨 Zgłoszenie zostało wysłane. Dziękujemy!');
  };

  // MATEMATYKA OPINII
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews).toFixed(1) : 'Brak';
  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach(r => { if (ratingCounts[r.rating as keyof typeof ratingCounts] !== undefined) ratingCounts[r.rating as keyof typeof ratingCounts]++; });

  // KATEGORIE PRODUKTÓW
  const categories = ['Wszystkie', ...new Set(listings.map(item => item.category))];
  const filteredListings = activeTab === 'Wszystkie' ? listings : listings.filter(item => item.category === activeTab);

  if (loading) return <div className="min-h-screen flex justify-center items-center font-black text-gray-300 text-2xl animate-pulse">Otwieranie sklepu...</div>;
  if (!profile) return <div className="p-20 text-center font-bold text-red-500">Sklep nie istnieje.</div>;

  return (
    // FIX NA "LATA NA BOKI": overflow-x-hidden w głównym main
    <main className="min-h-screen bg-white pb-20 overflow-x-hidden w-full">
      
      {/* 🔴 TOPBAR DLA ADMINA (Płaski na mobile) */}
      {isAdmin && (
        <div className="bg-red-50 border-b-2 border-red-500 p-4 px-5 md:px-8 flex flex-col md:flex-row justify-between items-center gap-4 animate-in slide-in-from-top-4 w-full">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-3xl shrink-0">🛡️</span>
            <div className="min-w-0">
              <p className="font-black text-red-700 uppercase tracking-widest text-[10px] md:text-xs mb-0.5 truncate">Tryb Administratora</p>
              <p className="text-red-900 font-medium text-xs md:text-sm truncate">Ostrzeżenia: <span className="font-black">{profile.warnings || 0}</span></p>
            </div>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => handleAdminAction('warn')} className="flex-1 md:flex-none bg-orange-100 hover:bg-orange-200 text-orange-700 font-bold px-4 py-2.5 rounded-xl text-xs md:text-sm transition">
              ⚠️ Ostrzeż
            </button>
            <button onClick={() => handleAdminAction('ban')} className={`flex-1 md:flex-none font-bold px-4 py-2.5 rounded-xl text-xs md:text-sm transition ${profile.is_banned ? 'bg-green-100 hover:bg-green-200 text-green-700' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
              {profile.is_banned ? 'Odbanuj' : '🔨 BANUJ'}
            </button>
          </div>
        </div>
      )}

      {profile.is_banned && (
        <div className="bg-black text-white p-6 text-center w-full">
          <h2 className="text-xl md:text-2xl font-black mb-1 text-red-500">To konto zostało zawieszone 🔨</h2>
          <p className="text-gray-400 text-sm">Ten użytkownik złamał regulamin platformy.</p>
        </div>
      )}

      {/* 1. HEADER SKLEPU (Flat UI) */}
      <section className={`border-b border-gray-100 pt-8 md:pt-16 pb-8 px-5 md:px-6 ${profile.is_banned ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
          
          {/* Avatar */}
          <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden shrink-0 border border-gray-200 bg-gray-50 flex items-center justify-center text-4xl relative">
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : '👤'}
            {profile.is_verified_seller && (
               <div className="absolute bottom-1 right-1 bg-green-500 text-white w-7 h-7 rounded-full flex items-center justify-center border-2 border-white text-xs" title="Zweryfikowany Hodowca">
                 ✓
               </div>
            )}
          </div>
          
          {/* Info */}
          <div className="w-full text-center md:text-left min-w-0 flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 mb-3 break-words leading-tight">
              {profile?.organization || profile?.username || 'Anonim'}
            </h1>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3 md:gap-6 text-xs md:text-sm font-medium text-gray-500 mb-5">
              <span className="flex items-center gap-1 shrink-0"><span>📍</span> {profile?.store_address || "Polska"}</span>
              <span className="flex items-center gap-1 shrink-0"><span>⭐</span> {averageRating} / 5</span>
              <a href="#recenzje" className="text-blue-500 hover:underline shrink-0">({totalReviews} opinii)</a>
            </div>

            <div className="bg-gray-50 p-4 md:p-5 rounded-2xl border border-gray-100 text-left">
              <h3 className="font-black text-gray-400 uppercase text-[10px] tracking-widest mb-2">O hodowli</h3>
              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words">
                {profile?.bio || "Ten hodowca jeszcze nie dodał opisu."}
              </p>
            </div>
            
            {currentUser && currentUser.id !== sellerId && (
              <button onClick={handleReportSeller} className="text-[10px] md:text-xs font-bold text-gray-400 hover:text-red-600 transition flex items-center justify-center md:justify-start gap-1 mt-4 w-full md:w-auto">
                🚩 Zgłoś tego użytkownika
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. ZAKŁADKI I LISTA PRODUKTÓW */}
      <section className={`max-w-5xl mx-auto px-0 md:px-6 mt-6 md:mt-12 ${profile.is_banned ? 'opacity-50 pointer-events-none' : ''}`}>
        
        {/* Pasek Kategorii (Horyzontalny scroll) */}
        <div className="px-5 md:px-0 mb-6 flex gap-2 overflow-x-auto custom-scrollbar pb-2">
          {categories.map(cat => (
            <button 
              key={cat} 
              onClick={() => setActiveTab(cat)} 
              className={`px-5 py-2.5 rounded-xl font-bold whitespace-nowrap transition-all text-sm ${
                activeTab === cat ? 'bg-black text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* SIATKA OGŁOSZEŃ (Mobile-First: Flex-row na telefonie, Siatka na desktopie) */}
        {filteredListings.length === 0 ? (
           <div className="mx-5 md:mx-0 border border-dashed border-gray-200 rounded-3xl p-16 text-center text-gray-400 font-medium">Brak ogłoszeń w tej kategorii.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6 px-4 md:px-0">
            {filteredListings.map(ad => (
              <div key={ad.id} className="relative group flex flex-col">
                
                {isAdmin && (
                  <button onClick={() => handleAdminAction('delete_listing', ad.id)} className="absolute z-20 top-2 right-2 bg-red-600 text-white p-2 rounded-lg font-bold shadow-md hover:bg-red-700 transition opacity-100 md:opacity-0 group-hover:opacity-100 text-xs">
                    🗑️
                  </button>
                )}

                <Link 
                  href={`/ogloszenie/${ad.id}`} 
                  // MAGIA MOBILE FIRST: flex-row na telefonie (jak lista), flex-col na komputerze (jak kafelek)
                  className="bg-white rounded-2xl md:rounded-3xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-gray-300 transition duration-300 flex flex-row md:flex-col h-full"
                >
                  {/* ZDJĘCIE (stała szerokość w-36 na mobile) */}
                  <div className="w-36 sm:w-48 md:w-full aspect-square md:aspect-[4/3] bg-gray-100 relative overflow-hidden shrink-0">
                    {ad.image_url ? (
                      <img src={ad.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">📸</div>
                    )}
                  </div>
                  
                  {/* TEKST KARTY (min-w-0 do łamania długich słów) */}
                  <div className="p-3 md:p-5 flex flex-col flex-1 min-w-0">
                    <span className="bg-gray-100 text-gray-600 text-[9px] md:text-[10px] font-black uppercase px-2 py-1 rounded truncate max-w-fit mb-1.5">
                      {ad.category}
                    </span>
                    <h5 className="font-bold text-gray-900 text-sm md:text-base line-clamp-2 break-words mb-2 leading-snug">
                      {ad.title}
                    </h5>
                    <div className="mt-auto pt-2 border-t border-gray-100">
                      <p className="text-green-600 font-black text-lg md:text-xl truncate">{ad.price} <span className="text-[10px] md:text-xs">PLN</span></p>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. SEKCJA OPINII (Płaski design) */}
      <section id="recenzje" className={`border-t border-gray-100 mt-16 pt-12 px-5 md:px-6 max-w-5xl mx-auto ${profile.is_banned ? 'opacity-50 pointer-events-none' : ''}`}>
        <h2 className="text-2xl font-black mb-8 text-gray-900">Opinie o sklepie</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEWA STRONA: Formularz i Wykres */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            
            {/* Wykres (Wyciągnięty na górę dla czytelności) */}
            {totalReviews > 0 && (
              <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-4xl font-black">{averageRating}</span>
                  <div className="flex flex-col">
                    <span className="text-yellow-400 text-lg leading-none">
                      {'★'.repeat(averageRating !== 'Brak' ? Math.round(Number(averageRating)) : 0)}{'☆'.repeat(averageRating !== 'Brak' ? 5 - Math.round(Number(averageRating)) : 5)}
                    </span>
                    <span className="text-xs text-gray-500 font-bold mt-1">{totalReviews} opinii</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {[5, 4, 3, 2, 1].map(star => {
                    const count = ratingCounts[star as keyof typeof ratingCounts];
                    const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                    let barColor = 'bg-green-500';
                    if (star === 3) barColor = 'bg-yellow-400';
                    if (star <= 2) barColor = 'bg-red-500';

                    return (
                      <div key={star} className="flex items-center gap-3 text-[10px] font-bold text-gray-500">
                        <span className="w-6">{star} ★</span>
                        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentage}%` }}></div>
                        </div>
                        <span className="w-8 text-right">{percentage}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Formularz dodawania */}
            {currentUser && currentUser.id !== sellerId ? (
              <div className="bg-white p-6 rounded-3xl border border-gray-200">
                {!showReviewForm ? (
                  <div className="text-center">
                    <div className="text-3xl mb-2">🤝</div>
                    <h3 className="font-bold mb-4 text-sm">Kupiłeś tutaj zwierzaka?</h3>
                    <button onClick={() => setShowReviewForm(true)} className="bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition text-sm w-full">
                      + Napisz opinię
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview} className="space-y-4 animate-in fade-in zoom-in-95">
                    <h3 className="font-black text-lg text-gray-900 border-b pb-2">Twoja ocena</h3>
                    <div>
                      <select value={rating} onChange={e => setRating(Number(e.target.value))} className="w-full border border-gray-200 p-3 rounded-xl bg-gray-50 outline-none font-bold text-sm focus:border-black">
                        <option value={5}>⭐⭐⭐⭐⭐ (5/5) - Rewelacja</option>
                        <option value={4}>⭐⭐⭐⭐ (4/5) - Bardzo dobrze</option>
                        <option value={3}>⭐⭐⭐ (3/5) - Przeciętnie</option>
                        <option value={2}>⭐⭐ (2/5) - Słabo</option>
                        <option value={1}>⭐ (1/5) - Tragedia</option>
                      </select>
                    </div>
                    <div>
                      <textarea value={comment} onChange={e => setComment(e.target.value)} required rows={4} placeholder="Jak oceniasz kontakt i zwierzaka?" className="w-full border border-gray-200 p-3 rounded-xl bg-gray-50 outline-none resize-y focus:border-black text-sm" />
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                      <input type="checkbox" id="verified" checked={isVerifiedOption} onChange={e => setIsVerifiedOption(e.target.checked)} className="mt-0.5 w-4 h-4 rounded text-blue-600 border-gray-300" />
                      <label htmlFor="verified" className="text-[10px] md:text-xs text-blue-900 font-medium cursor-pointer leading-tight">Oświadczam, że kupiłem zwierzaka u tego sprzedawcy.</label>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button type="button" onClick={() => setShowReviewForm(false)} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition text-sm">Anuluj</button>
                      <button type="submit" disabled={submittingReview} className="flex-1 bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition text-sm">
                        {submittingReview ? '...' : 'Opublikuj'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : null}

          </div>

          {/* PRAWA STRONA: Lista Opinii (Karty) */}
          <div className="lg:col-span-2 space-y-4">
            {reviews.length === 0 ? (
              <div className="bg-gray-50 p-10 rounded-3xl border border-dashed border-gray-200 text-center text-gray-400 font-medium text-sm">
                Brak opinii. Bądź pierwszy!
              </div>
            ) : (
              reviews.map(review => (
                <div key={review.id} className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 relative group flex flex-col md:flex-row gap-4 md:gap-6 items-start">
                  
                  {isAdmin && (
                    <button onClick={() => handleAdminAction('delete_review', review.id)} className="absolute top-2 right-2 md:top-4 md:right-4 text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded-lg font-bold opacity-100 md:opacity-0 group-hover:opacity-100 transition">
                      Usuń
                    </button>
                  )}
                  
                  {/* Autor Info */}
                  <div className="flex items-center md:flex-col md:items-center gap-3 shrink-0 w-full md:w-24 text-left md:text-center border-b md:border-b-0 border-gray-50 pb-3 md:pb-0">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-100 overflow-hidden border border-gray-200 shrink-0 flex items-center justify-center text-lg">
                       {review.author?.avatar_url ? <img src={review.author.avatar_url} className="w-full h-full object-cover" /> : '👤'}
                    </div>
                    <div className="min-w-0 flex-1 md:flex-none">
                      <p className="font-black text-gray-900 text-xs md:text-sm truncate w-full">{review.author?.username || 'Anonim'}</p>
                      <p className="text-[9px] text-gray-400 uppercase mt-0.5">{new Date(review.created_at).toLocaleDateString('pl-PL')}</p>
                    </div>
                  </div>

                  {/* Treść Recenzji */}
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-yellow-400 text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
                      {review.is_verified && (
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border border-green-100">✓ Zweryfikowany</span>
                      )}
                    </div>
                    <p className="text-gray-700 text-sm leading-relaxed font-medium break-words whitespace-pre-wrap">{review.comment}</p>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>
      </section>

    </main>
  );
}