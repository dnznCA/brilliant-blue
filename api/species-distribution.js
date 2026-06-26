import { makeCache } from "./_fishUtils.js";
 
const GBIF = "https://api.gbif.org/v1";
const cache = makeCache(); 


export default async function handler(req, res) {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "Missing name parameter" });

  try {
    const r = await fetch(`${GBIF}/species/match?name=${encodeURIComponent(name)}`);
    const match = await r.json();
    if (!match.usageKey) return res.status(404).json({ error: "Species not found" });
    res.status(200).json({
      taxonKey: match.usageKey,
      scientificName: match.scientificName,
    });
  } catch (e) {
    console.error("species-distribution error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
}