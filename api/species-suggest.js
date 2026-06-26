import { isFish, pickCommonName, makeCache } from "./_fishUtils.js";

const GBIF = "https://api.gbif.org/v1";
const cache = makeCache();

export default async function handler(req, res) {
  const { q } = req.query;
  if (!q || q.length < 2) return res.status(200).json([]);
  if (cache.has(q)) return res.status(200).json(cache.get(q));

  try {
    const url =
      `${GBIF}/species/search?q=${encodeURIComponent(q)}` +
      `&qField=VERNACULAR&qField=SCIENTIFIC` +
      `&rank=SPECIES&highertaxonKey=44&status=ACCEPTED&limit=40`;

    const r = await fetch(url);
    const data = await r.json();

    const seen = new Set();
    const suggestions = (data.results || [])
      .filter(isFish)
      .filter((sp) => {
        if (seen.has(sp.key)) return false; // de-dupe
        seen.add(sp.key);
        return true;
      })
      .slice(0, 8)
      .map((sp) => ({
        key: sp.key,
        scientificName: sp.canonicalName || sp.scientificName,
        commonName: pickCommonName(sp.vernacularNames),
      }));

    cache.set(q, suggestions);
    res.status(200).json(suggestions);
  } catch (e) {
    console.error("species-suggest error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
}