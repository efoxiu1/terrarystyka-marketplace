import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto'; // Zamiast stripe dodajemy crypto do HotPaya

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, packageId, isSubscriptionChoice } = body; 

    if (!userId || !packageId) {
      return NextResponse.json({ error: 'Brakujące dane' }, { status: 400 });
    }

    const { data: allPlans } = await supabaseAdmin.from('pricing_plans').select('*');
    const { data: profile } = await supabaseAdmin.from('profiles').select('max_active_listings').eq('id', userId).single();
    
    const selectedPackage = allPlans?.find(p => p.id === packageId);
    const currentLimit = profile?.max_active_listings || 2;

    if (!selectedPackage) return NextResponse.json({ error: 'Nie znaleziono pakietu' }, { status: 404 });

    // --- MATEMATYKA DOPŁAT I BAGAŻU (Zostaje nietknięta!) ---
    let finalPricePln = selectedPackage.price_pln;
    let isUpgrade = false;

    const ownedPlans = allPlans!.filter(p => p.id !== 'single' && p.listing_limit <= currentLimit);
    const maxOwnedLimit = ownedPlans.reduce((max, p) => Math.max(max, p.listing_limit), 2); 
    const maxOwnedValue = ownedPlans.reduce((max, p) => Math.max(max, p.price_pln), 0);

    const extraListings = Math.max(0, currentLimit - maxOwnedLimit);
    const targetLimit = packageId === 'single' ? selectedPackage.listing_limit : selectedPackage.listing_limit + extraListings;

    if (packageId !== 'single') {
      if (selectedPackage.price_pln > maxOwnedValue && maxOwnedValue > 0) {
        finalPricePln = selectedPackage.price_pln - maxOwnedValue;
        isUpgrade = true;
      }
    }

    if (finalPricePln < 100) return NextResponse.json({ error: 'Błąd kalkulacji zniżki lub cena za niska' }, { status: 400 });

    // --- NOWOŚĆ: INTEGRACJA Z HOTPAY ---
    const sekret = process.env.HOTPAY_SECRET;
    const haslo = process.env.HOTPAY_PASSWORD;

    if (!sekret || !haslo) {
      throw new Error("Brak kluczy HotPay na serwerze Vercel");
    }

    // Stripe używa groszy (np. 1500), HotPay używa złotówek (np. "15.00")
    const kwota = (finalPricePln / 100).toFixed(2);
    const nazwa_uslugi = isUpgrade ? `Dopłata (Upgrade): ${selectedPackage.name}` : selectedPackage.name;
    
    // Tworzymy unikalne ID zamówienia dla tego pakietu (np. PKG_abc12_vip)
    const orderId = `PKG_${userId.slice(0, 5)}_${packageId}`;
    
    // Adres, na który bank wyrzuci klienta po zapłacie
    const adres_www = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/dodaj-ogloszenie?success=true`;

    // Budujemy Hash dla bezpieczeństwa
    const stringToHash = `${haslo};${kwota};${nazwa_uslugi};${adres_www};${orderId};${sekret}`;
    const hash = crypto.createHash('sha256').update(stringToHash).digest('hex');

    // Generujemy link do banku
    const paymentUrl = `https://platnosc.hotpay.pl/?SEKRET=${sekret}&KWOTA=${kwota}&NAZWA_USLUGI=${encodeURIComponent(nazwa_uslugi)}&ADRES_WWW=${encodeURIComponent(adres_www)}&ID_ZAMOWIENIA=${orderId}&HASH=${hash}`;

    return NextResponse.json({ url: paymentUrl });
    
  } catch (err: any) {
    console.error('❌ BŁĄD HOTPAY:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}