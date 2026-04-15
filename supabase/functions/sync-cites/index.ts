import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SPECIES_PLUS_API_KEY = Deno.env.get('SPECIES_PLUS_API_KEY')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  console.log("🚀🚀🚀 WERSJA 4.0 - CHUNKING & CRON READY 🚀🚀🚀");

  // --- KROK 1: PORCJOWANIE (CHUNKING) ---
  // Pobieramy TYLKO 5 gatunków. Szukamy tych, które mają last_cites_sync na NULL (nigdy nie sprawdzane),
  // lub tych, które były sprawdzane najdawniej (np. kilka miesięcy temu).
  const { data: localSpecies, error } = await supabaseAdmin
    .from('species')
    .select('id, latin_name')
    .eq('is_approved', true)
    .order('last_cites_sync', { ascending: true, nullsFirst: true }) // Najpierw puste, potem najstarsze
    .limit(5); // <-- Magia porcjowania! Tylko 5 sztuk na jedno uruchomienie.

  if (error || !localSpecies) {
    console.error("❌ BŁĄD POBIERANIA BAZY", error);
    return new Response(JSON.stringify({ error: "Błąd bazy" }), { status: 500 });
  }

  if (localSpecies.length === 0) {
     console.log("✅ Wszystkie gatunki są aktualne.");
     return new Response(JSON.stringify({ message: "Brak gatunków do synchronizacji" }), { status: 200 });
  }

  // --- KROK 2: PRZETWARZANIE CHUNKA ---
  for (const species of localSpecies) {
    try {
      console.log(`🔎 Szukam: [${species.latin_name}]...`);

      const response = await fetch(`https://api.speciesplus.net/api/v1/taxon_concepts?name=${encodeURIComponent(species.latin_name)}`, {
        headers: { 
          'X-Authentication-Token': SPECIES_PLUS_API_KEY,
          'Accept': 'application/json' 
        }
      });

      if (!response.ok) {
        console.error(`❌ BŁĄD API ONZ dla ${species.latin_name} - Status: ${response.status}`);
        continue; // Pomijamy i lecimy do następnego
      }

      const citesData = await response.json();
      let currentAppendix = 'NONE';

      if (citesData && citesData.taxon_concepts && citesData.taxon_concepts.length > 0) {
        const exactMatch = citesData.taxon_concepts.find(
          (taxon: any) => taxon.full_name.toLowerCase() === species.latin_name.toLowerCase()
        );

        if (exactMatch) {
          const listings = exactMatch.cites_listings;
          const isA = listings.some((l: any) => l.appendix === 'I');
          const isB = listings.some((l: any) => l.appendix === 'II' || l.appendix === 'III');

          if (isA) currentAppendix = 'A';
          else if (isB) currentAppendix = 'B';
          
          console.log(`✅ ZNALEZIONO DOKŁADNIE: ${species.latin_name} -> Załącznik ${currentAppendix}`);
        } else {
          console.log(`🛑 Brak dokładnego dopasowania.`);
        }
      }

      // --- KROK 3: AKTUALIZACJA W BAZIE (Zapisujemy też czas!) ---
      console.log(`💾 Zapisuję w bazie: ${species.latin_name} = ${currentAppendix}`);
      await supabaseAdmin
        .from('species')
        .update({ 
            cites_appendix: currentAppendix,
            last_cites_sync: new Date().toISOString() // <-- WAŻNE: Aktualizujemy stempel czasu!
        })
        .eq('id', species.id);

      // Zostawiamy delikatny "Rate Limiting" (300ms) dla szacunku do API ONZ
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (err) {
      console.error(`❌ CRASH DLA ${species.latin_name}:`, err);
    }
  }
  
  console.log("🏁 KONIEC PORCJI (CHUNKA) 🏁");
  return new Response(JSON.stringify({ success: true, processed: localSpecies.length }), { headers: { "Content-Type": "application/json" } })
})