import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// 1. Inicjalizacja Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-03-25.dahlia',
});

// 2. UWAGA INŻYNIERSKA: Używamy "Service Role Key"!
// Dlaczego? Kurier ze Stripe to nie jest zalogowany użytkownik w przeglądarce. 
// Normalnie Supabase zablokowałby mu dostęp. Używamy "klucza admina" (Service Role), 
// żeby przebić się przez zabezpieczenia (RLS) i na twardo zmienić limit w bazie.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

export async function POST(req: Request) {
  // Pobieramy surowe dane (list od kuriera) i "podpis" (pieczęć z wosku)
  const payload = await req.text();
  const sig = req.headers.get('stripe-signature');

  let event;

  try {
    // 3. WERYFIKACJA: Sprawdzamy pieczęć. 
    // Zabezpiecza nas to przed hakerami, którzy mogliby wysyłać fałszywe żądania "Daj mi 100 ogłoszeń"
    event = stripe.webhooks.constructEvent(payload, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('❌ BŁĄD OCHRONY (Fałszywy kurier):', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // 4. Jeśli płatność faktycznie zakończyła się sukcesem...
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Wyciągamy naszą ukrytą etykietę z poprzedniego pliku (ID usera i nowy limit)
    const userId = session.metadata?.supabase_user_id;
    const newLimit = parseInt(session.metadata?.new_limit || '10');

  if (userId) {
      // Pobieramy flagę, którą wysłaliśmy przed chwilą
      const updateType = session.metadata?.update_type || 'replace';
      
      console.log(`💰 OTRZYMANO PRZELEW! Typ akcji: ${updateType}`);

      let finalLimit = newLimit;

      // Jeśli to jest "DODAWANIE" (Kupił 1 sztukę)
      if (updateType === 'add') {
        // 1. Sprawdzamy, jaki limit użytkownik ma w tej sekundzie
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('max_active_listings')
          .eq('id', userId)
          .single();
          
        const currentLimit = profile?.max_active_listings || 2;
        // 2. Matematyka: Obecny limit + 1 sztuka
        finalLimit = currentLimit + newLimit; 
      }

      console.log(`Ustawiam limit na: ${finalLimit}`);

      // 3. Włamujemy się jako Admin i zmieniamy limit
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ max_active_listings: finalLimit })
        .eq('id', userId);

      if (error) {
        console.error('❌ BŁĄD BAZY DANYCH:', error);
        return NextResponse.json({ error: 'Nie udało się zaktualizować bazy' }, { status: 500 });
      }
    }
  }

  // Mówimy kurierowi: "Dzięki, odebrałem!" (Inaczej Stripe będzie wysyłał to samo co 5 minut w nieskończoność)
  return NextResponse.json({ received: true });
}