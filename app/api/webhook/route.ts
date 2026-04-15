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
        
        // 1. Oznaczamy całe zamówienie jako OPŁACONE
        await supabaseAdmin
          .from('orders')
          .update({ status: 'paid', hotpay_id: id_platnosci })
          .eq('id', id_zamowienia);
  
        // 2. NOWE: Pobieramy listę zakupionych przedmiotów z koszyka (order_items)
        const { data: orderItems } = await supabaseAdmin
          .from('order_items')
          .select('listing_id, quantity')
          .eq('order_id', id_zamowienia);

        // 3. NOWE: Aktualizujemy konkretne ogłoszenia (listings)
        if (orderItems && orderItems.length > 0) {
            for (const item of orderItems) {
                if (item.listing_id) {
                    // Tutaj decydujesz, co się dzieje z kupionym ogłoszeniem. 
                    // Np. zmieniamy is_active na false (ukrywamy je), bo zostało sprzedane.
                    await supabaseAdmin
                        .from('listings')
                        .update({ is_active: false }) // <-- Możesz tu też np. odjąć stock: stary_stock - item.quantity
                        .eq('id', item.listing_id);
                }
            }
            console.log(`🛒 Przetworzono ${orderItems.length} przedmiotów z koszyka!`);
        }

        console.log('✅ Baza danych zaktualizowana. Transakcja zakończona!');
    }

    // 4. Potwierdzamy odbiór (HotPay tego wymaga)
    return new Response('OK', { status: 200 });

  } catch (err: any) {
    console.error('❌ BŁĄD WEBHOOKA KRYTYCZNY:', err.message);
    return new Response('ERROR', { status: 500 });
  }
}