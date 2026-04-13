'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function MojeWiadomosci() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: any; // Deklarujemy zmienną dla kanału WebSocket

    const fetchInbox = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/logowanie');
        return null; // Zwracamy null, żeby nasłuchiwacz wiedział, czy jest zalogowany
      }

      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (msgError || !messages || messages.length === 0) {
        setConversations([]);
        setLoading(false);
        return user; // Zwracamy usera, mimo że nie ma jeszcze wiadomości
      }

      const adIds = [...new Set(messages.map(msg => msg.ad_id))];
      const partnerIds = [...new Set(messages.map(msg => msg.sender_id === user.id ? msg.receiver_id : msg.sender_id))];

      const { data: adsInfo } = await supabase.from('listings').select('id, title, price, image_url').in('id', adIds);
      const { data: profilesInfo } = await supabase.from('profiles').select('id, username, avatar_url').in('id', partnerIds);

      const convMap = new Map();

      messages.forEach(msg => {
        const isSender = msg.sender_id === user.id;
        const partnerId = isSender ? msg.receiver_id : msg.sender_id;
        const chatKey = `${msg.ad_id}_${partnerId}`;

        if (!convMap.has(chatKey)) {
          const adDetails = adsInfo?.find(ad => ad.id === msg.ad_id) || { title: 'Usunięte ogłoszenie', price: '---' };
          const partnerDetails = profilesInfo?.find(p => p.id === partnerId) || { username: 'Nieznany' };

          convMap.set(chatKey, {
            ad_id: msg.ad_id,
            partner_id: partnerId,
            listing: adDetails,
            partner: partnerDetails,
            last_message: msg.content || (msg.image_url ? '📷 Zdjęcie' : ''), // Poprawka: jeśli była tylko fota, pokaż słowo "Zdjęcie"
            last_message_date: msg.created_at,
            unread_count: 0
          });
        }

        if (!isSender && !msg.is_read) {
          convMap.get(chatKey).unread_count += 1;
        }
      });

      setConversations(Array.from(convMap.values()));
      setLoading(false);
      return user; // Po sukcesie zwracamy usera
    };

    // Uruchamiamy pierwsze pobranie, a po jego zakończeniu...
    fetchInbox().then((user) => {
      if (!user) return; // Jeśli użytkownik nie jest zalogowany, ignorujemy WebSockety

      // ...ODPALAMY RADAR!
      channel = supabase
        .channel('inbox_live_updates')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'messages' }, // Reagujemy na każdą zmianę w wiadomościach
          () => {
            // Gdy w bazie pojawi się nowa wiadomość LUB zostanie odczytana - pobieramy całą skrzynkę w ułamku sekundy
            fetchInbox();
          }
        )
        .subscribe();
    });

    // Funkcja sprzątająca (Wyłącza radar przy wyjściu z zakładki)
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  if (loading) return <div className="p-20 text-center font-bold text-gray-500 animate-pulse">Ładowanie skrzynki odbiorczej...</div>;

  return (
    <main className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-2xl border">✉️</div>
        <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">Wiadomości</h1>
      </div>

      {conversations.length === 0 ? (
        <div className="bg-gray-50 p-10 rounded-3xl border border-dashed text-center">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-gray-500 font-medium text-lg">Twoja skrzynka jest pusta.</p>
          <Link href="/" className="text-green-600 font-bold hover:underline mt-2 inline-block">
            Wróć na stronę główną i poszukaj zwierzaków!
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4 md:gap-6">
          {conversations.map((chat, index) => {
            const hasUnread = chat.unread_count > 0;
            
            return (
              <Link 
                key={index} 
                href={`/czat/${chat.ad_id}?partner=${chat.partner_id}`}
                className={`block rounded-3xl p-4 md:p-6 transition-all duration-300 group border-2 overflow-hidden ${
                  hasUnread 
                  ? 'bg-white border-blue-500 shadow-md' 
                  : 'bg-white border-transparent hover:border-gray-200 shadow-sm hover:shadow-md'
                }`}
              >
                <div className="flex gap-4 md:gap-6 w-full">
                  
                  {/* 1. Miniaturka - trzyma sztywny rozmiar */}
                  <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0">
                    <div className="w-full h-full bg-gray-100 rounded-2xl overflow-hidden border">
                      {chat.listing.image_url ? (
                        <img src={chat.listing.image_url} alt="Miniaturka" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">🦎</div>
                      )}
                    </div>
                    {hasUnread && (
                      <span className="absolute -top-2 -right-2 z-10 bg-red-500 text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse">
                        {chat.unread_count > 99 ? '99+' : chat.unread_count}
                      </span>
                    )}
                  </div>

                  {/* 2. Reszta zawartości - dodane min-w-0 żeby umożliwić ucinanie tekstu */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                    
                    {/* Górny pasek: Tytuł, Cena i Kto pisze */}
                    <div className="w-full min-w-0">
                      
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-1 md:gap-4 mb-2">
                        {/* TRUNCATE NA TYTULE */}
                        <h2 className="text-lg md:text-xl font-black text-gray-900 truncate" title={chat.listing.title}>
                          {chat.listing.title}
                        </h2>
                        <span className="text-green-600 font-black whitespace-nowrap bg-green-50 px-3 py-1 rounded-lg text-sm md:text-base w-max">
                          {chat.listing.price} PLN
                        </span>
                      </div>

                      {/* TRUNCATE NA NAZWIE UŻYTKOWNIKA */}
                      <div className="flex items-center gap-2 min-w-0 w-full">
                        <div className="w-5 h-5 rounded-full bg-gray-200 overflow-hidden shrink-0 border border-gray-300">
                          {chat.partner.avatar_url ? <img src={chat.partner.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-[10px]">👤</div>}
                        </div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest truncate flex-1" title={chat.partner.username}>
                          Rozmowa z: <span className="text-gray-900">{chat.partner.username}</span>
                        </p>
                      </div>
                    </div>

                    {/* Dymek Czatowy */}
                    <div className={`mt-4 relative flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4 p-3 md:p-4 rounded-2xl rounded-tl-sm w-full transition-colors min-w-0 ${
                      hasUnread 
                      ? 'bg-blue-50 border border-blue-100' 
                      : 'bg-gray-50 border border-gray-100 group-hover:bg-gray-100'
                    }`}>
                      
                      <p className={`text-sm md:text-base truncate flex-1 w-full min-w-0 ${hasUnread ? 'text-blue-900 font-bold' : 'text-gray-600 italic'}`}>
                        {hasUnread && <span className="mr-2">💬</span>}
                        {chat.last_message}
                      </p>
                      
                      <div className="flex justify-between w-full sm:w-auto items-center sm:justify-end gap-3 mt-1 sm:mt-0 shrink-0">
                        <span className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">
                          {new Date(chat.last_message_date).toLocaleDateString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        
                        {hasUnread && (
                          <span className="md:hidden bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-md uppercase shrink-0">
                            Nowa
                          </span>
                        )}
                      </div>

                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}