import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SPECIES_PLUS_API_KEY = Deno.env.get('SPECIES_PLUS_API_KEY')!;
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // --- POCISK SMUGOWY ---
  console.log("🚀🚀🚀 WERSJA 3.0 - POCISK SMUGOWY START 🚀🚀🚀");

  const { data: localSpecies, error } = await supabaseAdmin
    .from('species')
    .select('id, latin_name')
    .eq('is_approved', true);

  if (error || !localSpecies) {
    console.error("❌ BŁĄD POBIERANIA BAZY", error);
    return new Response(JSON.stringify({ error: "Błąd bazy" }), { status: 500 });
  }

  for (const species of localSpecies) {
    try {
      console.log(`🔎 Szukam: [${species.latin_name}]...`);

      // Prawidłowy endpoint to /taxon_concepts
      const response = await fetch(`https://api.speciesplus.net/api/v1/taxon_concepts?name=${encodeURIComponent(species.latin_name)}`, {
        headers: { 
          'X-Authentication-Token': SPECIES_PLUS_API_KEY,
          'Accept': 'application/json' 
        }
      });

      if (!response.ok) {
        console.error(`❌ BŁĄD API ONZ dla ${species.latin_name} - Status: ${response.status}`);
        continue;
      }

      const citesData = await response.json();
      let currentAppendix = 'NONE';

      // Species+ zwraca dane w polu 'taxon_concepts'
      if (citesData && citesData.taxon_concepts && citesData.taxon_concepts.length > 0) {
        const exactMatch = citesData.taxon_concepts.find(
          (taxon: any) => taxon.full_name.toLowerCase() === species.latin_name.toLowerCase()
        );

        if (exactMatch) {
          const listings = exactMatch.cites_listings;
          // Sprawdzamy załączniki
          const isA = listings.some((l: any) => l.appendix === 'I');
          const isB = listings.some((l: any) => l.appendix === 'II' || l.appendix === 'III');

          if (isA) currentAppendix = 'A';
          else if (isB) currentAppendix = 'B';
          
          console.log(`✅ ZNALEZIONO DOKŁADNIE: ${species.latin_name} -> Załącznik ${currentAppendix}`);
        } else {
          console.log(`🛑 FAŁSZYWY ALARM dla: ${species.latin_name}. To coś innego! Daję NONE.`);
          currentAppendix = 'NONE';
        }
      } else {
        console.log(`👻 Pusto w API dla: ${species.latin_name}. Daję NONE.`);
        currentAppendix = 'NONE';
      }

      console.log(`💾 Zapisuję w bazie: ${species.latin_name} = ${currentAppendix}`);
      await supabaseAdmin
        .from('species')
        .update({ cites_appendix: currentAppendix })
        .eq('id', species.id);

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error(`❌ CRASH DLA ${species.latin_name}:`, err);
    }
  }
  console.log("🏁 KONIEC SKRYPTU 🏁");
  return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })
})