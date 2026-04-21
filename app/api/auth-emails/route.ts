import { NextResponse } from 'next/server';

// NASZA FABRYKA SZABLONÓW (ta sama, co w webhooku)
const generateEmailTemplate = (title: string, message: string) => {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
      <div style="background-color: #16a34a; padding: 30px 20px; text-align: center;">
        <div style="font-size: 40px; margin-bottom: 10px;">🦎</div>
        <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">Giełda Egzotyki</h1>
      </div>
      <div style="padding: 40px 30px; color: #374151;">
        <h2 style="color: #111827; margin-top: 0; font-size: 20px; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px;">
          ${title}
        </h2>
        <div style="font-size: 16px; line-height: 1.6; margin-top: 20px;">
          ${message}
        </div>
        <div style="margin-top: 35px; padding: 15px 20px; background-color: #f9fafb; border-left: 4px solid #16a34a; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #4b5563;">
            Jeśli nie próbowałeś się zarejestrować, po prostu zignoruj tę wiadomość.
          </p>
        </div>
      </div>
    </div>
  `;
};

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Brak adresu e-mail' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) throw new Error('Brak klucza Resend');

    const subject = 'Próba rejestracji - Konto już istnieje! ⚠️';
    const content = `
      Ktoś (mamy nadzieję, że Ty!) próbował założyć nowe konto na Giełdzie Egzotyki, używając tego adresu e-mail.<br><br>
      <strong>Informujemy, że konto przypisane do tego adresu już istnieje.</strong><br><br>
      Nie musisz zakładać go ponownie. Jeśli nie pamiętasz hasła, przejdź na stronę logowania i kliknij "Zapomniałem hasła".
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: 'Giełda Egzotyki <onboarding@resend.dev>', // Zmień na swoją domenę po wyjściu z Sandboxa
        to: [email],
        subject: subject,
        html: generateEmailTemplate(subject, content),
      }),
    });

    if (!res.ok) throw new Error('Błąd wysyłki');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Błąd cichego maila:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}