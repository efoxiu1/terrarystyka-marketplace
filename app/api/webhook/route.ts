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
    const stringToHash = `${haslo_notyfikacji.trim()};${kwota.trim()};${id_platnosci.trim()};${id_zamowienia.trim()};${status.trim()};${secure.trim()};${sekret_uslugi.trim()}`;
    const calculatedHash = crypto.createHash('sha256').update(stringToHash).digest('hex');

    if (calculatedHash !== hash_od_hotpay) {
      console.error('❌ BŁĄD OCHRONY: Hash się nie zgadza (Ktoś próbuje nas oszukać!)');
      return new Response('ERROR_HASH', { status: 400 }); 
    }

    // 3. LOGIKA BIZNESOWA (Wydanie towaru lub pakietu)
    if (status === 'SUCCESS') {
        console.log(`💰 MAMY WPŁATĘ! Zamówienie: ${id_zamowienia}, Kwota: ${kwota} PLN`);
        
        // A. Oznaczamy całe zamówienie jako OPŁACONE i POBIERAMY JEGO DANE
        const { data: order, error: orderError } = await supabaseAdmin
          .from('orders')
          .update({ status: 'paid', hotpay_id: id_platnosci })
          .eq('id', id_zamowienia)
          .select()
          .single(); 
  
        if (orderError) {
            console.error("❌ BŁĄD SUPABASE (ORDERS):", orderError);
        }

        // B. SCENARIUSZ 1: KLIENT KUPIŁ PAKIET LIMITÓW (Ma zdefiniowany update_type)
        if (order && order.update_type) {
            
            // 1. Ustalamy czas trwania pakietu (pojedyncze 14 dni, reszta 30 dni)
            const daysValid = order.package_id === 'single' ? 14 : 30;
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + daysValid);
            
            const slotsToAdd = order.new_limit || 0;
            const packageName = order.package_id === 'single' ? 'Pojedyncze miejsce' : `Pakiet: ${order.package_id}`;

            // 2. Wrzucamy wpis do NASZEJ NOWEJ TABELI (purchased_packages)
            const { error: packageError } = await supabaseAdmin
              .from('purchased_packages')
              .insert([{
                  user_id: order.user_id,
                  package_name: packageName,
                  slots_added: slotsToAdd,
                  expires_at: expirationDate.toISOString()
              }]);

            if (packageError) {
                console.error("❌ BŁĄD SUPABASE (DODAWANIE PAKIETU):", packageError);
            } else {
                console.log(`📦 Zapisano pakiet (+${slotsToAdd} miejsc) do purchased_packages dla usera ${order.user_id}`);
            }

            // 3. Włączamy Weryfikację Sprzedawcy, jeśli to duży pakiet
            if (order.package_id !== 'single') {
                const { error: profileError } = await supabaseAdmin
                  .from('profiles')
                  .update({ is_verified_seller: true })
                  .eq('id', order.user_id);

                if (profileError) {
                    console.error("❌ BŁĄD SUPABASE (AKTUALIZACJA PROFILU):", profileError);
                } else {
                    console.log(`✅ Włączono weryfikację konta dla ${order.user_id}`);
                }
            }
        }
        
        // C. SCENARIUSZ 2: KLIENT KUPIŁ FIZYCZNY PRODUKT (Brak update_type)
        else if (order) {
            const { data: orderItems } = await supabaseAdmin
              .from('order_items')
              .select('listing_id, quantity')
              .eq('order_id', id_zamowienia);

            if (orderItems && orderItems.length > 0) {
                // Krok C1: Aktualizujemy stany magazynowe
                for (const item of orderItems) {
                    if (item.listing_id) {
                        const { data: listing } = await supabaseAdmin.from('listings').select('stock').eq('id', item.listing_id).single();
                        if (listing) {
                            const newStock = Math.max(0, (listing.stock || 0) - item.quantity);
                            await supabaseAdmin.from('listings').update({ stock: newStock, is_active: newStock > 0 }).eq('id', item.listing_id);
                        }
                    }
                }
                console.log(`🛒 Przetworzono ${orderItems.length} fizycznych przedmiotów z koszyka!`);

                // Krok C2: Czyścimy koszyk użytkownika z TYCH KONKRETNYCH przedmiotów
                const purchasedListingIds = orderItems.map(item => item.listing_id).filter(id => id !== null);
                
                if (purchasedListingIds.length > 0 && order.user_id) {
                    const { error: cartError } = await supabaseAdmin
                        .from('cart_items') 
                        .delete()
                        .eq('user_id', order.user_id)
                        .in('listing_id', purchasedListingIds); 

                    if (cartError) {
                        console.error("❌ BŁĄD SUPABASE (USUWANIE Z KOSZYKA):", cartError);
                    } else {
                        console.log("🗑️ Koszyk użytkownika został pomyślnie opróżniony z kupionych przedmiotów!");
                    }
                }
            }
        }

        console.log('✅ Skrypt webhooka obsłużył transakcję pomyślnie!');
    }

    // 4. Potwierdzamy odbiór (HotPay tego wymaga)
    return new Response('OK', { status: 200 });

  } catch (err: any) {
    console.error('❌ BŁĄD WEBHOOKA KRYTYCZNY:', err.message);
    return new Response('ERROR', { status: 500 });
  }
}