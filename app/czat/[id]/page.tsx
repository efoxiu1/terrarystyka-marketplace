'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function WidokCzatu() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const adId = params.id as string;
  const partnerId = searchParams.get('partner'); 

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isBanned, setIsBanned] = useState(false);
  
  const [adDetails, setAdDetails] = useState<any>(null);
  const [partnerDetails, setPartnerDetails] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  
  const [newMessage, setNewMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showEmojis, setShowShowEmojis] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!partnerId) {
      router.push('/wiadomosci');
      return;
    }

    const fetchChatData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/logowanie'); return; }
      setCurrentUser(user);

      const { data: profile } = await supabase.from('profiles').select('is_banned').eq('id', user.id).single();
      setIsBanned(profile?.is_banned || false);

      const { data: adData } = await supabase.from('listings').select('*').eq('id', adId).single();
      const { data: partnerData } = await supabase.from('profiles').select('*').eq('id', partnerId).single();
      setAdDetails(adData);
      setPartnerDetails(partnerData);

      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('ad_id', adId)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      setMessages(msgData || []);

     if (msgData && msgData.length > 0) {
        const { error: updateError } = await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('ad_id', adId)
          .eq('sender_id', partnerId)
          .eq('receiver_id', user.id)
          .eq('is_read', false); // Aktualizuj tylko te, które faktycznie są nieprzeczytane
          
        if (updateError) {
          console.error("❌ Błąd przy oznaczaniu jako przeczytane:", updateError.message);
        } else {
          console.log("✅ Pomyślnie oznaczono wiadomości jako przeczytane!");
        }
      }
    };

    fetchChatData();
  }, [adId, partnerId, router]);
