import type { CastTier } from "@/lib/cast-idb";

/** Series cast from the locked production sheet. Roots ship under /living-worlds/. */
export type TemplateRow = {
  name: string;
  tier: CastTier;
  costumeNotes: string;
  notes: string;
  e01: boolean;
  /** Filename under /living-worlds/ — optional for C rows */
  rootFile?: string;
};

export const LIVING_WORLDS_HOUSE_URL = "/living-worlds/e01-house.png";

export const LIVING_WORLDS_TEMPLATE: TemplateRow[] = [
  {
    name: "Mara",
    tier: "A",
    costumeNotes:
      "Green coat, long auburn-brown braid, dark scarf, brown satchel, red/white checked cloth.",
    notes: "Also green redhead in sera.png. Series lead.",
    e01: true,
    rootFile: "mara.png",
  },
  {
    name: "Kael",
    tier: "A",
    costumeNotes:
      "Rust-red long coat, graying brown hair/beard, dark scarf and gloves. Red marker object — preserve design.",
    notes: "Solo root. Center man from the old trio. Red marker stays his.",
    e01: true,
    rootFile: "kael-solo.jpg",
  },
  {
    name: "Tamsin",
    tier: "A",
    costumeNotes:
      "Short silver-white hair, navy coat, pale-blue scarf, map papers.",
    notes: "Locked field look. Not Prefect Sable.",
    e01: true,
    rootFile: "tamsin.png",
  },
  {
    name: "Sera",
    tier: "B",
    costumeNotes:
      "Dark tied-back hair with white forelock, teal-blue coat, mustard-yellow scarf.",
    notes: "Solo root. Yellow scarf and white forelock. Not the green-coated redhead.",
    e01: true,
    rootFile: "sera-solo.jpg",
  },
  {
    name: "Anja",
    tier: "B",
    costumeNotes:
      "Auburn braid, broad-collared gray windcoat, gray neck layers.",
    notes: "Solo root. Different person from Sera.",
    e01: true,
    rootFile: "anja-solo.jpg",
  },
  {
    name: "Helena",
    tier: "B",
    costumeNotes:
      "Spectacles, short gray-streaked curls, gray/olive practical layers, charts.",
    notes: "Not the blue-coated woman in sera.png (that is Sera).",
    e01: true,
    rootFile: "helena.png",
  },
  {
    name: "Prefect Sable",
    tier: "B",
    costumeNotes:
      "Mature woman; short dark hair with gray temples, structured violet coat, book.",
    notes: "Not Tamsin. Not E01.",
    e01: false,
    rootFile: "sable.png",
  },
  {
    name: "Sen",
    tier: "B",
    costumeNotes:
      "Older, short white hair, brown skin, layered purple coat, documents.",
    notes: "UNRESOLVED gender vs script — preserve sen.png look.",
    e01: true,
    rootFile: "sen.png",
  },
  {
    name: "Archivist Venn",
    tier: "B",
    costumeNotes:
      "Older silver-haired clean-shaven man; navy/gold formal coat, compass pendant.",
    notes: "Locked.",
    e01: true,
    rootFile: "venn.png",
  },
  {
    name: "Citadel Guard",
    tier: "B",
    costumeNotes:
      "Black man, short tightly curled hair, navy/blue uniform with gold trim.",
    notes: "Solo root. The uniformed man only. Not Mara.",
    e01: true,
    rootFile: "guard-solo.jpg",
  },
  {
    name: "Joran",
    tier: "B",
    costumeNotes:
      "Broad, dark wavy hair (not bald), lighter olive skin, full black beard, ochre shirt, heavy brown apron, holding blankets.",
    notes: "Solo root. Has hair. Not Ilex. Not Kael.",
    e01: true,
    rootFile: "joran-solo.jpg",
  },
  {
    name: "Ilex",
    tier: "B",
    costumeNotes:
      "Huge, completely bald, deep dark-brown skin, short gray goatee, olive shirt, leather apron, pruning billhook.",
    notes: "Solo root. The bald orchard man. Not Joran.",
    e01: true,
    rootFile: "ilex-solo.jpg",
  },
  {
    name: "Oru",
    tier: "B",
    costumeNotes:
      "Lean, wiry, deep brown skin, long face, short solid-black hair with no gray streak, fitted blue-gray work coat, tool belt. No scarf.",
    notes: "New face. Lean. Must not match Sera. No white forelock.",
    e01: true,
    rootFile: "oru-solo.jpg",
  },
  {
    name: "House residents",
    tier: "B",
    costumeNotes:
      "Woman: brown bun, beige dress/brown vest. Man: older, gray beard, flat cap.",
    notes: "The doorway pair only. No one else.",
    e01: true,
    rootFile: "house-solo.jpg",
  },
  {
    name: "Custodian",
    tier: "B",
    costumeNotes:
      "Aged-metal lattice/orb, mechanical shutters, amber crystals. Nonhuman.",
    notes: "Locked machine design — not interchangeable prop.",
    e01: true,
    rootFile: "custodian.png",
  },
  {
    name: "Lio",
    tier: "B",
    costumeNotes:
      "Mara's mother, late forties, olive skin, no freckles, dark hair with a little silver in a low bun, no braid. Cream sleeves, gray-brown vest.",
    notes: "Solo root. Older than Mara. Not a second Mara. Leaf window.",
    e01: false,
    rootFile: "lio-solo.jpg",
  },
  {
    name: "Historical Orchard trader",
    tier: "C",
    costumeNotes: "Red hair, cream sleeves, brown workwear.",
    notes: "Prologue generations earlier. Neither Mara nor Sera.",
    e01: true,
  },
  {
    name: "Historical harbor traders",
    tier: "C",
    costumeNotes: "Heavy blue shearling coats, caps, gloves, work boots.",
    notes: "Not Kael. Continuity within prologue only.",
    e01: true,
  },
];
