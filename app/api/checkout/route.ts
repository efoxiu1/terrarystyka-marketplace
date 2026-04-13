import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // NOWOŚĆ: Odbieramy z Reacta zmienną `isSubscriptionChoice`
    const { userId, packageId, isSubscriptionChoice } = body; 

    if (!userId || !packageId) {
      return NextResponse.json({ error: 'Brakujące dane' }, { status: 400 });
    }

    const { data: allPlans } = await supabaseAdmin.from('pricing_plans').select('*');
    const { data: profile } = await supabaseAdmin.from('profiles').select('max_active_listings').eq('id', userId).single();
    
    const selectedPackage = allPlans?.find(p => p.id === packageId);
    const currentLimit = profile?.max_active_listings || 2;

    if (!selectedPackage) return NextResponse.json({ error: 'Nie znaleziono pakietu' }, { status: 404 });

    // --- MATEMATYKA DOPŁAT I BAGAŻU (Zostaje jak była) ---
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

    // --- NOWOŚĆ: INTELIGENTNY TRYB PŁATNOŚCI ---
    // Subskrypcja odpala się TYLKO gdy to nie jest "pojedyncze ogłoszenie" ORAZ klient zaznaczył to na stronie.
    const isSubscription = packageId !== 'single' && isSubscriptionChoice === true;
    
    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ['card', 'blik'],
      line_items: [
        {
          price_data: {
            currency: 'pln',
            product_data: {
              name: isUpgrade ? `Dopłata (Upgrade): ${selectedPackage.name}` : selectedPackage.name,
              description: isSubscription ? 'Abonament miesięczny (odnawialny).' : 'Dostęp na 30 dni (płatność jednorazowa).',
            },
            unit_amount: finalPricePln,
            // Magia Stripe: doczepiamy recurring tylko, jeśli to faktycznie subskrypcja
            ...(isSubscription ? { recurring: { interval: 'month' } } : {}), 
          },
          quantity: 1,
        },
      ],
      // Zmieniamy tryb kasy w zależności od wyboru klienta
      mode: isSubscription ? 'subscription' : 'payment',
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dodaj-ogloszenie?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/dodaj-ogloszenie?canceled=true`,
    };

    const myMetadata = {
      supabase_user_id: userId,
      new_limit: targetLimit.toString(),
      update_type: packageId === 'single' ? 'add' : 'replace'
    };

    if (isSubscription) {
      sessionConfig.subscription_data = { metadata: myMetadata };
    } else {
      sessionConfig.metadata = myMetadata;
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return NextResponse.json({ url: session.url });
    
  } catch (err: any) {
    console.error('❌ BŁĄD STRIPE:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}