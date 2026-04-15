import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { orderId, amount } = await req.json();

    const sekret = process.env.HOTPAY_SECRET;
    const haslo = process.env.HOTPAY_PASSWORD;

    if (!sekret || !haslo) {
      throw new Error("Brak kluczy HotPay w .env.local");
    }

    // Parametry transakcji
    const kwota = parseFloat(amount).toFixed(2);
    const nazwa_uslugi = `Zamówienie ${orderId.slice(0, 8)}`;
    // Tutaj w przyszłości wpiszemy adres powrotu, na razie wracamy na stronę główną
    const adres_www = 'http://localhost:3000/moje-konto/zamowienia'; 

    // 🔥 TWORZENIE PODPISU BEZPIECZEŃSTWA (HASH SHA-256) ZGODNIE Z DOKUMENTACJĄ HOTPAY 🔥
    // Wzór HotPay: HASLOZUSTAWIEN;KWOTA;NAZWA_USLUGI;ADRES_WWW;ID_ZAMOWIENIA;SEKRET
    const stringToHash = `${haslo};${kwota};${nazwa_uslugi};${adres_www};${orderId};${sekret}`;
    const hash = crypto.createHash('sha256').update(stringToHash).digest('hex');

    // Budujemy finalny link do bramki testowej
    const paymentUrl = `https://platnosc.hotpay.pl/?SEKRET=${sekret}&KWOTA=${kwota}&NAZWA_USLUGI=${encodeURIComponent(nazwa_uslugi)}&ADRES_WWW=${encodeURIComponent(adres_www)}&ID_ZAMOWIENIA=${orderId}&HASH=${hash}`;

    return NextResponse.json({ url: paymentUrl });

  } catch (error: any) {
    console.error("Błąd generowania linku HotPay:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}