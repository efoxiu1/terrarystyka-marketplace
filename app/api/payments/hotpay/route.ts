import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { orderId, amount } = await req.json();

    const sekret = process.env.HOTPAY_SECRET;
    const haslo = process.env.HOTPAY_PASSWORD;
    // Ważne: Vercel może nie mieć dopisanej klamry na końcu adresu, więc czyścimy to
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, "");

    if (!sekret || !haslo) throw new Error("Brak kluczy w ENV");

    // 1. FORMATOWANIE KWOTY (Musi być np. 10.00)
    const kwota = parseFloat(String(amount)).toFixed(2);
    
    // 2. NAZWA (Maksymalnie prosta, bez polskich znaków na czas testu)
    const nazwa_uslugi = `Zamowienie_${orderId.slice(0, 8)}`; 
    
    // 3. ADRES POWROTU (Musi być identyczny w HASHU i w parametrze)
    const adres_www = `${siteUrl}/moje-konto/zamowienia`;

    // 4. GENEROWANIE HASHA (Kolejność: HASLO;KWOTA;NAZWA;ADRES;ID;SEKRET)
    const stringToHash = `${haslo};${kwota};${nazwa_uslugi};${adres_www};${orderId};${sekret}`;
    const hash = crypto.createHash('sha256').update(stringToHash).digest('hex');

    // 5. BUDOWANIE LINKU (Ręcznie, żeby mieć 100% kontroli)
    const params = new URLSearchParams({
      SEKRET: sekret,
      KWOTA: kwota,
      NAZWA_USLUGI: nazwa_uslugi,
      ADRES_WWW: adres_www,
      ID_ZAMOWIENIA: orderId,
      HASH: hash
    });

    const paymentUrl = `https://platnosc.hotpay.pl/?${params.toString()}`;

    console.log("🔥 WYSYŁAM DO HOTPAY:", paymentUrl);

    return NextResponse.json({ url: paymentUrl });

  } catch (error: any) {
    console.error("❌ BŁĄD GENEROWANIA LINKU:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}