useEffect(() => {
    // Nie włączamy radaru, dopóki nie wiemy kim jesteśmy i z kim piszemy
    if (!currentUser || !partnerId || !adId) return;

    // Otwieramy kanał nasłuchujący
    const channel = supabase
      .channel('chat_room_updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // Nasłuchujemy TYLKO na nowe wiadomości
          schema: 'public',
          table: 'messages',
          filter: `ad_id=eq.${adId}` // Filtrujemy tylko wiadomości z tego ogłoszenia
        },
        (payload) => {
          const newMsg = payload.new;
          
          // Upewniamy się, że to wiadomość z naszej rozmowy
          const isRelevant = 
            (newMsg.sender_id === partnerId && newMsg.receiver_id === currentUser.id) ||
            (newMsg.sender_id === currentUser.id && newMsg.receiver_id === partnerId);

          if (isRelevant) {
            // INŻYNIERYJNY TRIK: Ignorujemy wiadomości wysłane przez nas samych, 
            // ponieważ nasza funkcja handleSendMessage dodaje je już do ekranu "optymistycznie" natychmiast po kliknięciu wyślij.
            if (newMsg.sender_id === currentUser.id) return;

            // Dodajemy nową wiadomość od partnera do ekranu
            setMessages(prev => [...prev, newMsg]);

            // Skoro mamy otwarty czat i patrzymy na ekran, od razu mówimy bazie: "Przeczytano!"
            supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id).then();
          }
        }
      )
      .subscribe();

    // Funkcja sprzątająca: zamykamy tunel, gdy użytkownik wyjdzie z czatu (oszczędzanie baterii i RAMu)
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, partnerId, adId]);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

 
 const handleSendMessage = async (e?: React.FormEvent, imageUrl: string | null = null) => {
    if (e) e.preventDefault();
    if (!currentUser || isBanned) return;
    
    const textToSend = newMessage.trim();
    if (!textToSend && !imageUrl) return;

    // Zamiast "cenzurować" linki, wysyłamy oryginalny tekst
    const tempMsg = {
      id: Math.random().toString(),
      sender_id: currentUser.id,
      receiver_id: partnerId,
      ad_id: adId,
      content: textToSend, // Wysyłamy surowy tekst
      image_url: imageUrl,
      created_at: new Date().toISOString(),
      is_read: false
    };
    
    setMessages(prev => [...prev, tempMsg]);
    setNewMessage('');
    setShowShowEmojis(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; 
    }

    await supabase.from('messages').insert([{
      sender_id: currentUser.id,
      receiver_id: partnerId,
      ad_id: adId,
      content: textToSend, // Wysyłamy surowy tekst do bazy
      image_url: imageUrl
    }]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setUploadingImage(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentUser.id}_${Math.random()}.${fileExt}`;
    const filePath = `chat_images/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('chat_images').upload(filePath, file);
    
    if (uploadError) {
      alert('Błąd wysyłania zdjęcia: ' + uploadError.message);
    } else {
      const { data } = supabase.storage.from('chat_images').getPublicUrl(filePath);
      await handleSendMessage(undefined, data.publicUrl);
    }
    setUploadingImage(false);
  };
const renderSafeMessage = (text: string, isMe: boolean) => {
    // Regex, który wyłapuje linki http://, https:// lub www.
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        // Jeśli brakuje http (np. samo www.google.pl), dodajemy je, by link działał
        let href = part;
        if (!href.startsWith('http')) href = `https://${href}`;

        return (
          <a
            key={i}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              // SYSTEMOWY BRAMKARZ 
              const confirmed = window.confirm(
                "🚨 OSTRZEŻENIE BEZPIECZEŃSTWA 🚨\n\n" +
                "Przechodzisz na zewnętrzną stronę:\n" + part + "\n\n" +
                "Nigdy nie podawaj haseł, danych logowania ani numerów kart płatniczych poza naszą platformą. Uważaj na oszustów próbujących przenieść transakcję na fałszywe strony (np. fałszywe paczkomaty).\n\n" +
                "Czy na pewno chcesz otworzyć ten link?"
              );
              // Jeśli użytkownik kliknie "Anuluj", blokujemy otwarcie karty!
              if (!confirmed) e.preventDefault(); 
            }}
            className={`font-black underline transition-colors break-all cursor-pointer ${
              isMe ? 'text-green-200 hover:text-white' : 'text-blue-600 hover:text-blue-800'
            }`}
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };
  
  const emojis = ['👍', '❤️', '🦎', '🐍', '🕷️', '😂', '👋', '✅', '❌', '🤝'];

  if (!adDetails || !partnerDetails) return <div className="p-20 text-center animate-pulse">Wczytywanie rozmowy...</div>;

  return (
    <main className="max-w-4xl mx-auto md:p-6 h-[calc(100vh-80px)] flex flex-col">
      
      {/* --- GÓRNY PASEK (PRZEBUDOWANY DLA TELEFONÓW) --- */}
      {/* --- GÓRNY PASEK: WERSJA ULTRA-KOMPAKTOWA --- */}
      <div className="bg-white border-b md:border md:rounded-t-3xl p-2 md:p-4 flex items-center justify-between gap-3 shadow-sm shrink-0 z-10 relative">
        
        {/* Lewa strona: Powrót i Rozmówca */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Link href="/wiadomosci" className="p-2 -ml-1 text-xl hover:bg-gray-100 rounded-full transition shrink-0">
            ⬅️
          </Link>
          
          <Link href={`/sklep/${partnerDetails.id}`} className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-gray-200 overflow-hidden shrink-0 border">
            {partnerDetails.avatar_url ? <img src={partnerDetails.avatar_url} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-xs">👤</div>}
          </Link>
          
          <div className="flex flex-col min-w-0">
            <Link href={`/sklep/${partnerDetails.id}`} className="text-sm md:text-base font-black text-gray-900 truncate hover:underline">
              {partnerDetails.username}
            </Link>
            <p className="text-[10px] md:text-xs font-bold text-gray-500 truncate mt-0.5" title={adDetails.title}>
              Dotyczy: <span className="text-gray-700">{adDetails.title}</span>
            </p>
          </div>
        </div>

        {/* Prawa strona: Mini-Ogłoszenie (Klikalne) */}
        <Link href={`/ogloszenie/${adDetails.id}`} className="flex items-center gap-2 bg-green-50 px-2 py-1.5 md:px-3 md:py-2 rounded-xl hover:bg-green-100 transition shrink-0 border border-green-100 group">
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg overflow-hidden shrink-0 border group-hover:scale-105 transition-transform">
            {adDetails.image_url ? <img src={adDetails.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px]">🦎</div>}
          </div>
          <p className="text-xs font-black text-green-700 hidden sm:block whitespace-nowrap">{adDetails.price} PLN</p>
        </Link>
      </div>

      {/* --- ŚRODEK: OKNO CZATU --- */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 md:border-x md:border-b flex flex-col gap-1">
        <div className="text-center py-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-200/50 inline-block px-4 py-1 rounded-full">
            Początek konwersacji
          </p>
          <p className="text-[10px] text-gray-400 mt-2">Dla własnego bezpieczeństwa nie przechodź na inne komunikatory.</p>
        </div>

        {messages.map((msg, index) => {
          const isMe = msg.sender_id === currentUser?.id;
          
          // --- LOGIKA GRUPOWANIA (Zwiększony czas do 5 minut) ---
          const nextMsg = messages[index + 1];
          const isNextSameSender = nextMsg && nextMsg.sender_id === msg.sender_id;
          
          const currentMsgTime = new Date(msg.created_at);
          const nextMsgTime = nextMsg ? new Date(nextMsg.created_at) : null;
          
          // Mierzymy różnicę w czasie (5 minut = 5 * 60 000 milisekund)
          const isNextWithinTime = nextMsgTime && 
            (nextMsgTime.getTime() - currentMsgTime.getTime() < 5 * 60000);

          const showTime = !isNextSameSender || !isNextWithinTime;

          // Zaokrąglanie dymków (jeśli są sklejone, nie pokazujemy ogonka)
          let bubbleShape = isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm';
          if (isNextSameSender && isNextWithinTime) {
             bubbleShape = isMe ? 'rounded-2xl rounded-tr-sm rounded-br-sm' : 'rounded-2xl rounded-tl-sm rounded-bl-sm';
          }

          // CIAŚNIEJSZE MARGINESY: mb-3 dla ostatniej w grupie, mb-[2px] dla wiadomości w środku
          return (
            <div key={index} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${showTime ? 'mb-1' : 'mb-[1px]'}`}>
              <div className={`max-w-[85%] md:max-w-[65%] flex flex-col min-w-0 ${isMe ? 'items-end' : 'items-start'}`}>
                
                {msg.image_url && (
                  <div className={`overflow-hidden rounded-2xl border-2 ${msg.content ? 'mb-1' : ''} ${isMe ? 'border-green-500 rounded-tr-sm' : 'border-gray-200 rounded-tl-sm shadow-sm'}`}>
                    <a href={msg.image_url} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={msg.image_url} className="max-w-[200px] max-h-[200px] object-cover hover:opacity-90 transition block" />
                    </a>
                  </div>
                )}

                {msg.content && (
                  <div 
                    className={`p-2.5 md:p-3 text-sm md:text-base shadow-sm ${bubbleShape} ${
                      isMe ? 'bg-green-600 text-white' : 'bg-white text-gray-800 border'
                    }`}
                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                  >
                    {renderSafeMessage(msg.content, isMe)}
                  </div>
                )}
                
                {/* Czas widoczny tylko na samym dole "paczki" wiadomości */}
                {showTime && (
                  <span className="text-[9px] text-gray-400 font-bold mt-1 uppercase">
                    {currentMsgTime.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* --- DÓŁ: PASEK WYSYŁANIA --- */}
      <div className="bg-white p-3 md:p-4 border-t md:border md:rounded-b-3xl shrink-0 relative">
        {showEmojis && (
          <div className="absolute bottom-[100%] left-4 bg-white border shadow-xl rounded-2xl p-2 mb-2 flex gap-2 animate-in slide-in-from-bottom-2">
            {emojis.map(emoji => (
              <button key={emoji} type="button" onClick={() => setNewMessage(prev => prev + emoji)} className="text-2xl hover:bg-gray-100 p-2 rounded-xl transition">
                {emoji}
              </button>
            ))}
          </div>
        )}

        {isBanned ? (
          <div className="text-center p-4 bg-red-50 rounded-xl border border-red-200">
            <p className="text-red-600 font-bold">🔨 Masz bana. Nie możesz pisać wiadomości.</p>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <button type="button" onClick={() => setShowShowEmojis(!showEmojis)} className="p-3 text-xl bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl transition border shrink-0">
              😀
            </button>
            <label className={`p-3 text-xl bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl transition border shrink-0 cursor-pointer flex items-center justify-center ${uploadingImage ? 'opacity-50' : ''}`}>
              {uploadingImage ? '⏳' : '📎'}
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} className="hidden" />
            </label>
           <textarea 
              ref={textareaRef}
              value={newMessage} 
              maxLength={2000}
              onChange={e => {
                setNewMessage(e.target.value);
                e.target.style.height = 'auto'; 
                e.target.style.height = `${e.target.scrollHeight}px`;
              }} 
              rows={1}
              placeholder="Napisz..." 
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-green-600 transition resize-none max-h-32 leading-tight overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ wordBreak: 'break-word' }}
            />
            
            {/* ZMODYFIKOWANY PRZYCISK WYŚLIJ - Samolot na tel, napis na PC */}
            <button 
              type="submit" 
              disabled={!newMessage.trim() && !uploadingImage} 
              className="bg-black text-white p-3 md:px-6 rounded-2xl font-black hover:bg-gray-800 transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0 flex items-center justify-center w-12 h-12 md:w-auto md:h-auto"
            >
              <span className="hidden md:inline">Wyślij</span>
              
              {/* Ikonka dla telefonu */}
              <svg className="w-5 h-5 md:hidden ml-[-2px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        )}
      </div>

    </main>
  );
}