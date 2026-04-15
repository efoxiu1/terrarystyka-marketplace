import { NextResponse } from 'next/server';
import { Packer, Bin, Item } from 'bp3d';

// Definiujemy skrytki InPost jako kontenery 3D (Szerokość, Długość, Wysokość, Max Waga)
const INPOST_BINS = [
  { id: 'A', name: 'Paczkomat (Gabaryt A)', w: 38, d: 64, h: 8, maxWeight: 25, price: 16.99 },
  { id: 'B', name: 'Paczkomat (Gabaryt B)', w: 38, d: 64, h: 19, maxWeight: 25, price: 18.99 },
  { id: 'C', name: 'Paczkomat (Gabaryt C)', w: 38, d: 64, h: 41, maxWeight: 25, price: 20.99 }
];

export async function POST(req: Request) {
  try {
    const { items } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Brak przedmiotów" }, { status: 400 });
    }

    // --- POPRAWKA: Szybkie wyliczenie wagi i największego boku dla kuriera ---
    let totalWeight = 0;
    let absoluteMaxL = 0;

    items.forEach((item: any) => {
      totalWeight += (item.weight || 0.1) * item.quantity;
      const maxDim = Math.max(item.length || 1, item.width || 1, item.height || 1);
      absoluteMaxL = Math.max(absoluteMaxL, maxDim);
    });
    // ----------------------------------------------------------------------

    let selectedBin = null;

    // Przeszukujemy skrytki od najmniejszej do największej
    for (const binData of INPOST_BINS) {
      const packer = new Packer();
      
      // Tworzymy wirtualne pudełko InPostu
      const bin = new Bin(binData.id, binData.w, binData.d, binData.h, binData.maxWeight);
      packer.addBin(bin);

      // Wrzucamy przedmioty z koszyka do algorytmu
      items.forEach((item: any, index: number) => {
        // Jeśli klient kupił 3 sztuki tego samego wariantu, dodajemy je jako 3 osobne klocki 3D
        for (let i = 0; i < item.quantity; i++) {
          const w = item.width || 1;
          const d = item.length || 1; 
          const h = item.height || 1;
          const weight = item.weight || 0.1;

          packer.addItem(new Item(`Produkt-${index}-${i}`, w, d, h, weight));
        }
      });

      // 🔥 URUCHAMIAMY ALGORYTM TETRISA 🔥
      packer.pack();

      // Liczymy, ile klocków łącznie mieliśmy spakować
      const totalItemsToPack = items.reduce((acc: number, item: any) => acc + item.quantity, 0);
      
      // Sprawdzamy, ile klocków algorytm zdołał upchnąć do tego konkretnego pudełka
      const packedItemsCount = packer.bins[0]?.items.length || 0;

      // Zwycięstwo! Zmieściło się wszystko i waga całej paczki też jest w normie
      if (packedItemsCount === totalItemsToPack && totalWeight <= binData.maxWeight) {
        selectedBin = binData;
        break; 
      }
    }

   const finalPackage = {
    width: selectedBin ? selectedBin.w : absoluteMaxL,
    depth: selectedBin ? selectedBin.d : absoluteMaxL, // dla kuriera zakładamy kwadrat w najgorszym razie
    height: selectedBin ? selectedBin.h : absoluteMaxL,
    weight: totalWeight
  };

  try {
    // 2. WYSYŁAMY ZAPYTANIE DO FURGONETKI (Symulacja / Struktura pod API)
    // W prawdziwym środowisku odkomentujesz fetch() i wstawisz swój token z Furgonetka.pl
    /*
    const furgonetkaRes = await fetch('https://api.furgonetka.pl/v1/packages/pricing', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer TWÓJ_KLUCZ_API` 
      },
      body: JSON.stringify({
        package: {
          width: finalPackage.width,
          depth: finalPackage.depth,
          height: finalPackage.height,
          weight: finalPackage.weight
        },
        services: ['inpost', 'dpd', 'dhl'] // Prosimy o wycenę tych konkretnych firm
      })
    });
    const livePrices = await furgonetkaRes.json();
    */

    // MOCKUP (Zanim założysz konto na Furgonetce, system udaje, że dostał te dane z API)
    // To są przykładowe ceny, które normalnie przyszłyby w zmiennej livePrices
    const livePrices = {
      dpd: { price: 18.50 },
      dhl: { price: 21.00 },
      inpost: { price: selectedBin ? 15.40 : null } // InPost tylko jak Bin-Packer zatwierdził gabaryt
    };

    // 3. Budujemy odpowiedź dla naszego Ekranu Kasy
    let availableOptions = [];
    const methods: any = {};

    // Jeśli InPost przeszedł przez Bin-Packera i Furgonetka dała cenę:
    if (selectedBin && livePrices.inpost.price) {
      availableOptions.push('inpost');
      methods.inpost = { 
        name: selectedBin.name, 
        // Dodajemy 2 zł marży platformy (opcjonalnie) lub dajemy czystą cenę
        price: livePrices.inpost.price + 1.59, 
        message: 'Paczka optymalnie ułożona w 3D.' 
      };
    }

    // Dodajemy kurierów, jeśli waga pozwala (Kurierzy do 31.5kg)
    if (totalWeight <= 31.5 && absoluteMaxL <= 150) {
      availableOptions.push('dpd', 'dhl');
      methods.dpd = { name: 'Kurier DPD', price: livePrices.dpd.price, message: 'Wycena live z Furgonetka.pl' };
      methods.dhl = { name: 'Kurier DHL', price: livePrices.dhl.price, message: 'Wycena live z Furgonetka.pl' };
    }

    // Zabezpieczenie przed przesyłką paletową
    if (availableOptions.length === 0) {
      return NextResponse.json({
        available: ['pallet'],
        methods: {
          pallet: { name: 'Przesyłka Paletowa', price: 150.00, message: 'Gabaryty przekraczają standardy kurierskie.' }
        }
      });
    }

    return NextResponse.json({
      available: availableOptions,
      methods: methods
    });

  } catch (apiError) {
    console.error("Błąd połączenia z Furgonetką:", apiError);
    return NextResponse.json({ error: "Błąd pobierania cen kurierów" }, { status: 503 });
  }

} catch (error) { // To zamyka główny try-catch na samej górze pliku
  console.error(error);
  return NextResponse.json({ error: "Błąd silnika pakującego 3D" }, { status: 500 });
}
}