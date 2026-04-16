import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);
    
    // 1. Odbieramy wszystkie parametry od kuriera (HotPay)
    const kwota = params.get('KWOTA') || '';
    const id_zamowienia = params.get('ID_ZAMOWIENIA') || '';
    const id_platnosci = params.get('ID_PLATNOSCI') || '';
    const status = params.get('STATUS') || ''; 
    const sekret_uslugi = params.get('SEKRET') || '';
    const secure = params.get('SECURE') || ''; 
    const hash_od_hotpay = params.get('HASH') || '';

    // Pobieramy bezpiecznie hasło z Vercela
    const haslo_notyfikacji = process.env.HOTPAY_PASSWORD;

    if (!haslo_notyfikacji) {
      console.error("❌ BŁĄD SERWERA: Brak HOTPAY_PASSWORD w zmiennych środowiskowych!");
      return new Response('ERROR_ENV', { status: 500 });
    }

    // 2. TWORZENIE HASHA - WZÓR V3 (Zwycięzca!)
    // HASŁO ; KWOTA ; ID_PLATNOSCI ; ID_ZAMOWIENIA ; STATUS ; SECURE ; SEKRET
    const stringToHash = `${haslo_notyfikacji.trim()};${kwota.trim()};${id_platnosci.trim()};${id_zamowienia.trim()};${status.trim()};${secure.trim()};${sekret_uslugi.trim()}`;
    const calculatedHash = crypto.createHash('sha256').update(stringToHash).digest('hex');

    if (calculatedHash !== hash_od_hotpay) {
      console.error('❌ BŁĄD OCHRONY: Hash się nie zgadza (Ktoś próbuje nas oszukać!)');
      return new Response('ERROR_HASH', { status: 400 }); 
    }

    // 3. LOGIKA BIZNESOWA (Wydanie towaru)
    if (status === 'SUCCESS') {
        console.log(`💰 MAMY WPŁATĘ! Zamówienie: ${id_zamowienia}, Kwota: ${kwota} PLN`);
        
        // 1. Oznaczamy całe zamówienie jako OPŁACONE (Z wyciągnięciem błędu!)
        const { error: orderError } = await supabaseAdmin
          .from('orders')
          .update({ status: 'paid', hotpay_id: id_platnosci })
          .eq('id', id_zamowienia);
  
        if (orderError) {
            console.error("❌ BŁĄD SUPABASE (ORDERS):", orderError);
        }

        // 2. NOWE: Pobieramy listę zakupionych przedmiotów z koszyka
        const { data: orderItems, error: itemsError } = await supabaseAdmin
          .from('order_items')
          .select('listing_id, quantity')
          .eq('order_id', id_zamowienia);

        if (itemsError) {
            console.error("❌ BŁĄD SUPABASE (POBIERANIE KOSZYKA):", itemsError);
        }

        // 3. NOWE: Aktualizujemy konkretne ogłoszenia
        // 3. AKTUALIZACJA STANÓW MAGAZYNOWYCH
if (orderItems && orderItems.length > 0) {
    for (const item of orderItems) {
        if (item.listing_id) {
            // 1. Najpierw pobieramy aktualny stan, żeby wiedzieć ile odjąć
            const { data: listing } = await supabaseAdmin
                .from('listings')
                .select('quantity')
                .eq('id', item.listing_id)
                .single();

            if (listing) {
                const currentStock = listing.quantity || 0;
                const newStock = Math.max(0, currentStock - item.quantity); // Nie schodzimy poniżej zera

                // 2. Aktualizujemy stan i opcjonalnie wyłączamy, jeśli spadło do 0
                await supabaseAdmin
                    .from('listings')
                    .update({ 
                        quantity: newStock,
                        // Jeśli chcesz, żeby ogłoszenie znikało dopiero gdy braknie towaru:
                    })
                    .eq('id', item.listing_id);
                
                console.log(`📦 Zaktualizowano magazyn dla ${item.listing_id}: ${currentStock} -> ${newStock}`);
            }
        }
    }
}

        console.log('✅ Skrypt webhooka dotarł do końca!');
        // ---------------------------------------------------------
        // 4. CZYSZCZENIE KOSZYKA UŻYTKOWNIKA (Automatyczne usuwanie)
        // ---------------------------------------------------------
        
        // Krok A: Pobieramy ID użytkownika z zamówienia, żeby wiedzieć CZYJ koszyk czyścić
        const { data: orderData } = await supabaseAdmin
            .from('orders')
            .select('user_id')
            .eq('id', id_zamowienia)
            .single();

        if (orderData && orderData.user_id) {
          // Krok B: Wyciągamy same ID ogłoszeń (listing_id) do jednej tablicy
        // TypeScript FIX: Jeśli orderItems jest null, użyj pustej tablicy []
        const purchasedListingIds = (orderItems || [])
            .map(item => item.listing_id)
            .filter(id => id !== null);
            
            // Krok C: Kasujemy z koszyka TYLKO zakupione przedmioty
            if (purchasedListingIds.length > 0) {
                const { error: cartError } = await supabaseAdmin
                    .from('cart_items') // Upewnij się, że tak nazywa się Twoja tabela koszyka!
                    .delete()
                    .eq('user_id', orderData.user_id)
                    .in('listing_id', purchasedListingIds); // Magia Supabase: Usuń wszystko, co jest na tej liście

                if (cartError) {
                    console.error("❌ BŁĄD SUPABASE (USUWANIE Z KOSZYKA):", cartError);
                } else {
                    console.log("🗑️ Koszyk użytkownika został pomyślnie opróżniony z kupionych przedmiotów!");
                }
            }
        }
        // ---------------------------------------------------------
    }

    // 4. Potwierdzamy odbiór (HotPay tego wymaga)
    return new Response('OK', { status: 200 });

  } catch (err: any) {
    console.error('❌ BŁĄD WEBHOOKA KRYTYCZNY:', err.message);
    return new Response('ERROR', { status: 500 });
  }
}