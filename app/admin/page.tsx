'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PanelAdmina() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [activeTab, setActiveTab] = useState('Zgłoszenia'); 
  const [stats, setStats] = useState({ users: 0, listings: 0, reports: 0, pending: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]); 
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeSuggestionCat, setActiveSuggestionCat] = useState<string>('');
  const [pendingListings, setPendingListings] = useState<any[]>([]);
  const [activeListingId, setActiveListingId] = useState<string | null>(null);
  const [latinName, setLatinName] = useState('');
  const [cites, setCites] = useState('NONE');
  const [isIgo, setIsIgo] = useState(false);
  const [isDangerous, setIsDangerous] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [parentCategoryId, setParentCategoryId] = useState('');
  const [requiresSpeciesFlag, setRequiresSpeciesFlag] = useState(true);
  // NOWOŚĆ: PAKIETY - Stan przechowujący cennik z bazy
  const [pricingPlans, setPricingPlans] = useState<any[]>([]);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editRequiresSpecies, setEditRequiresSpecies] = useState(true);
  useEffect(() => {
    const checkAdminAndFetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/'); return; }

      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
      if (!profile?.is_admin) {
        alert('Brak dostępu! Nie jesteś administratorem.');
        router.push('/');
        return;
      }
      const { data: catData } = await supabase.from('categories').select('*').order('name');
      if (catData) setCategories(catData);
      setIsAdmin(true);
      const { data: sugData } = await supabase.from('category_suggestions').select('*');
      if (sugData) setSuggestions(sugData);
      const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: listingsCount } = await supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'active');
      const { count: reportsCount } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open');
      const { count: pendingCount } = await supabase.from('listings').select('*', { count: 'exact', head: true }).eq('status', 'pending');
      
      setStats({ 
        users: usersCount || 0, 
        listings: listingsCount || 0, 
        reports: reportsCount || 0,
        pending: pendingCount || 0
      });

      const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      const { data: reportsData } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
      const { data: pendingData } = await supabase.from('listings').select('*, profiles(username)').eq('status', 'pending').order('created_at', { ascending: false });
      
      // NOWOŚĆ: PAKIETY - Pobieranie planów cenowych
      const { data: plansData } = await supabase.from('pricing_plans').select('*').order('price_pln');

      setUsers(usersData || []);
      setReports(reportsData || []);
      setPendingListings(pendingData || []);
      setPricingPlans(plansData || []);
      
      setLoading(false);
    };

    checkAdminAndFetchData();
  }, [router]);

  const toggleVerifiedStatus = async (userId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const { error } = await supabase.from('profiles').update({ is_verified_seller: newStatus }).eq('id', userId);
    if (error) alert('❌ Błąd bazy danych: ' + error.message);
    else setUsers(users.map(u => u.id === userId ? { ...u, is_verified_seller: newStatus } : u));
  };

  const toggleBanStatus = async (userId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    let reason = '';
    if (newStatus) {
      const inputReason = prompt('Podaj powód bana (użytkownik zobaczy to jako wiadomość):');
      if (inputReason === null) return;
      reason = inputReason;
    } else {
      if (!confirm('Czy na pewno chcesz odblokować to konto?')) return;
    }
    const { error } = await supabase.from('profiles').update({ is_banned: newStatus, ban_reason: reason }).eq('id', userId);
    if (error) alert('❌ Błąd bazy danych: ' + error.message);
    else {
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: newStatus, ban_reason: reason } : u));
      if (selectedUser && selectedUser.id === userId) setSelectedUser({ ...selectedUser, is_banned: newStatus, ban_reason: reason });
      alert(newStatus ? '🔨 Użytkownik zbanowany!' : '✅ Użytkownik odbanowany!');
    }
  };

  const resolveReport = async (reportId: string) => {
    const { error } = await supabase.from('reports').update({ status: 'resolved' }).eq('id', reportId);
    if (error) alert('❌ Błąd: ' + error.message);
    else {
      setReports(reports.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
      setStats(prev => ({ ...prev, reports: Math.max(0, prev.reports - 1) }));
    }
  };

  const handleApproveSpecies = async (listing: any) => {
    if (!latinName) return alert('Musisz podać nazwę łacińską dla nowego gatunku!');

    const { data: newSpecies, error: speciesError } = await supabase.from('species').insert([{
      name: listing.custom_species_name,
      latin_name: latinName,
      cites_appendix: cites,
      is_igo: isIgo,
      is_dangerous: isDangerous,
      is_approved: true
    }]).select().single();

    if (speciesError || !newSpecies) return alert('Błąd przy dodawaniu gatunku: ' + speciesError?.message);

    const { error: listingError } = await supabase.from('listings').update({
      species_id: newSpecies.id,
      custom_species_name: null,
      status: 'active'
    }).eq('id', listing.id);

    if (listingError) return alert('Błąd przy aktywacji ogłoszenia!');

    setPendingListings(prev => prev.filter(item => item.id !== listing.id));
    setStats(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
    setActiveListingId(null);
    setLatinName(''); setCites('NONE'); setIsIgo(false); setIsDangerous(false);
    alert('Sukces! Gatunek dodany do globalnej bazy!');
  };

  const handleRejectSpecies = async (listing: any) => {
    if (!window.confirm(`Czy na pewno chcesz odrzucić propozycję gatunku "${listing.custom_species_name}"? To odrzuci WSZYSTKIE ogłoszenia z tą nazwą.`)) return;

    const { error } = await supabase
      .from('listings')
      .update({ status: 'rejected' }) 
      .eq('custom_species_name', listing.custom_species_name)
      .eq('status', 'pending');

    if (error) {
      return alert('Błąd przy odrzucaniu bazy: ' + error.message);
    }

    const remainingListings = pendingListings.filter(item => item.custom_species_name !== listing.custom_species_name);
    setPendingListings(remainingListings);
    setStats(prev => ({ ...prev, pending: remainingListings.length }));
  };

  // NOWOŚĆ: PAKIETY - Funkcja aktualizująca ceny i limity w bazie z powiadomieniem
  const updatePlan = async (id: string, newPrice: number, newLimit: number) => {
    const { error } = await supabase
      .from('pricing_plans')
      .update({ 
        price_pln: newPrice * 100, // Złotówki na grosze dla bazy!
        listing_limit: newLimit 
      })
      .eq('id', id);

    if (error) alert("Błąd zapisu planu: " + error.message);
    else {
      // Pobieramy na nowo, by zaktualizować widok
      const { data } = await supabase.from('pricing_plans').select('*').order('price_pln');
      if (data) setPricingPlans(data);
      
      // Pokazujemy ładny "toast" w prawym górnym rogu na 3 sekundy
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-xl font-bold shadow-2xl z-50 animate-in slide-in-from-top-10';
      toast.innerText = '✅ Cennik zaktualizowany!';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.username?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (u.email?.toLowerCase() || u.id).includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-20 text-center font-bold">Weryfikacja uprawnień...</div>;
  if (!isAdmin) return null;
const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const { data, error } = await supabase
      .from('categories')
      .insert([{ 
        name: newCategoryName.trim(),
        parent_id: parentCategoryId === '' ? null : parentCategoryId, // Jeśli puste, to kategoria główna (null)
        requires_species: requiresSpeciesFlag // Flaga CITES/Gatunku
      }])
      .select()
      .single();

    if (error) {
      alert('Błąd! Być może taka kategoria już istnieje. (' + error.message + ')');
    } else if (data) {
      setCategories([...categories, data].sort((a, b) => a.name.localeCompare(b.name)));
      // Resetujemy formularz po udanym dodaniu
      setNewCategoryName('');
      setParentCategoryId('');
      setRequiresSpeciesFlag(true);
    }
  };
  const toggleSuggestion = async (sourceId: string, suggestedId: string) => {
    // Sprawdzamy, czy takie powiązanie już istnieje
    const exists = suggestions.find(s => s.source_category_id === sourceId && s.suggested_category_id === suggestedId);

    if (exists) {
      // Jeśli istnieje - usuwamy je z bazy (odznaczony checkbox)
      await supabase.from('category_suggestions').delete().eq('id', exists.id);
      setSuggestions(suggestions.filter(s => s.id !== exists.id));
    } else {
      // Jeśli nie istnieje - tworzymy je (zaznaczony checkbox)
      const { data, error } = await supabase.from('category_suggestions').insert([{
        source_category_id: sourceId,
        suggested_category_id: suggestedId
      }]).select().single();

      if (data) setSuggestions([...suggestions, data]);
      if (error) alert('Błąd: ' + error.message);
    }
  };
  const toggleCategoryStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase.from('categories').update({ is_active: !currentStatus }).eq('id', id);
    if (!error) {
      setCategories(categories.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
    }
  };
  // 1. Odpalenie trybu edycji
  const startEditingCategory = (cat: any) => {
    setEditingCategoryId(cat.id);
    setEditCategoryName(cat.name);
    setEditRequiresSpecies(cat.requires_species);
  };

  // 2. Zapisanie zmian w bazie
  const handleSaveEditCategory = async (id: string) => {
    if (!editCategoryName.trim()) return;

    const { error } = await supabase
      .from('categories')
      .update({ 
        name: editCategoryName.trim(), 
        requires_species: editRequiresSpecies 
      })
      .eq('id', id);

    if (error) {
      alert('Błąd zapisu: ' + error.message);
    } else {
      // Aktualizujemy widok na żywo
      setCategories(categories.map(c => 
        c.id === id ? { ...c, name: editCategoryName.trim(), requires_species: editRequiresSpecies } : c
      ).sort((a, b) => a.name.localeCompare(b.name)));
      
      setEditingCategoryId(null); // Zamykamy tryb edycji
    }
  };

  // 3. Brutalne usunięcie z bazy
  const handleDeleteCategory = async (id: string, name: string, isParent: boolean) => {
    const warningText = isParent 
      ? `⚠️ UWAGA! Usuwasz główną kategorię "${name}". To usunie również WSZYSTKIE jej podkategorie! Czy na pewno chcesz to zrobić?`
      : `Czy na pewno chcesz bezpowrotnie usunąć podkategorię "${name}"?`;

    if (!window.confirm(warningText)) return;

    const { error } = await supabase.from('categories').delete().eq('id', id);
    
    if (error) {
      alert('Błąd usuwania: ' + error.message);
    } else {
      // Jeśli to był rodzic, wywalamy też dzieci z widoku, żeby React nie zwariował
      if (isParent) {
        setCategories(categories.filter(c => c.id !== id && c.parent_id !== id));
      } else {
        setCategories(categories.filter(c => c.id !== id));
      }
    }
  };
  return (
    <main className="max-w-7xl mx-auto p-4 md:p-6 mt-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Panel Administratora</h1>
          <p className="text-gray-500 font-medium">Zarządzaj giełdą, użytkownikami i zgłoszeniami.</p>
        </div>
        <Link href="/" className="bg-gray-100 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 transition">Wróć na stronę główną</Link>
      </div>

      {/* ZAKŁADKI (DODANO 'Pakiety') */}
 <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
        {['Zgłoszenia', 'Nowe Gatunki', 'Użytkownicy', 'Pakiety', 'Kategorie', 'Statystyki'].map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition ${activeTab === tab ? 'bg-black text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
          >
            {tab}
            {tab === 'Zgłoszenia' && stats.reports > 0 && <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full text-xs animate-pulse">{stats.reports}</span>}
            {tab === 'Nowe Gatunki' && stats.pending > 0 && <span className="ml-2 bg-yellow-500 text-white px-2 py-0.5 rounded-full text-xs animate-pulse">{stats.pending}</span>}
          </button>
        ))}
      </div>

      {/* --- WIDOK 1: ZGŁOSZENIA --- */}
      {activeTab === 'Zgłoszenia' && (
         <div className="space-y-4">
           {reports.length === 0 ? (
             <div className="bg-gray-50 border-2 border-dashed rounded-3xl p-20 text-center text-gray-500 font-bold">
               Brak zgłoszeń. Święty spokój! ☕
             </div>
           ) : (
             reports.map(report => {
               const reporter = users.find(u => u.id === report.reporter_id);
               const reportedUser = users.find(u => u.id === report.reported_item_id);
               const isResolved = report.status === 'resolved';

               return (
                 <div key={report.id} className={`bg-white p-6 rounded-2xl border shadow-sm transition-all ${isResolved ? 'opacity-60 bg-gray-50/50' : 'border-red-200 hover:border-red-400'}`}>
                   <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b pb-4">
                     <div>
                       <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${isResolved ? 'bg-gray-200 text-gray-500' : 'bg-red-100 text-red-700 animate-pulse'}`}>
                         {isResolved ? '✅ Rozwiązane' : '🚨 Wymaga interwencji'}
                       </span>
                       <p className="text-xs text-gray-400 mt-2 font-mono">{new Date(report.created_at).toLocaleString('pl-PL')}</p>
                     </div>
                     {!isResolved && (
                       <button onClick={() => resolveReport(report.id)} className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-bold px-4 py-2 rounded-xl text-sm transition shadow-sm w-full md:w-auto">
                         Oznacz jako załatwione
                       </button>
                     )}
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="bg-gray-50 p-4 rounded-xl border">
                       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Zgłaszający:</p>
                       <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">{reporter?.avatar_url ? <img src={reporter.avatar_url} className="w-full h-full object-cover" /> : '👤'}</div>
                          <p className="font-bold text-gray-900">{reporter?.username || 'Nieznany'}</p>
                       </div>
                     </div>
                     <div className="bg-red-50 p-4 rounded-xl border border-red-100 relative overflow-hidden">
                       <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Podejrzany ({report.item_type}):</p>
                       <div className="flex justify-between items-center relative z-10">
                         <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-white overflow-hidden border">{reportedUser?.avatar_url ? <img src={reportedUser.avatar_url} className="w-full h-full object-cover" /> : '👤'}</div>
                            <p className="font-black text-red-900">{reportedUser?.username || report.reported_item_id}</p>
                         </div>
                         {reportedUser && (
                           <button onClick={() => setSelectedUser(reportedUser)} className="text-[10px] font-black uppercase bg-white text-red-600 px-3 py-1.5 rounded-lg border shadow-sm hover:bg-red-600 hover:text-white transition">
                             👁️ Prześwietl
                           </button>
                         )}
                       </div>
                     </div>
                   </div>
                   <div className="mt-4 bg-yellow-50 p-4 rounded-xl border border-yellow-100">
                     <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest mb-2">Powód zgłoszenia:</p>
                     <p className="text-sm font-medium italic text-gray-800 border-l-2 border-yellow-400 pl-3">"{report.reason}"</p>
                   </div>
                 </div>
               );
             })
           )}
         </div>
       )}

      {/* --- WIDOK 2: NOWE GATUNKI --- */}
      {activeTab === 'Nowe Gatunki' && (
        <div className="space-y-4">
          {pendingListings.length === 0 ? (
            <div className="bg-green-50 border border-green-200 p-20 rounded-3xl text-center text-green-700 font-bold">
              Wszystkie ogłoszenia zatwierdzone. Nie ma nowych gatunków. 🌱
            </div>
          ) : (
            pendingListings.map(listing => (
              <div key={listing.id} className="bg-white border-2 border-yellow-400 p-6 rounded-3xl shadow-sm">
                <div className="flex justify-between items-start mb-6 pb-6 border-b">
                  <div>
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest">Oczekuje na akceptację</span>
                    <h2 className="text-xl font-black mt-3">{listing.title}</h2>
                    <p className="text-gray-500 text-sm mt-1">Użytkownik: <span className="font-bold text-gray-900">{listing.profiles?.username || 'Nieznany'}</span></p>
                    <p className="text-gray-500 text-sm">Zaproponowany gatunek: <span className="font-black text-blue-600 text-lg">{listing.custom_species_name}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-green-600 text-xl">{listing.price} PLN</p>
                  </div>
                </div>
  
                {activeListingId === listing.id ? (
                  <div className="bg-gray-50 p-6 rounded-2xl border animate-in fade-in zoom-in-95">
                    <h3 className="font-black text-gray-900 mb-4 uppercase text-sm">Uzupełnij dane o gatunku</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <input type="text" placeholder="Nazwa łacińska (Wymagane)" value={latinName} onChange={e => setLatinName(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-black" />
                      <select value={cites} onChange={e => setCites(e.target.value)} className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-black">
                        <option value="NONE">Brak CITES</option>
                        <option value="B">CITES - Załącznik B</option>
                        <option value="A">CITES - Załącznik A (Wymaga Certyfikatu)</option>
                      </select>
                    </div>
                    <div className="flex gap-6 mb-6">
                      <label className="flex items-center gap-2 font-bold text-red-600 cursor-pointer"><input type="checkbox" checked={isIgo} onChange={e => setIsIgo(e.target.checked)} className="w-5 h-5 accent-red-600"/> To jest gatunek inwazyjny (IGO)</label>
                      <label className="flex items-center gap-2 font-bold text-red-600 cursor-pointer"><input type="checkbox" checked={isDangerous} onChange={e => setIsDangerous(e.target.checked)} className="w-5 h-5 accent-red-600"/> Zwierzę niebezpieczne</label>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => handleApproveSpecies(listing)} className="flex-1 bg-black text-white font-black py-3 rounded-xl hover:bg-gray-800 transition">✅ Zatwierdź i Dodaj do Bazy</button>
                      <button onClick={() => setActiveListingId(null)} className="px-6 bg-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-300 transition">Anuluj</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => setActiveListingId(listing.id)} className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-700 transition">Rozpatrz to ogłoszenie</button>
                    <button onClick={() => handleRejectSpecies(listing)} className="px-6 bg-red-100 text-red-600 font-black rounded-xl hover:bg-red-200 transition">Odrzuć</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* --- WIDOK 3: UŻYTKOWNICY --- */}
      {activeTab === 'Użytkownicy' && (
        <div className="space-y-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input type="text" placeholder="Szukaj po nicku, e-mailu lub ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-black outline-none transition shadow-sm" />
          </div>
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Użytkownik</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Akcje</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Odznaka</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="hover:bg-gray-50 transition">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border">{u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : '👤'}</div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate flex items-center gap-2">
                              {u.username || 'Brak nazwy'} 
                              {u.is_banned && <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded uppercase">Banned</span>}
                            </p>
                            <p className="text-[10px] text-gray-400 font-mono">{u.id.substring(0, 12)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={() => setSelectedUser(u)} className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">👁️ Sprawdź konto</button>
                      </td>
                      <td className="p-4">
                        <button onClick={() => toggleVerifiedStatus(u.id, u.is_verified_seller)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition ${u.is_verified_seller ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-400 border'}`}>
                          {u.is_verified_seller ? '✓ Zweryfikowany' : 'Nadaj odznakę'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- NOWOŚĆ WIDOK 4: PAKIETY --- */}
      {activeTab === 'Pakiety' && (
        <div className="bg-white p-6 md:p-10 rounded-3xl border shadow-sm animate-in fade-in">
          <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
            <span>💸</span> Zarządzanie Cennikiem
          </h2>
          <div className="space-y-4">
            {pricingPlans.map(plan => (
              <div key={plan.id} className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 border-2 border-gray-100 rounded-2xl bg-gray-50 hover:border-gray-200 hover:shadow-md transition-all">
                <div>
                  <span className="font-black text-xl text-gray-900 block mb-1">{plan.name}</span>
                  <span className="text-gray-400 text-xs font-mono uppercase tracking-widest bg-gray-200 px-2 py-1 rounded">ID: {plan.id}</span>
                </div>
                <div className="flex gap-4">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-black uppercase text-gray-500 mb-1">Cena (PLN)</label>
                    <input
                      type="number"
                      defaultValue={plan.price_pln / 100}
                      // Wywoła się automatycznie, gdy odklikniesz pole (straci focus)
                      onBlur={(e) => updatePlan(plan.id, Number(e.target.value), plan.listing_limit)}
                      className="border-2 p-3 rounded-xl w-28 md:w-32 font-black text-lg text-gray-900 outline-none focus:border-amber-500 transition text-center"
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] font-black uppercase text-gray-500 mb-1">Limit Ogłoszeń</label>
                    <input
                      type="number"
                      defaultValue={plan.listing_limit}
                      onBlur={(e) => updatePlan(plan.id, plan.price_pln / 100, Number(e.target.value))}
                      className="border-2 p-3 rounded-xl w-28 md:w-32 font-black text-lg text-gray-900 outline-none focus:border-blue-500 transition text-center"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            {pricingPlans.length === 0 && (
               <div className="text-center text-gray-400 p-10 italic">
                 Brak pakietów w bazie danych. Dodaj je przez panel Supabase!
               </div>
            )}
          </div>
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex gap-3">
            <span className="text-xl">💡</span>
            <p className="font-medium">Wpisz nową wartość w pole tekstowe i po prostu kliknij gdzieś obok. Cena/limit zapisze się automatycznie, a Stripe sam "złapie" te nowe wartości przy kolejnej transakcji klienta!</p>
          </div>
        </div>
      )}

      {/* --- WIDOK 5: STATYSTYKI --- */}
      {activeTab === 'Statystyki' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-center items-center text-center"><span className="text-4xl mb-2">👥</span><p className="text-gray-500 font-bold uppercase text-xs tracking-wider">Zarejestrowani</p><p className="text-4xl font-black text-gray-900">{stats.users}</p></div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-center items-center text-center"><span className="text-4xl mb-2">🦎</span><p className="text-gray-500 font-bold uppercase text-xs tracking-wider">Aktywne Ogłoszenia</p><p className="text-4xl font-black text-gray-900">{stats.listings}</p></div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-center items-center text-center"><span className="text-4xl mb-2">🚨</span><p className="text-gray-500 font-bold uppercase text-xs tracking-wider">Otwarte tickety</p><p className="text-4xl font-black text-red-600">{stats.reports}</p></div>
          <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-center items-center text-center"><span className="text-4xl mb-2">🌱</span><p className="text-gray-500 font-bold uppercase text-xs tracking-wider">Do weryfikacji</p><p className="text-4xl font-black text-yellow-500">{stats.pending}</p></div>
        </div>
      )}
      {activeTab === 'Kategorie' && (
  <div className="bg-white p-6 md:p-10 rounded-3xl border shadow-sm animate-in fade-in">
    <h2 className="text-2xl font-black mb-8">📂 Zarządzanie Kategoriami i Flagami</h2>

    <form onSubmit={handleAddCategory} className="bg-gray-50 p-6 rounded-2xl border mb-8 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input 
          type="text" 
          placeholder="Nazwa (np. Pytony, Akwaria...)" 
          value={newCategoryName}
          onChange={e => setNewCategoryName(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black"
        />
        <select 
          value={parentCategoryId} // Musisz dodać ten stan: 
          onChange={e => setParentCategoryId(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-black"
        >
          <option value="">Główna kategoria (Brak nadrzędnej)</option>
          {categories.filter(c => !c.parent_id).map(c => (
            <option key={c.id} value={c.id}>Podkategoria dla: {c.name}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 font-bold text-gray-700 cursor-pointer">
          <input 
            type="checkbox" 
            checked={requiresSpeciesFlag} // Stan: const [requiresSpeciesFlag, setRequiresSpeciesFlag] = useState(true)
            onChange={e => setRequiresSpeciesFlag(e.target.checked)}
            className="w-5 h-5 accent-black"
          /> 
          Ta kategoria wymaga wyboru gatunku i CITES
        </label>
        <button type="submit" className="ml-auto bg-black text-white font-black px-8 py-3 rounded-xl hover:bg-gray-800 transition">
          + Dodaj kategorię
        </button>
      </div>
    </form>

   <div className="space-y-6">
      {categories.filter(c => !c.parent_id).map(parent => (
        <div key={parent.id} className="border-2 border-gray-100 rounded-2xl p-4">
          
          {/* --- KATEGORIA GŁÓWNA --- */}
          <div className="flex justify-between items-center mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
            {editingCategoryId === parent.id ? (
              // TRYB EDYCJI RODZICA
              <div className="flex items-center gap-3 w-full">
                <input 
                  type="text" 
                  value={editCategoryName} 
                  onChange={e => setEditCategoryName(e.target.value)} 
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1 outline-none focus:border-black font-bold"
                />
                <button onClick={() => handleSaveEditCategory(parent.id)} className="bg-green-500 text-white px-4 py-1.5 rounded-lg font-bold hover:bg-green-600 text-sm">Zapisz</button>
                <button onClick={() => setEditingCategoryId(null)} className="bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg font-bold hover:bg-gray-300 text-sm">Anuluj</button>
              </div>
            ) : (
              // NORMALNY WIDOK RODZICA
              <>
                <div className="flex items-center gap-3">
                  <span className="font-black text-lg">{parent.name}</span>
                  <span className="text-[10px] uppercase font-black px-2 py-1 bg-gray-200 rounded">Główna</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleCategoryStatus(parent.id, parent.is_active)} className={`text-xs font-bold px-3 py-1 rounded-lg transition ${parent.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                    {parent.is_active ? 'Wyłącz' : 'Włącz'}
                  </button>
                  <button onClick={() => startEditingCategory(parent)} className="text-xs font-bold px-3 py-1 bg-blue-50 text-blue-600 rounded-lg">✏️ Edytuj</button>
                  <button onClick={() => handleDeleteCategory(parent.id, parent.name, true)} className="text-xs font-bold px-3 py-1 bg-red-100 text-red-600 rounded-lg">🗑️ Usuń</button>
                </div>
              </>
            )}
          </div>

          {/* --- PODKATEGORIE --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 ml-4 md:ml-8">
            {categories.filter(c => c.parent_id === parent.id).map(sub => (
              <div key={sub.id} className={`p-3 border rounded-xl flex flex-col gap-3 transition-colors ${sub.is_active ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                
                {editingCategoryId === sub.id ? (
                  // TRYB EDYCJI DZIECKA
                  <div className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      value={editCategoryName} 
                      onChange={e => setEditCategoryName(e.target.value)} 
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1 outline-none focus:border-black font-bold text-sm"
                    />
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={editRequiresSpecies} onChange={e => setEditRequiresSpecies(e.target.checked)} className="w-4 h-4 accent-black" /> 
                      Wymaga wyboru gatunku / CITES
                    </label>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => handleSaveEditCategory(sub.id)} className="flex-1 bg-green-500 text-white py-1.5 rounded-lg font-bold hover:bg-green-600 text-xs">Zapisz</button>
                      <button onClick={() => setEditingCategoryId(null)} className="flex-1 bg-gray-200 text-gray-700 py-1.5 rounded-lg font-bold hover:bg-gray-300 text-xs">Anuluj</button>
                    </div>
                  </div>
                ) : (
                  // NORMALNY WIDOK DZIECKA
                  <>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-gray-900">{sub.name}</span>
                        <p className="text-[10px] text-gray-400 uppercase font-black mt-1">
                          {sub.requires_species ? '🧬 Wymaga gatunku' : '📦 Bez gatunku'}
                        </p>
                      </div>
                      <button onClick={() => toggleCategoryStatus(sub.id, sub.is_active)} className={`text-[10px] font-bold px-2 py-1 rounded transition ${sub.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {sub.is_active ? 'Wyłącz' : 'Włącz'}
                      </button>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <button onClick={() => startEditingCategory(sub)} className="flex-1 text-[10px] font-bold py-1 bg-blue-50 text-blue-600 rounded">✏️ Edytuj</button>
                      <button onClick={() => handleDeleteCategory(sub.id, sub.name, false)} className="flex-1 text-[10px] font-bold py-1 bg-red-50 text-red-600 rounded">🗑️ Usuń</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
          
        </div>
      ))}
    </div>
    <div className="mt-16 bg-blue-50 border border-blue-100 rounded-3xl p-6 md:p-10 shadow-inner">
            <h3 className="text-xl md:text-2xl font-black text-blue-900 mb-2 flex items-center gap-3">
              <span className="text-3xl">🔗</span> Konfigurator Cross-Sellingu
            </h3>
            <p className="text-blue-700 text-sm mb-8 font-medium">
              Wybierz kategorię źródłową, a następnie zaznacz, co system ma polecać kupującym w tej kategorii.
            </p>

            <div className="flex flex-col lg:flex-row gap-8">
              {/* Lewa kolumna: Wybór źródła */}
              <div className="w-full lg:w-1/3">
                <label className="block text-xs font-black text-blue-800 uppercase tracking-widest mb-3">1. Klient przegląda:</label>
                <select
                  value={activeSuggestionCat}
                  onChange={(e) => setActiveSuggestionCat(e.target.value)}
                  className="w-full bg-white border border-blue-200 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-blue-500 font-bold text-gray-800 shadow-sm"
                >
                  <option value="" disabled>Wybierz kategorię...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Prawa kolumna: Wybór sugestii */}
              <div className="w-full lg:w-2/3">
                 <label className="block text-xs font-black text-blue-800 uppercase tracking-widest mb-3">2. System poleci mu to:</label>
                 {activeSuggestionCat ? (
                   <div className="bg-white p-4 rounded-2xl border border-blue-200 h-72 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 shadow-sm custom-scrollbar">
                     {categories.filter(c => c.id !== activeSuggestionCat).map(targetCat => {
                       // Sprawdzamy czy powiązanie jest w naszym stanie (czyli czy checkbox ma być zaznaczony)
                       const isLinked = suggestions.some(s => s.source_category_id === activeSuggestionCat && s.suggested_category_id === targetCat.id);
                       
                       return (
                         <label key={targetCat.id} className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer transition border-2 ${isLinked ? 'bg-blue-50 border-blue-400' : 'hover:bg-gray-50 border-transparent'}`}>
                           <input
                             type="checkbox"
                             checked={isLinked}
                             onChange={() => toggleSuggestion(activeSuggestionCat, targetCat.id)}
                             className="w-6 h-6 accent-blue-600 rounded shrink-0 cursor-pointer"
                           />
                           <div className="min-w-0">
                             <span className={`block font-bold text-sm truncate ${isLinked ? 'text-blue-900' : 'text-gray-700'}`}>{targetCat.name}</span>
                             {targetCat.parent_id && <span className="block text-[10px] text-gray-400 uppercase font-black mt-0.5">Podkategoria</span>}
                           </div>
                         </label>
                       );
                     })}
                   </div>
                 ) : (
                   <div className="bg-white/40 border-2 border-blue-200 border-dashed rounded-2xl h-72 flex flex-col items-center justify-center text-blue-400">
                     <span className="text-4xl mb-2">👈</span>
                     <span className="font-bold text-sm">Najpierw wybierz kategorię z lewej</span>
                   </div>
                 )}
              </div>
            </div>
          </div>
  </div>
)}

      {/* MODAL: SZCZEGÓŁY UŻYTKOWNIKA */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-gray-900 p-6 text-white flex justify-between items-center">
              <h2 className="text-xl font-black">Przegląd konta</h2>
              <button onClick={() => setSelectedUser(null)} className="text-2xl hover:scale-125 transition">✕</button>
            </div>
            <div className="p-8">
              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start mb-8">
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gray-100 overflow-hidden border-4 border-gray-50 shrink-0">
                  {selectedUser.avatar_url ? <img src={selectedUser.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-5xl">👤</div>}
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="text-3xl font-black text-gray-900 mb-1">{selectedUser.username || 'Brak nazwy'}</h3>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${selectedUser.is_admin ? 'bg-purple-100 text-purple-700 border-purple-200 border' : 'bg-gray-100 text-gray-500'}`}>{selectedUser.is_admin ? '🛡️ Administrator' : 'Użytkownik'}</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${selectedUser.is_banned ? 'bg-red-600 text-white' : 'bg-green-100 text-green-700 border border-green-200'}`}>{selectedUser.is_banned ? '🔨 Zbanowany' : 'Konto aktywne'}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-6">
                <div className="bg-gray-50 p-4 rounded-2xl"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">ID</p><p className="text-xs font-mono break-all">{selectedUser.id}</p></div>
                <div className="bg-gray-50 p-4 rounded-2xl"><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Ostrzeżenia</p><p className="text-sm font-black text-orange-600">{selectedUser.warnings || 0}</p></div>
              </div>
              <div className="mt-8 flex flex-col md:flex-row gap-3">
                <Link href={`/sklep/${selectedUser.id}`} target="_blank" className="flex-1 bg-black text-white text-center py-4 rounded-2xl font-black hover:bg-gray-800 transition shadow-lg">Otwórz widok sklepu ➔</Link>
                <button onClick={() => toggleBanStatus(selectedUser.id, selectedUser.is_banned)} className={`flex-1 border-2 py-4 rounded-2xl font-black transition ${selectedUser.is_banned ? 'border-green-600 text-green-600 hover:bg-green-50' : 'border-red-600 text-red-600 hover:bg-red-50'}`}>
                  {selectedUser.is_banned ? 'Odblokuj konto' : '🔨 Zbanuj użytkownika'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}