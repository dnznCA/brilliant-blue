# Brilliant Blue

An interactive map for exploring aquatic life recorded around the world. Click anywhere on the ocean (or a lake, or a coastline) to see which species have actually been observed there, or search for a species to see where it's been recorded. Built on [GBIF](https://www.gbif.org/) occurrence data.

**Live demo:** https://brilliant-blue-psi.vercel.app/

---

## What it does

- **Click-to-explore** — click a point on the map (or hold **Space** and drag to draw a custom box) to get a browsable, image-rich list of the aquatic species recorded in that area.
- **Species search** — search by common name ("cod", "octopus") or scientific name, with autocomplete.
- **Distribution views** — for any species, switch between three ways of seeing where it's been recorded:
  - **GBIF** — GBIF's own pre-rendered density tiles (their complete, server-side render).
  - **Heatmap** — a smooth density gradient computed from sampled occurrence points.
  - **Points** — the individual occurrence records as plotted markers.

## Tech stack

- **Frontend:** React + Vite, [MapLibre GL](https://maplibre.org/) for the map, OpenStreetMap raster tiles for the base layer.
- **Backend:** Vercel serverless functions (`/api`) that query the GBIF API and shape the responses.
- **Data:** [GBIF](https://www.gbif.org/) (Global Biodiversity Information Facility) occurrence and species APIs.

## How it works

Clicking the map builds a small bounding box and sends it to a serverless function, which asks GBIF for the distinct species recorded inside that box (via a faceted occurrence query), then resolves each one's name, common name, and image. The results stream into the sidebar — names first, images progressively as they load.

Selecting a species builds all three distribution layers once and toggles their visibility, so switching views is instant and doesn't re-fetch. The heatmap and points views are drawn from a sampled set of the species' occurrence coordinates; the GBIF view is GBIF's own raster render.

Filtering to aquatic animals is handled by a classifier (`api/_fishUtils.js`) that queries the relevant phyla and keeps a record only if it belongs to an aquatic group — using whole-group inclusion where a group is essentially all-aquatic (fish, cnidarians, echinoderms, cephalopods), and curated whitelists for groups that are mixed with land-dwelling relatives (marine mammals, sea turtles, crustaceans, etc.).

## Running locally

```bash
npm install
vercel dev
```

Then open http://localhost:3000. (`vercel dev` is used rather than plain `vite` so the `/api` serverless functions run locally alongside the frontend.)

---

## Scope, limitations, and what this is *not*

This section matters, so it's deliberately detailed. Brilliant Blue is a portfolio exploration tool, and it's built to be honest about what its data does and doesn't represent.

**It shows where species were *recorded*, not where they necessarily *live*.** Every point on the map corresponds to a real observation in GBIF. That means the maps reflect *observation effort* as much as actual distribution — heavily surveyed waters (near research institutions, wealthy coastlines) look denser than under-sampled regions, even if the real populations don't differ that way. Occurrence data is not a range model.

**This is not an AquaMaps clone.** Tools like [AquaMaps](https://www.aquamaps.org/) produce *modeled, predicted* range maps from environmental variables — they estimate where a species *could* live, including unsampled areas. Brilliant Blue does the opposite: it shows real recorded occurrences, nothing inferred or predicted. The two answer different questions ("where could this species live?" vs. "where has it actually been seen?"), and this project intentionally stays on the observation side rather than inventing range it can't support.

**The Heatmap and Points views are a representative sample, not every record.** GBIF caps how many occurrence records a single query can page through, so for wide-ranging species these two views are drawn from a sample of up to ~1,500 points — enough to show the shape of where records cluster, but not exhaustive. (The GBIF tile view, by contrast, is GBIF's complete server-side render.)

**The aquatic classifier is curated, not exhaustive.** Some groups are cleanly all-aquatic and included wholesale. Others — notably molluscs (snails) and arthropods (which include all insects) — are mostly *not* aquatic, with the aquatic members tangled in among terrestrial relatives. Rather than misclassify, the classifier whitelists the clearly-aquatic, recognizable groups (cephalopods, decapod crustaceans, bivalves, sea slugs, etc.) and accepts that coverage of those phyla is best-effort rather than complete.

**This is not a replacement for GBIF, OBIS, or any scientific data source.** It's a friendlier window onto GBIF's data for casual exploration. For research, citation, or authoritative species information, go to the original sources below.

## Data sources & credits

- **Species occurrence and taxonomy data:** GBIF.org. GBIF data is freely available; please cite GBIF when reusing this data. See the [GBIF citation guidelines](https://www.gbif.org/citation-guidelines).
  > GBIF: The Global Biodiversity Information Facility (2026), *What is GBIF?*. Available from https://www.gbif.org/what-is-gbif
- **Base map tiles:** © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
- **Map rendering:** [MapLibre GL JS](https://maplibre.org/).
- **Species images & common names:** sourced via GBIF from its contributing datasets; individual images are licensed by their respective publishers.

## License

This project's code is released under the [MIT License](LICENSE). Note that this covers only the project's own code — the underlying occurrence data, species images, and map tiles carry their own licenses from the sources listed above (GBIF, image publishers, OpenStreetMap).

---

Built by [@dnznCA](https://github.com/dnznCA).