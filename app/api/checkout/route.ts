import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, packageId, updateType } = body;

    if (!userId || !packageId) {
      return NextResponse.json({ error: 'Brakujące dane' }, { status: 400 });
    }

    // 1. Bezpieczne pobranie cennika z bazy
    const { data: allPlans } = await supabaseAdmin.from('pricing_plans').select('*');
    const { data: profile } = await supabaseAdmin.from('profiles').select('max_active_listings').eq('id', userId).single();

    const selectedPackage = allPlans?.find(p => p.id === packageId);
    const currentLimit = profile?.max_active_listings || 2;

    if (!selectedPackage) return NextResponse.json({ error: 'Nie znaleziono pakietu' }, { status: 404 });

    // --- MATEMATYKA DOPŁAT I ZNIŻEK ---
    let finalPricePln = selectedPackage.price_pln;
    let isUpgrade = false;

    const ownedPlans = allPlans!.filter(p => p.id !== 'single' && p.listing_limit <= currentLimit);
    const maxOwnedValue = ownedPlans.reduce((max, p) => Math.max(max, p.price_pln), 0);

    if (packageId !== 'single') {
      if (selectedPackage.price_pln > maxOwnedValue && maxOwnedValue > 0) {
        finalPricePln = selectedPackage.price_pln - maxOwnedValue;
        isUpgrade = true;
      }
    }

    if (finalPricePln <= 0) return NextResponse.json({ error: 'Błąd kalkulacji ceny' }, { status: 400 });

    const kwota = (finalPricePln / 100).toFixed(2);

    // 2. TWORZENIE ZAMÓWIENIA W BAZIE (Serwer to robi, nikt tego nie oszuka!)
    const { data: order, error: orderError } = await supabaseAdmin.from('orders').insert([{
        user_id: userId,
        total_amount: parseFloat(kwota),
        status: 'pending_payment',
        payment_provider: 'hotpay',
        new_limit: packageId === 'single' ? 1 : selectedPackage.listing_limit, 
        update_type: updateType, // 'add' lub 'replace'
        package_id: packageId
    }]).select().single();

    if (orderError) throw orderError;

    // 3. GENEROWANIE LINKU DO BANKU HOTPAY
    const sekret = process.env.HOTPAY_SECRET;
    const haslo = process.env.HOTPAY_PASSWORD;

    if (!sekret || !haslo) throw new Error("Brak kluczy HotPay w .env.local");

    const czystySekret = sekret.trim();
    const czysteHaslo = haslo.trim();
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, "");

    const nazwa_uslugi = isUpgrade ? `Dopłata (Upgrade): ${selectedPackage.name}` : selectedPackage.name;
    const adres_www = `${siteUrl}/dodaj-ogloszenie?success=true`; // Powrót po zapłacie

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
    console.error('BŁĄD ZAKUPU PAKIETU:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}