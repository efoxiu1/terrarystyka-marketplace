import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Tworzymy "Boga" (Supabase Admin), żeby móc czytać maile z auth.users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    // 1. Odbieramy czysty JSON od Supabase
    const payload = await req.json();
    // DODANE: Wyciągamy dodatkowo type (rodzaj akcji) i old_record (stare dane)
    const { table, type, record, old_record } = payload;

    // 2. Kto narozrabiał? Pobieramy ID użytkownika w zależności od tabeli
    const targetUserId = table === 'user_warnings' ? record.user_id : record.id;

    if (!targetUserId) {
      return NextResponse.json({ message: 'Brak ID użytkownika' }, { status: 400 });
    }

    // 3. Pobieramy maila użytkownika prosto z sejfu (auth.users)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
    
    if (authError || !authData.user?.email) {
      console.error('Nie udało się pobrać maila dla usera:', targetUserId);
      return NextResponse.json({ error: 'Nie znaleziono maila' }, { status: 400 });
    }

    const userEmail = authData.user.email;
    let subject = '';
    let content = '';
    let shouldSendEmail = false; // DODANE: Flaga decydująca, czy odpalamy Resenda

    // 4. INTELIGENTNE SPRAWDZANIE
    
    // Scenariusz 1: Ktoś dostał BANA (Tabela profiles, UPDATE)
    if (table === 'profiles' && type === 'UPDATE') {
      // BARDZO WAŻNE: Sprawdzamy, czy gość wcześniej NIE BYŁ zbanowany, a teraz JEST
      if (old_record?.is_banned !== true && record?.is_banned === true) {
        subject = 'Twoje konto zostało zablokowane 🚫';
        content = 'Przykro nam, ale zablokowaliśmy Twoje konto z powodu łamania regulaminu giełdy. Jeśli uważasz, że to błąd, skontaktuj się z nami.';
        shouldSendEmail = true;
      }
    } 
    // Scenariusz 2: Ktoś dostał OSTRZEŻENIE (Tabela user_warnings, INSERT)
    else if (table === 'user_warnings' && type === 'INSERT') {
      subject = 'Otrzymałeś nowe ostrzeżenie ⚠️';
      content = `Uwaga! Otrzymałeś ostrzeżenie od administracji. Powód: <strong>${record.reason}</strong>. Prosimy o przestrzeganie zasad.`;
      shouldSendEmail = true;
    }

    // Jeśli to nie był ani nowy ban, ani ostrzeżenie (np. gość tylko zmienił nick) - przerywamy!
    if (!shouldSendEmail) {
      console.log('Zmiana w bazie, ale to nie jest nowy ban ani ostrzeżenie. Ignoruję paczkę.');
      return NextResponse.json({ message: 'Zignorowano - brak akcji do wysyłki' }, { status: 200 });
    }

    // 5. Wysyłka przez Resend (Pamiętaj dodać RESEND_API_KEY do Vercela!)
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      console.error('Brak klucza RESEND_API_KEY');
      return NextResponse.json({ error: 'Brak klucza Resend' }, { status: 500 });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Giełda Egzotyki <onboarding@resend.dev>', // Zmień to, gdy dodasz swoją domenę
        to: [userEmail],
        subject: subject,
        html: `<div style="font-family: sans-serif; padding: 20px;"><h2>Witaj,</h2><p>${content}</p></div>`,
      }),
    });

    if (!res.ok) {
      throw new Error('Resend odrzucił paczkę');
    }

    return NextResponse.json({ success: true, message: `Wysłano maila do ${userEmail}` }, { status: 200 });

  } catch (error: any) {
    console.error('Błąd Webhooka Supabase:', error.message);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}