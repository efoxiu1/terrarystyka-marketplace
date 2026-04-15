import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // HotPay przysyła dane jako formularz, a nie JSON
    const formData = await req.formData();
    
    const kwota = formData.get('KWOTA') as string;
    const id_zamowienia = formData.get('ID_ZAMOWIENIA') as string;
    const id_platnosci = formData.get('ID_PLATNOSCI') as string;
    const status = formData.get('STATUS') as string; 
    const sekret_uslugi = formData.get('SEKRET') as string;
    const hash_od_hotpay = formData.get('HASH') as string;

    const haslo_notyfikacji = process.env.HOTPAY_PASSWORD;

    if (!haslo_notyfikacji || !sekret_uslugi) {
        throw new Error("Brak kluczy do weryfikacji na serwerze!");
    }

    // 🔥 POPRAWIONA KOLEJNOŚĆ HASHA DLA NOTYFIKACJI WG. DOKUMENTACJI 🔥
    // Wzór: HASLO ; KWOTA ; ID_PLATNOSCI ; ID_ZAMOWIENIA ; STATUS ; SEKRET
    const stringToHash = `${haslo_notyfikacji.trim()};${kwota.trim()};${id_platnosci.trim()};${id_zamowienia.trim()};${status.trim()};${sekret_uslugi.trim()}`;
    const calculatedHash = crypto.createHash('sha256').update(stringToHash).digest('hex');

    if (calculatedHash !== hash_od_hotpay) {
      console.error('❌ BŁĄD OCHRONY: Nieprawidłowy Hash od HotPay!');
      // Wypisujemy oba hashe do logów Vercela na wszelki wypadek
      console.log(`Otrzymany z HotPay: ${hash_od_hotpay}`);
      console.log(`Nasz obliczony: ${calculatedHash}`);
      return NextResponse.json({ error: 'Invalid hash' }, { status: 400 });
    }

    // Jeśli płatność się udała...
    if (status === 'SUCCESS') {
        console.log(`💰 MAMY WPŁATĘ! Zamówienie: ${id_zamowienia}, Kwota: ${kwota}`);
        
        // --- LOGIKA AKTUALIZACJI BAZY SUPABASE ---
        const { data: order, error: orderError } = await supabaseAdmin
          .from('orders')
          .select('*')
          .eq('id', id_zamowienia)
          .single();
  
        if (!orderError && order) {
            const userId = order.user_id;
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
      
              // Włamujemy się do bazy jako admin i zmieniamy limit
              await supabaseAdmin.from('profiles').update({ max_active_listings: finalLimit }).eq('id', userId);
              
              // Oznaczamy zamówienie jako opłacone
              await supabaseAdmin.from('orders').update({ status: 'paid', hotpay_id: id_platnosci }).eq('id', id_zamowienia);
              console.log('✅ Baza zaktualizowana pomyslnie!');
            }
        }
    }

    // HotPay wymaga, by odpowiedzieć krótkim komunikatem "OK"
    return new Response('OK', { status: 200 });

  } catch (err: any) {
    console.error('❌ BŁĄD WEBHOOKA:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}