// Shared helpers for all the aquatic-life endpoints.
// "What counts as aquatic" lives here in ONE place so endpoints stay consistent.




// Simple cache with TTL + max size, shared by endpoints.
export function makeCache({ ttlMs = 1000 * 60 * 60, maxSize = 500 } = {}) {
  const store = new Map(); // key -> { value, expires }
  return {
    get(key) {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (Date.now() > hit.expires) { store.delete(key); return undefined; }
      return hit.value;
    },
    set(key, value) {
      if (store.size >= maxSize) store.delete(store.keys().next().value); // drop oldest
      store.set(key, { value, expires: Date.now() + ttlMs });
    },
    has(key) { return this.get(key) !== undefined; },
  };
}









// ---- FISH (unchanged): exclude non-fish vertebrate classes ----
export const NON_FISH_CLASSES = new Set([
  "Aves", "Mammalia", "Reptilia", "Squamata",
  "Testudines", "Crocodylia", "Amphibia",
]);
export function isFish(record) {
  return !NON_FISH_CLASSES.has(record.class);
}

// ---- AQUATIC CLASSIFIER ----
// Returns a category string (also usable as a UI tag) or null if not aquatic.

// Whole phyla/classes that are essentially all-aquatic
const AQUATIC_PHYLA = new Set(["Cnidaria", "Echinodermata"]);

// Tight whitelists for groups mixed with terrestrial relatives
const AQUATIC_ORDERS = new Set([
  "Cetacea",       // whales, dolphins, porpoises
  "Sirenia",       // manatees, dugongs
  "Crocodylia",    // crocodiles, alligators
  "Testudines",    // turtles (sea + freshwater)
  "Decapoda",      // crabs, lobsters, shrimp, crayfish
  "Nudibranchia",  // sea slugs
]);

const AQUATIC_FAMILIES = new Set([
  "Phocidae", "Otariidae", "Odobenidae", // seals, sea lions, walruses
  "Lutrinae",                            // otters (sometimes ranked subfamily)
  "Cheloniidae", "Dermochelyidae",       // sea turtles
  "Hydrophiidae",                        // sea snakes
]);

const AQUATIC_CLASSES = new Set([
  "Cephalopoda",   // octopus, squid, cuttlefish
  "Bivalvia",      // clams, mussels, oysters
]);

// the one special-cased species
const AXOLOTL = "Ambystoma mexicanum";

export function classifyAquatic(record) {
  const { phylum, class: cls, order, family, species } = record;

  // 1. Fish (Chordata, minus the non-fish classes)
  if (phylum === "Chordata" && isFish(record)) return "Fish";

  // 2. Whole aquatic phyla
  if (AQUATIC_PHYLA.has(phylum)) {
    if (phylum === "Cnidaria") return "Cnidarian";
    if (phylum === "Echinodermata") return "Echinoderm";
  }

  // 3. Aquatic by class (cephalopods, bivalves)
  if (AQUATIC_CLASSES.has(cls)) {
    if (cls === "Cephalopoda") return "Cephalopod";
    if (cls === "Bivalvia") return "Bivalve";
  }

  // 4. Aquatic by order
  if (AQUATIC_ORDERS.has(order)) {
    if (order === "Cetacea" || order === "Sirenia") return "Marine mammal";
    if (order === "Crocodylia" || order === "Testudines") return "Reptile";
    if (order === "Decapoda") return "Crustacean";
    if (order === "Nudibranchia") return "Sea slug";
  }

  // 5. Aquatic by family (pinnipeds, otters, sea turtles/snakes)
  if (AQUATIC_FAMILIES.has(family)) {
    if (["Phocidae", "Otariidae", "Odobenidae", "Lutrinae"].includes(family)) return "Marine mammal";
    if (["Cheloniidae", "Dermochelyidae"].includes(family)) return "Reptile";
    if (family === "Hydrophiidae") return "Sea snake";
  }

  // 6. Special case: axolotl only
  if (species === AXOLOTL) return "Amphibian";

  return null; // not aquatic
}

// ---- COMMON NAME PICKER (unchanged) ----
export function pickCommonName(vernacularNames) {
  if (!vernacularNames || vernacularNames.length === 0) return null;
  const english = vernacularNames.filter((v) => v.language === "eng");
  if (english.length === 0) return null;
  const preferred = english.find((v) => v.preferred);
  return (preferred || english[0]).vernacularName;
}