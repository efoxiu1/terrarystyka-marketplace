import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. POBIERAMY SUROWY TEKST (Bez magicznego formData() z Next.js, które może ucinać znaki)
    const rawBody = await req.text();
    console.log('--- SUROWE DANE OD HOTPAY ---', rawBody);

    const params = new URLSearchParams(rawBody);
    
    const kwota = params.get('KWOTA') || '';
    const id_zamowienia = params.get('ID_ZAMOWIENIA') || '';
    const id_platnosci = params.get('ID_PLATNOSCI') || '';
    const status = params.get('STATUS') || ''; 
    const sekret_uslugi = params.get('SEKRET') || '';
    const hash_od_hotpay = params.get('HASH') || '';

    // 2. HASŁO NA TWARDO (Żeby wykluczyć błąd ze spacjami w Vercel ENV)
    const haslo_notyfikacji = "haslo123";

    // 3. Wzór wg. dokumentacji
    const stringToHash = `${haslo_notyfikacji};${kwota};${id_platnosci};${id_zamowienia};${status};${sekret_uslugi}`;
    
    // Logujemy to, co złączyliśmy (ukrywamy hasło dla bezpieczeństwa logów)
    console.log('--- NASZ STRING DO HASHA ---', `***HASLO***;${kwota};${id_platnosci};${id_zamowienia};${status};${sekret_uslugi}`);

    const calculatedHash = crypto.createHash('sha256').update(stringToHash).digest('hex');

    if (calculatedHash !== hash_od_hotpay) {
      console.error('❌ BŁĄD OCHRONY: Nieprawidłowy Hash!');
      console.log(`Oczekiwano (HotPay): ${hash_od_hotpay}`);
      console.log(`Obliczono (Nasz):  ${calculatedHash}`);
      return new Response('ERROR_HASH', { status: 400 }); 
    }

    if (status === 'SUCCESS') {
        console.log(`💰 MAMY WPŁATĘ! Zamówienie: ${id_zamowienia}`);
        
        const { data: order } = await supabaseAdmin.from('orders').select('*').eq('id', id_zamowienia).single();
  
        if (order && order.user_id) {
            const newLimit = order.new_limit || 10; 
            const updateType = order.update_type || 'replace';
            let finalLimit = newLimit;
    
            if (updateType === 'add') {
                const { data: profile } = await supabaseAdmin.from('profiles').select('max_active_listings').eq('id', order.user_id).single();
                finalLimit = (profile?.max_active_listings || 2) + newLimit; 
            }
    
            await supabaseAdmin.from('profiles').update({ max_active_listings: finalLimit }).eq('id', order.user_id);
            await supabaseAdmin.from('orders').update({ status: 'paid', hotpay_id: id_platnosci }).eq('id', id_zamowienia);
            console.log('✅ Baza zaktualizowana!');
        }
    }

    // HotPay oczekuje zwykłego tekstu jako odpowiedzi
    return new Response('OK', { status: 200 });

  } catch (err: any) {
    console.error('❌ BŁĄD WEBHOOKA:', err.message);
    return new Response('ERROR', { status: 500 });
  }
}