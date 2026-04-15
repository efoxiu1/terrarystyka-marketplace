import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { orderId, amount } = await req.json();
    const sekret = process.env.HOTPAY_SECRET;
    const haslo = process.env.HOTPAY_PASSWORD;

    // 1. Gwarantujemy format 0.00
    const kwota = parseFloat(amount).toFixed(2);
    
    // 2. Maksymalnie upraszczamy nazwę na czas testu
    const nazwa_uslugi = `Zamowienie_${orderId.slice(0, 5)}`; 
    const adres_www = `${process.env.NEXT_PUBLIC_SITE_URL}/moje-konto/zamowienia`;

    // 3. Budujemy string do hasha - KOLEJNOŚĆ MA ZNACZENIE
    // HASLO;KWOTA;NAZWA;ADRES;ID;SEKRET
    const stringToHash = `${haslo};${kwota};${nazwa_uslugi};${adres_www};${orderId};${sekret}`;
    const hash = crypto.createHash('sha256').update(stringToHash).digest('hex');

    // 4. Budujemy URL
    const paymentUrl = new URL('https://platnosc.hotpay.pl/');
    paymentUrl.searchParams.append('SEKRET', sekret!);
    paymentUrl.searchParams.append('KWOTA', kwota);
    paymentUrl.searchParams.append('NAZWA_USLUGI', nazwa_uslugi);
    paymentUrl.searchParams.append('ADRES_WWW', adres_www);
    paymentUrl.searchParams.append('ID_ZAMOWIENIA', orderId);
    paymentUrl.searchParams.append('HASH', hash);

    console.log("DEBUG - Generowany URL:", paymentUrl.toString());

    return NextResponse.json({ url: paymentUrl.toString() });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}