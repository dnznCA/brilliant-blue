import { makeCache } from "./_fishUtils.js";

const GBIF = "https://api.gbif.org/v1";
const cache = makeCache();

export default async function handler(req, res) {
  const { speciesKey } = req.query;
  if (!speciesKey) return res.status(400).json({ error: "Missing speciesKey" });
  if (cache.has(speciesKey)) return res.status(200).json(cache.get(speciesKey));

  try {
    const r = await fetch(`${GBIF}/species/${speciesKey}/media?limit=5`);
    const data = await r.json();

    const img = (data.results || []).find(
      (m) => m.type === "StillImage" && m.identifier
    );

    const result = { image: img ? img.identifier : null };
    cache.set(speciesKey, result);
    res.status(200).json(result);
  } catch (e) {
    console.error("species-image error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
}