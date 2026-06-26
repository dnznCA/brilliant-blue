import { makeCache } from "./_fishUtils.js";

const GBIF = "https://api.gbif.org/v1";
const cache = makeCache();

export default async function handler(req, res) {
  const { taxonKey } = req.query;
  if (!taxonKey) return res.status(400).json({ error: "Missing taxonKey" });
  if (cache.has(taxonKey)) return res.status(200).json(cache.get(taxonKey));

  try {
    // GBIF caps each page at 300. Page a few times to get a representative
    // sample (up to ~1500 points) without hammering the API.
    const points = [];
    const PAGES = 5;
    for (let i = 0; i < PAGES; i++) {
      const params = new URLSearchParams({
        taxonKey,
        hasCoordinate: "true",
        hasGeospatialIssue: "false",
        limit: "300",
        offset: String(i * 300),
      });
      const r = await fetch(`${GBIF}/occurrence/search?${params}`);
      const data = await r.json();
      for (const rec of data.results || []) {
        if (rec.decimalLongitude != null && rec.decimalLatitude != null) {
          points.push([rec.decimalLongitude, rec.decimalLatitude]);
        }
      }
      if (data.endOfRecords) break; // stop early if we've got them all
    }

    cache.set(taxonKey, points);
    res.status(200).json(points);
  } catch (e) {
    console.error("species-points error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
}