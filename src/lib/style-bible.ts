/** Locked series craft. Style is this bible — never inferred from the house image. */
export const HOUSE_LOOK_NAME = "Living Worlds Craft";

export type RestyleMode = "artist" | "place" | "artifact";

export const IDENTITY_LOCK =
  "Render this in the locked Living Worlds series craft. Keep the same characters, gender, poses, clothing, props, and background. Keep identity. " +
  "Keep each character's own body, height, age, species, and face. Do not recast anyone as a different person. ";

const KEEP_SCENE =
  "Keep the environment that is already in this picture, whatever it is — harbor, sky dock, vault, ruins, factory, orchard, or any other world. " +
  "Keep the existing surface, backdrop, weather, and light direction. " +
  "Do not replace the place. Do not invent a new location, table, case, room, forest, ground, or sky that is not already there. " +
  "Do not remove props, ground, or backdrop that are already there. ";

const CRAFT =
  "Living Worlds Craft is one series renderer: cohesive fantasy production art with faceted costume planes, warm lantern light, readable inhabited spaces, " +
  "riveted metal, timber, crystal, soft atmospheric depth, consistent anatomy and hands. " +
  "Same show on every page — not a style hop. " +
  "Medium: locked series illustration craft. Line: controlled edges, no cel-anime outlines. " +
  "Forbidden: random cartoon, painterly style-hop, cel shading, photoreal CGI forest takeover, fashion-beauty CGI, plastic toy, a different art style. ";

export const ARTIST_PROMPT =
  IDENTITY_LOCK +
  KEEP_SCENE +
  CRAFT +
  "Color science grades materials in place; do not grow a forest to force a palette. " +
  "Light is the scene's own lights under series craft. Every page must look like the same production.";

export const PLACE_PROMPT =
  IDENTITY_LOCK +
  KEEP_SCENE +
  "Living Worlds Craft is rendering craft only — cohesive series production art. " +
  "No cartoon style-hop, no cel shading, no inventing a new world. " +
  "Light must match the scene. Keep the scene's own colors and place.";

export const ARTIFACT_PROMPT =
  IDENTITY_LOCK +
  "This page is an object, relic, machine, or artifact. Keep the exact composition, camera, and every prop already in the scene. " +
  KEEP_SCENE +
  "Living Worlds Craft is the renderer only: tactile metal, glass, wood, parchment, crystal, and stone as series production art. " +
  "Forbidden: cartoon style-hop, adding furniture, changing the place. " +
  "Keep the object's own markings, inner glow, and materials.";

export function promptForMode(mode: RestyleMode, castLock = ""): string {
  const base =
    mode === "place"
      ? PLACE_PROMPT
      : mode === "artifact"
        ? ARTIFACT_PROMPT
        : ARTIST_PROMPT;
  if (!castLock.trim()) return base;
  return base + castLock.trim() + " ";
}

export const STYLE_PALETTE = "Lantern gold · timber · crystal · rivet steel · fog";

export const MODE_COPY: Record<
  RestyleMode,
  { label: string; summary: string }
> = {
  artist: {
    label: "Same artist",
    summary: "One series show · grade the craft, keep the place",
  },
  place: {
    label: "Keep place",
    summary: "Whatever world is in the picture stays",
  },
  artifact: {
    label: "Artifact",
    summary: "Object / Custodian restyle · place stays",
  },
};

export type EnsembleKind = "group" | "section" | "poster";

export function promptForEnsemble(kind: EnsembleKind, count: number): string {
  const craft =
    "Render this in the locked Living Worlds series craft. Cohesive fantasy production art, faceted costume planes, warm lantern light, readable detail. " +
    "Medium: locked series illustration craft. " +
    "Forbidden: cartoon style-hop, inventing extra people, swapping faces, changing species, recasting anyone. ";

  const lock =
    `This image is an identity sheet of exactly ${count} subjects already present as panels. ` +
    "Keep every character's exact face, body, height, age, species, costume, props, and markings from their panel. " +
    "Do not replace, merge, or invent characters. Do not drop anyone who is already on the sheet. " +
    "Do not crop anyone out of frame. Keep proportions consistent. ";

  if (kind === "poster") {
    return (
      craft +
      lock +
      "Compose them into one epic full-cast ensemble poster: shared cinematic world, cohesive group arrangement. " +
      "Everyone from the sheet appears once, fully visible, same production."
    );
  }
  if (kind === "section") {
    return (
      craft +
      lock +
      "Compose these locked group plates into one wider section ensemble in one shared setting. " +
      "Keep every person from every plate. One cohesive frame, no panel borders left in the final."
    );
  }
  return (
    craft +
    lock +
    "Compose these characters into one small group plate standing or arranged together in a shared frame. " +
    "Remove the grid borders. Keep identity. Same show on every figure."
  );
}


/** Normalize one cast root into series craft. Single image only — never house as 2nd ref. */
export function promptForNormalize(opts: {
  name: string;
  costumeNotes: string;
  tier: string;
  isArtifact?: boolean;
}): string {
  const costume =
    opts.costumeNotes.trim() ||
    "match the exact costume and silhouette already in this picture";
  const who =
    opts.isArtifact || /custodian/i.test(opts.name)
      ? `This is the locked nonhuman design for ${opts.name}. Keep the exact machine design, lattice, shutters, crystals, and proportions. `
      : `This is the locked series root for ${opts.name} (${opts.tier}). Keep their exact face, body, age, hair, and identity. Costume rules: ${costume}. `;

  return (
    IDENTITY_LOCK +
    KEEP_SCENE +
    CRAFT +
    who +
    "Normalize this still into the one Living Worlds series craft so every bible root looks like the same production. " +
    "Fix inconsistent hands and anatomy only if broken; do not redesign the character. " +
    "Do not invent extra people. Do not change the place already in the frame. " +
    "One pass. Same show as the rest of the series bible."
  );
}
