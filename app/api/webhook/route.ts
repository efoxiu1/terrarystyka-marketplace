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
    
    const kwota = params.get('KWOTA') || '';
    const id_zamowienia = params.get('ID_ZAMOWIENIA') || '';
    const id_platnosci = params.get('ID_PLATNOSCI') || '';
    const status = params.get('STATUS') || ''; 
    const sekret = params.get('SEKRET') || '';
    const secure = params.get('SECURE') || ''; 
    const hash_od_hotpay = params.get('HASH') || '';

    // WLEP SWOJE HASŁO TUTAJ
    const haslo = "haslo123";

    // Czasem HotPay wymusza dwa zera po przecinku do hasha, nawet jak wysyła liczbę całkowitą
    const kwotaZPrzecinkiem = parseFloat(kwota).toFixed(2);

    // 🔥 KRYPTOGRAFICZNY WYTRYCH: Generujemy wszystkie znane kombinacje API
    const wariantyHasha: Record<string, string> = {
        "V1_Dokumentacja": `${haslo};${kwota};${id_platnosci};${id_zamowienia};${status};${sekret}`,
        "V2_Z_Kropka": `${haslo};${kwotaZPrzecinkiem};${id_platnosci};${id_zamowienia};${status};${sekret}`,
        "V3_Z_Secure": `${haslo};${kwota};${id_platnosci};${id_zamowienia};${status};${secure};${sekret}`,
        "V4_Z_Secure_I_Kropka": `${haslo};${kwotaZPrzecinkiem};${id_platnosci};${id_zamowienia};${status};${secure};${sekret}`,
        "V5_Stare_API": `${haslo};${kwota};${id_zamowienia};${id_platnosci};${status};${sekret}`
    };

    let pasujacyWariant = null;

    // Przeszukujemy nasze kombinacje, żeby złamać szyfr banku
    for (const [nazwaWariantu, stringDoSzyfrowania] of Object.entries(wariantyHasha)) {
        const obliczonyHash = crypto.createHash('sha256').update(stringDoSzyfrowania).digest('hex');
        
        if (obliczonyHash === hash_od_hotpay) {
            pasujacyWariant = nazwaWariantu;
            break;
        }
    }

    // Jeśli żaden nie pasuje, to znaczy, że hasło jest na 100% błędne
    if (!pasujacyWariant) {
      console.error('❌ ŻADEN WARIANT NIE ZADZIAŁAŁ! Sprawdź, czy hasło na pewno jest prawidłowe.');
      return new Response('ERROR_HASH', { status: 400 }); 
    }

    console.log(`🔓 SUKCES! Złamaliśmy ich API. Pasujący wzór to: ${pasujacyWariant}`);

    // --- MAGIA BAZY DANYCH (Jeśli przejdzie zabezpieczenia) ---
    if (status === 'SUCCESS') {
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
            console.log('✅ Baza zaktualizowana pomyslnie!');
        }
    }

    return new Response('OK', { status: 200 });

  } catch (err: any) {
    console.error('❌ BŁĄD WEBHOOKA:', err.message);
    return new Response('ERROR', { status: 500 });
  }
}