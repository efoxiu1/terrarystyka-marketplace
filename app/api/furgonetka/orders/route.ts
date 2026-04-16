import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Furgonetka uderza tutaj metodą GET, żeby pobrać zamówienia
export async function GET(req: Request) {
  try {
    // 1. Sprawdzamy, czy Furgonetka zna nasze hasło!
    const token = req.headers.get('Authorization') || req.headers.get('token'); // Furgonetka wysyła token w nagłówkach
    
    // Zastąp to swoim tokenem wpisanym w formularzu (lub daj to do pliku .env)
    const MY_SECRET_TOKEN = 'SuperTajneHasloFurgonetka2024'; 

    if (token !== MY_SECRET_TOKEN) {
      console.error('❌ Ktoś nieznajomy próbuje pobrać zamówienia!');
      return new Response('Brak dostępu', { status: 401 });
    }

    // 2. Pobieramy zamówienia z Twojej bazy (tylko te opłacone!)
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select(`
        id, 
        created_at, 
        shipping_details, 
        order_items ( quantity, price, listings ( title, weight ) )
      `)
      .eq('status', 'paid');

    if (error) throw error;
    
    // 3. TUTAJ ZACZYNA SIĘ MAGIA: Tłumaczymy naszą bazę na język Furgonetki
    // Furgonetka wymaga bardzo konkretnego formatu JSON.
    const furgonetkaOrders = orders.map((order) => {
        return {
            order_id: order.id,
            created_at: order.created_at,
            // Przekazujemy dane adresowe klienta
            receiver_name: order.shipping_details?.name || 'Brak Danych',
            receiver_street: order.shipping_details?.street || '',
            receiver_city: order.shipping_details?.city || '',
            receiver_postcode: order.shipping_details?.zip || '',
            receiver_phone: order.shipping_details?.phone || '',
            // Jeśli to paczkomat:
            delivery_point_name: order.shipping_details?.lockerId || null,
            
            // Mapujemy przedmioty
            items: order.order_items.map((item: any) => ({
                name: item.listings?.title,
                quantity: item.quantity,
                price: item.price,
                weight: item.listings?.weight || 1
            }))
        }
    });

    // 4. Oddajemy Furgonetce listę do wysłania!
    console.log(`📦 Furgonetka pobrała ${furgonetkaOrders.length} zamówień!`);
    return NextResponse.json(furgonetkaOrders, { status: 200 });

  } catch (err: any) {
    console.error('❌ Błąd API Furgonetki:', err.message);
    return new Response('Wystąpił błąd', { status: 500 });
  }
}