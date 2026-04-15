import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// 1. Inicjalizacja Admina (Service Role)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 2. HotPay wysyła dane jako formularz (URLSearchParams), a nie JSON
    const formData = await req.formData();
    
    const kwota = formData.get('KWOTA') as string;
    const id_zamowienia = formData.get('ID_ZAMOWIENIA') as string;
    const id_platnosci = formData.get('ID_PLATNOSCI') as string;
    const status = formData.get('STATUS') as string; // SUCCESS lub FAILURE
    const sekret_uslugi = formData.get('SEKRET') as string;
    const hash_od_hotpay = formData.get('HASH') as string;

    const haslo_notyfikacji = process.env.HOTPAY_PASSWORD;

    // 3. WERYFIKACJA HASHU (Pieczęć bezpieczeństwa)
    // Wzór HotPay: SHA256(HASLO_NOTYFIKACJI;KWOTA;ID_ZAMOWIENIA;ID_PLATNOSCI;STATUS;SEKRET)
    const stringToHash = `${haslo_notyfikacji};${kwota};${id_zamowienia};${id_platnosci};${status};${sekret_uslugi}`;
    const calculatedHash = crypto.createHash('sha256').update(stringToHash).digest('hex');

    if (calculatedHash !== hash_od_hotpay) {
      console.error('❌ BŁĄD OCHRONY: Nieprawidłowy Hash od HotPay!');
      return NextResponse.json({ error: 'Invalid hash' }, { status: 400 });
    }

    // 4. LOGIKA BIZNESOWA: Jeśli zapłacone...
    if (status === 'SUCCESS') {
      console.log(`💰 MAMY WPŁATĘ! Zamówienie: ${id_zamowienia}, Kwota: ${kwota}`);

      /* UWAGA: W HotPay nie mamy 'metadata'. Informacje o userze musisz 
         wyciągnąć z ID_ZAMOWIENIA lub z bazy danych. 
         Załóżmy, że ID_ZAMOWIENIA to ID rekordu w Twojej tabeli 'orders'.
      */
      
      // A. Pobieramy zamówienie z bazy, żeby wiedzieć kto kupił i co
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('*')
        .eq('id', id_zamowienia)
        .single();

      if (orderError || !order) {
        // Jeśli nie znaleźliśmy zamówienia po ID, może to był pakiet ogłoszeń?
        // Tutaj musisz dostosować logikę pod to, jak generujesz ID_ZAMOWIENIA.
        console.error('❌ Nie znaleziono zamówienia w bazie:', id_zamowienia);
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      const userId = order.user_id;
      // Przyjmijmy, że w tabeli orders masz kolumnę 'package_limit' lub podobną
      const newLimit = order.new_limit || 10; 
      const updateType = order.update_type || 'replace';

      if (userId) {
        let finalLimit = newLimit;

        if (updateType === 'add') {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('max_active_listings')
            .eq('id', userId)
            .single();
            
          const currentLimit = profile?.max_active_listings || 2;
          finalLimit = currentLimit + newLimit; 
        }

        // B. Aktualizujemy limit użytkownika
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ max_active_listings: finalLimit })
          .eq('id', userId);

        // C. Oznaczamy zamówienie jako opłacone
        await supabaseAdmin
          .from('orders')
          .update({ status: 'paid', hotpay_id: id_platnosci })
          .eq('id', id_zamowienia);

        if (updateError) {
          console.error('❌ BŁĄD AKTUALIZACJI PROFILU:', updateError);
          return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
        }
      }
    }

    // HotPay wymaga, aby odpowiedzieć po prostu "OK" lub "YES" (zależnie od dokumentacji, zazwyczaj YES)
    return new Response('YES', { status: 200 });

  } catch (err: any) {
    console.error('❌ BŁĄD WEBHOOKA:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}