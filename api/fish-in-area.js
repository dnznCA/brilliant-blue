import { classifyAquatic, pickCommonName, makeCache } from "./_fishUtils.js";

const GBIF = "https://api.gbif.org/v1";
const cache = makeCache();

// The phyla that contain aquatic animals we care about.
// classifyAquatic() does the fine-grained filtering WITHIN these.
const AQUATIC_PHYLA = [
  44,     // Chordata (fish, mammals, reptiles, amphibians)
  43,     // Arthropoda (crustaceans — Decapoda)
  52,     // Mollusca (cephalopods, bivalves, sea slugs)
  51,     // Cnidaria (jellyfish, corals, anemones)
  47,     // Echinodermata (sea stars, urchins)
];

export default async function handler(req, res) {
  const { wkt } = req.query;
  if (!wkt) return res.status(400).json({ error: "Missing wkt parameter" });
  if (cache.has(wkt)) return res.status(200).json(cache.get(wkt));

  try {
    // Build the URL manually so we can REPEAT phylumKey (GBIF wants
    // ?phylumKey=44&phylumKey=43&... not a comma-joined value)
    const phylumParams = AQUATIC_PHYLA.map((k) => `phylumKey=${k}`).join("&");
    const url =
      `${GBIF}/occurrence/search?geometry=${encodeURIComponent(wkt)}` +
      `&${phylumParams}` +
      `&hasCoordinate=true&hasGeospatialIssue=false` +
      `&limit=0&facet=speciesKey&facetLimit=300`;

    const r = await fetch(url);
    const data = await r.json();

    const facet = data.facets?.find((f) => f.field === "SPECIES_KEY");
    const counts = facet?.counts || [];

    const species = [];
    await Promise.all(
      counts.map(async (c) => {
        try {
          const [spRes, vnRes] = await Promise.all([
            fetch(`${GBIF}/species/${c.name}`),
            fetch(`${GBIF}/species/${c.name}/vernacularNames?limit=50`),
          ]);
          const sp = await spRes.json();
          const vnData = await vnRes.json();

          // classifyAquatic returns a category string or null
          const category = classifyAquatic(sp);
          if (category) {
            species.push({
              speciesKey: c.name,
              scientificName: sp.species || sp.canonicalName,
              commonName: pickCommonName(vnData.results),
              category,               // "Fish", "Cephalopod", "Marine mammal", etc.
              count: c.count,
            });
          }
        } catch {
          console.error("fish-in-area error:", e);
          res.status(500).json({ error: "Internal server error" });
        }
      })
    );

    cache.set(wkt, species);
    res.status(200).json(species);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}