import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { userId, shippingData, selectedMethods, selectedLockerIds, estimatedShippingCost } = await req.json();

    if (!userId) return NextResponse.json({ error: 'Brak użytkownika' }, { status: 400 });

    // 1. ZABEZPIECZENIE: Pobieramy koszyk prosto z bazy. Użytkownik nie może tego sfałszować.
    const { data: cartItems } = await supabaseAdmin
      .from('cart_items')
      .select(`
        id,
        quantity,
        listing:listings(id, title, price),
        variant:listing_variants(id, name, price)
      `)
      .eq('user_id', userId);

    if (!cartItems || cartItems.length === 0) {
       return NextResponse.json({ error: 'Koszyk jest pusty' }, { status: 400 });
    }

    // 2. Twarda weryfikacja cen
    let realItemsTotal = 0;
    const allItemsToInsert = [];

    for (const item of cartItems) {
       // Wyciągamy PRAWDZIWE ceny z bazy danych, ignorując front
       const listing = Array.isArray(item.listing) ? item.listing[0] : item.listing;
       const variant = Array.isArray(item.variant) ? item.variant[0] : item.variant;

       const realPrice = (variant && variant.price) ? variant.price : listing?.price;
       const finalPrice = parseFloat(realPrice) || 0;

       realItemsTotal += finalPrice * item.quantity;

       allItemsToInsert.push({
         listing_id: listing?.id,
         quantity: item.quantity || 1,
         price_at_purchase: finalPrice // Ta cena jest w 100% zaufana
       });
    }

    // 3. Dodajemy koszt wysyłki. 
    const finalTotalAmount = realItemsTotal + (parseFloat(estimatedShippingCost) || 0);

    // 4. Tworzymy zamówienie
    const { data: order, error: orderError } = await supabaseAdmin.from('orders').insert([{
        user_id: userId,
        total_amount: finalTotalAmount,
        shipping_details: {
           address: shippingData,
           methods: selectedMethods,
           lockers: selectedLockerIds
        },
        payment_provider: 'hotpay',
        status: 'pending_payment'
    }]).select().single();

    if (orderError) throw orderError;

    // 5. Przenosimy bezpieczne przedmioty do zamówienia
    const itemsWithOrderId = allItemsToInsert.map(i => ({ ...i, order_id: order.id }));
    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(itemsWithOrderId);

    if (itemsError) throw itemsError;

    // 6. Generujemy link do HotPay używając naszej zaufanej, serwerowej kwoty
    const sekret = process.env.HOTPAY_SECRET;
    const haslo = process.env.HOTPAY_PASSWORD;
    
    if (!sekret || !haslo) throw new Error("Brak kluczy HotPay w .env");

    const czystySekret = sekret.trim();
    const czysteHaslo = haslo.trim();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, "");

    const kwota = finalTotalAmount.toFixed(2);
    const nazwa_uslugi = `Zamowienie_${order.id.slice(0, 8)}`;
    const adres_www = `${siteUrl}/moje-konto/zamowienia`;

    const stringToHash = `${czysteHaslo};${kwota};${nazwa_uslugi};${adres_www};${order.id};${czystySekret}`;
    const hash = crypto.createHash('sha256').update(stringToHash).digest('hex');

    const params = new URLSearchParams({
      SEKRET: czystySekret,
      KWOTA: kwota,
      NAZWA_USLUGI: nazwa_uslugi,
      ADRES_WWW: adres_www,
      ID_ZAMOWIENIA: order.id,
      HASH: hash
    });

    const paymentUrl = `https://platnosc.hotpay.pl/?${params.toString()}`;

    return NextResponse.json({ url: paymentUrl });

  } catch (err: any) {
    console.error("Błąd tworzenia zamówienia:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}