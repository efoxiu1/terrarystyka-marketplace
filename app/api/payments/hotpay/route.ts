import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { orderId, amount } = await req.json();

    // WLEP SWOJE KLUCZE TUTAJ MIĘDZY CUDZYSŁOWY (z przecinkiem w sekrecie)
    const sekret = "TmNCdU03bkcwT2l5c0N5b2Q0Q0VaZzRwQ0FTRlI1MWwrbmg0R0UxNmsvMD0,"; 
    const haslo = "haslo123"; 

    // Gwarantujemy brak głupich spacji
    const czystySekret = sekret.trim();
    const czysteHaslo = haslo.trim();

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, "");
    
    const kwota = parseFloat(String(amount)).toFixed(2);
    const nazwa_uslugi = `Zamowienie_${orderId.slice(0, 8)}`; 
    const adres_www = `${siteUrl}/moje-konto/zamowienia`;

    // HASLO;KWOTA;NAZWA;ADRES;ID;SEKRET
    const stringToHash = `${czysteHaslo};${kwota};${nazwa_uslugi};${adres_www};${orderId};${czystySekret}`;
    const hash = crypto.createHash('sha256').update(stringToHash).digest('hex');

    const params = new URLSearchParams({
      SEKRET: czystySekret,
      KWOTA: kwota,
      NAZWA_USLUGI: nazwa_uslugi,
      ADRES_WWW: adres_www,
      ID_ZAMOWIENIA: orderId,
      HASH: hash
    });

    const paymentUrl = `https://platnosc.hotpay.pl/?${params.toString()}`;

    return NextResponse.json({ url: paymentUrl });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}