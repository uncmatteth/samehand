import { create } from "zustand";
import { toast } from "sonner";
import {
  loadCast,
  writeCast,
  type CastRecord,
  type CastTier,
  type NormStatus,
} from "@/lib/cast-idb";
import {
  blobToDataUrl,
  centerCropToSquare,
  dataUrlToBlob,
  isImageFile,
} from "@/lib/image";
import {
  LIVING_WORLDS_HOUSE_URL,
  LIVING_WORLDS_TEMPLATE,
} from "@/lib/living-worlds-template";
import { normalizeCastRoot } from "@/lib/restyle";

export type CastMember = CastRecord & {
  sourceUrl: string | null;
  normUrl: string | null;
  /** Active display: normalized if done, else source */
  url: string | null;
};

type NormRun = "idle" | "proof" | "remaining" | "paused";

type CastState = {
  hydrating: boolean;
  settingUp: boolean;
  members: CastMember[];
  normRun: NormRun;
  normStartedAt: number | null;
  hydrate: () => Promise<void>;
  setupLivingWorlds: (opts?: { force?: boolean; silent?: boolean }) => Promise<void>;
  addMember: (
    file: File,
    partial?: Partial<
      Pick<CastRecord, "name" | "tier" | "costumeNotes" | "notes" | "e01">
    >,
  ) => Promise<void>;
  attachRoot: (id: string, file: File) => Promise<void>;
  updateMember: (
    id: string,
    patch: Partial<
      Pick<CastRecord, "name" | "tier" | "costumeNotes" | "notes" | "e01">
    >,
  ) => void;
  removeMember: (id: string) => void;
  clearCast: () => void;
  proofNormalize: () => Promise<void>;
  normalizeRemaining: () => Promise<void>;
  pauseNormalize: () => void;
  resumeNormalize: () => Promise<void>;
  retryNormalizeFailed: () => Promise<void>;
  redoNormalize: (id: string) => Promise<void>;
};

let persistChain: Promise<void> = Promise.resolve();
let setupOnce = false;
let normEpoch = 0;
let normStop = false;
let normQueueActive = false;

function revokeLater(urls: (string | null | undefined)[]) {
  const unique = [...new Set(urls.filter(Boolean))] as string[];
  requestAnimationFrame(() => {
    for (const url of unique) URL.revokeObjectURL(url);
  });
}

function activeUrl(sourceUrl: string | null, normUrl: string | null, status: NormStatus) {
  if (status === "done" && normUrl) return normUrl;
  return sourceUrl;
}

function toMember(record: CastRecord): CastMember {
  const sourceUrl = record.sourceBlob
    ? URL.createObjectURL(record.sourceBlob)
    : null;
  const normUrl = record.normBlob
    ? URL.createObjectURL(record.normBlob)
    : null;
  return {
    ...record,
    sourceUrl,
    normUrl,
    url: activeUrl(sourceUrl, normUrl, record.normStatus),
  };
}

function enqueuePersist(read: () => CastMember[]) {
  persistChain = persistChain
    .then(async () => {
      const members = read();
      await writeCast({
        members: members.map(
          (m): CastRecord => ({
            id: m.id,
            name: m.name,
            tier: m.tier,
            costumeNotes: m.costumeNotes,
            notes: m.notes,
            e01: m.e01,
            order: m.order,
            sourceBlob: m.sourceBlob,
            normBlob: m.normBlob,
            normStatus: m.normStatus === "running" ? "queued" : m.normStatus,
            normError: m.normError,
          }),
        ),
      });
    })
    .catch((err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Could not save cast bible";
      toast.error(message);
    });
}

function nameFromFile(file: File): string {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!base) return "Unnamed";
  return base
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function fetchRootBlob(fileName: string): Promise<Blob | null> {
  try {
    const res = await fetch(`/living-worlds/${fileName}`);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

/** Prefer normalized roots in lock text when available. */
export function buildCastLockText(members: CastMember[]): string {
  const ranked = [...members].sort((a, b) => {
    const ta = a.tier === "A" ? 0 : a.tier === "B" ? 1 : 2;
    const tb = b.tier === "A" ? 0 : b.tier === "B" ? 1 : 2;
    return ta - tb || a.order - b.order;
  });
  const lines: string[] = [];
  for (const m of ranked) {
    if (m.tier === "C") continue;
    if (m.tier === "B" && !m.sourceBlob && !m.e01) continue;
    const costume = m.costumeNotes.trim() || "match established look";
    const craft =
      m.normStatus === "done"
        ? "normalized Living Worlds root"
        : "series root";
    lines.push(`${m.name} (${m.tier}, ${craft}): ${costume}`);
  }
  if (lines.length === 0) return "";

  const cNotes = ranked
    .filter((m) => m.tier === "C" && m.e01)
    .map((m) => m.name)
    .join(", ");

  let text =
    "Series cast identity lock — when any of these people appear in the picture, keep their exact identity and costume rules: " +
    lines.join(" · ") +
    ". Do not recast leads as each other. Do not invent new hero faces for named roles. ";

  if (cNotes) {
    text +=
      `Background/historical class (${cNotes}): keep continuity within the sequence only; do not map them onto series leads. `;
  }
  text +=
    "Do not replace named characters with historical prologue traders or anonymous crowd doubles. ";
  return text;
}

function needsNormalize(m: CastMember): boolean {
  return Boolean(m.sourceBlob) && m.tier !== "C";
}

function failNorm(id: string, error: string) {
  useCast.setState((state) => ({
    members: state.members.map((m) =>
      m.id === id
        ? { ...m, normStatus: "failed" as const, normError: error }
        : m,
    ),
  }));
  toast.error(error);
}

async function normalizeOne(member: CastMember, myEpoch: number) {
  if (!member.sourceBlob) {
    failNorm(member.id, "No root still to normalize");
    return;
  }
  try {
    const cropped = await centerCropToSquare(member.sourceBlob);
    if (myEpoch !== normEpoch) return;
    const dataUrl = await blobToDataUrl(cropped);
    if (myEpoch !== normEpoch) return;
    const result = await normalizeCastRoot({
      data: {
        imageDataUrl: dataUrl,
        name: member.name,
        costumeNotes: member.costumeNotes,
        tier: member.tier,
        isArtifact: /custodian/i.test(member.name),
      },
    });
    if (myEpoch !== normEpoch) return;
    if (!result.ok) {
      failNorm(member.id, result.error);
      return;
    }
    const normBlob = await dataUrlToBlob(result.dataUrl);
    if (myEpoch !== normEpoch) return;
    const normUrl = URL.createObjectURL(normBlob);
    useCast.setState((state) => ({
      members: state.members.map((m) => {
        if (m.id !== member.id) return m;
        if (m.normUrl && m.normUrl !== normUrl) revokeLater([m.normUrl]);
        return {
          ...m,
          normBlob,
          normUrl,
          url: normUrl,
          normStatus: "done" as const,
          normError: null,
        };
      }),
    }));
  } catch (err) {
    if (myEpoch !== normEpoch) return;
    const raw = err instanceof Error ? err.message : "Normalize failed";
    const message = /timeout|abort|network|failed to fetch/i.test(raw)
      ? "Normalize timed out. Tap Redo on that card only."
      : raw;
    failNorm(member.id, message);
  }
}

async function runNormQueue(mode: "proof" | "remaining") {
  if (normQueueActive) return;
  normQueueActive = true;
  normStop = false;
  const myEpoch = normEpoch;
  useCast.setState({ normRun: mode, normStartedAt: Date.now() });
  try {
    while (true) {
      if (myEpoch !== normEpoch) return;
      if (normStop) break;
      const { members } = useCast.getState();
      const candidates = members.filter(needsNormalize);
      let target: CastMember | undefined;
      if (mode === "proof") {
        target = candidates.find(
          (m) =>
            m.normStatus === "queued" ||
            m.normStatus === "raw" ||
            m.normStatus === "failed",
        );
        // Prefer first A
        const a = candidates.find(
          (m) =>
            m.tier === "A" &&
            (m.normStatus === "queued" ||
              m.normStatus === "raw" ||
              m.normStatus === "failed"),
        );
        target = a ?? target;
      } else {
        const firstDone = candidates.some(
          (m) => m.tier === "A" && m.normStatus === "done",
        ) || candidates.some((m) => m.normStatus === "done");
        if (!firstDone) {
          toast.error("Proof-normalize one root before normalizing the rest");
          break;
        }
        target = candidates.find(
          (m) => m.normStatus === "queued" || m.normStatus === "raw",
        );
      }
      if (!target) break;

      // Mark queued roots that are raw
      useCast.setState((state) => ({
        members: state.members.map((m) =>
          m.id === target!.id
            ? { ...m, normStatus: "running" as const, normError: null }
            : m.normStatus === "raw" && needsNormalize(m)
              ? { ...m, normStatus: "queued" as const }
              : m,
        ),
      }));

      await normalizeOne(target, myEpoch);
      if (myEpoch !== normEpoch) return;
      enqueuePersist(() => useCast.getState().members);
      if (mode === "proof") break;
    }
  } finally {
    if (myEpoch === normEpoch) {
      useCast.setState((state) => ({
        members: state.members.map((m) =>
          m.normStatus === "running"
            ? {
                ...m,
                normStatus: "failed" as const,
                normError: "Normalize interrupted. Tap Redo on that card only.",
              }
            : m,
        ),
      }));
      const next = useCast.getState().members;
      const remaining = next.some(
        (m) =>
          needsNormalize(m) &&
          (m.normStatus === "queued" || m.normStatus === "raw"),
      );
      const run: NormRun = normStop && remaining ? "paused" : "idle";
      useCast.setState({ normRun: run, normStartedAt: null });
      enqueuePersist(() => useCast.getState().members);
      const done = next.filter((m) => m.normStatus === "done").length;
      if (!normStop && done > 0 && mode === "remaining") {
        const need = next.filter(needsNormalize).length;
        if (done >= need) {
          toast.success(`${done} bible roots normalized`);
        }
      }
    }
    normQueueActive = false;
  }
}

export const useCast = create<CastState>((set, get) => ({
  hydrating: true,
  settingUp: false,
  members: [],
  normRun: "idle",
  normStartedAt: null,

  hydrate: async () => {
    set({ hydrating: true });
    try {
      const snap = await loadCast();
      const members = snap.members.map(toMember);
      set({ members, hydrating: false, normRun: "idle" });
      if (members.length === 0 && !setupOnce) {
        setupOnce = true;
        await get().setupLivingWorlds({ silent: true });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not restore cast bible";
      toast.error(message);
      set({ hydrating: false });
    }
  },

  setupLivingWorlds: async (opts) => {
    const force = opts?.force === true;
    const silent = opts?.silent === true;
    const existing = get().members;
    if (existing.length > 0 && !force) {
      if (!silent) toast.message("Living Worlds bible already loaded");
      return;
    }
    set({ settingUp: true });
    try {
      const prevUrls = existing.flatMap((m) => [m.sourceUrl, m.normUrl]);
      const seeded: CastMember[] = [];
      for (let i = 0; i < LIVING_WORLDS_TEMPLATE.length; i += 1) {
        const row = LIVING_WORLDS_TEMPLATE[i];
        let sourceBlob: Blob | null = null;
        let sourceUrl: string | null = null;
        if (row.rootFile) {
          sourceBlob = await fetchRootBlob(row.rootFile);
          if (sourceBlob) sourceUrl = URL.createObjectURL(sourceBlob);
        }
        seeded.push({
          id: crypto.randomUUID(),
          name: row.name,
          tier: row.tier,
          costumeNotes: row.costumeNotes,
          notes: row.notes,
          e01: row.e01,
          order: i + 1,
          sourceBlob,
          normBlob: null,
          normStatus: sourceBlob && row.tier !== "C" ? "raw" : "raw",
          normError: null,
          sourceUrl,
          normUrl: null,
          url: sourceUrl,
        });
      }
      set({ members: seeded, settingUp: false });
      revokeLater(prevUrls);
      enqueuePersist(() => get().members);
      const rooted = seeded.filter((m) => m.sourceBlob).length;
      if (!silent) {
        toast.success(
          `Living Worlds loaded — ${rooted} roots. Next: Proof normalize → Normalize remaining.`,
        );
      }
    } catch (err) {
      set({ settingUp: false });
      const message =
        err instanceof Error ? err.message : "Could not set up Living Worlds";
      toast.error(message);
    }
  },

  addMember: async (file, partial) => {
    if (!isImageFile(file)) {
      toast.error("Drop a character still (JPEG, PNG, or WebP)");
      return;
    }
    const order =
      get().members.reduce((max, m) => Math.max(max, m.order), 0) + 1;
    const sourceUrl = URL.createObjectURL(file);
    const member: CastMember = {
      id: crypto.randomUUID(),
      name: partial?.name?.trim() || nameFromFile(file),
      tier: partial?.tier ?? "B",
      costumeNotes: partial?.costumeNotes ?? "",
      notes: partial?.notes ?? "",
      e01: partial?.e01 ?? true,
      order,
      sourceBlob: file,
      normBlob: null,
      normStatus: "raw",
      normError: null,
      sourceUrl,
      normUrl: null,
      url: sourceUrl,
    };
    set((s) => ({ members: [...s.members, member] }));
    enqueuePersist(() => get().members);
    toast.success(`${member.name} added — still needs normalize`);
  },

  attachRoot: async (id, file) => {
    if (!isImageFile(file)) {
      toast.error("Drop a root still (JPEG, PNG, or WebP)");
      return;
    }
    const prev = get().members.find((m) => m.id === id);
    if (!prev) return;
    const sourceUrl = URL.createObjectURL(file);
    set((s) => ({
      members: s.members.map((m) => {
        if (m.id !== id) return m;
        revokeLater([m.sourceUrl, m.normUrl]);
        return {
          ...m,
          sourceBlob: file,
          sourceUrl,
          normBlob: null,
          normUrl: null,
          url: sourceUrl,
          normStatus: "raw" as const,
          normError: null,
        };
      }),
    }));
    enqueuePersist(() => get().members);
    toast.success(`Root set for ${prev.name} — re-normalize when ready`);
  },

  updateMember: (id, patch) => {
    set((s) => ({
      members: s.members.map((m) =>
        m.id === id
          ? {
              ...m,
              ...patch,
              name:
                patch.name !== undefined
                  ? patch.name.trim() || m.name
                  : m.name,
            }
          : m,
      ),
    }));
    enqueuePersist(() => get().members);
  },

  removeMember: (id) => {
    const target = get().members.find((m) => m.id === id);
    if (!target) return;
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
    revokeLater([target.sourceUrl, target.normUrl]);
    enqueuePersist(() => get().members);
  },

  clearCast: () => {
    const urls = get().members.flatMap((m) => [m.sourceUrl, m.normUrl]);
    normEpoch += 1;
    normStop = true;
    set({ members: [], normRun: "idle", normStartedAt: null });
    revokeLater(urls);
    enqueuePersist(() => get().members);
    toast.success("Cast bible cleared");
  },

  proofNormalize: async () => {
    const { members, normRun } = get();
    if (normRun === "proof" || normRun === "remaining") return;
    const candidates = members.filter(needsNormalize);
    if (candidates.length === 0) {
      toast.error("Load Living Worlds roots first");
      return;
    }
    const first =
      candidates.find((m) => m.tier === "A") ?? candidates[0];
    if (first.normStatus === "done") {
      toast.success("Proof root already normalized. Normalize remaining when ready.");
      return;
    }
    set({
      members: members.map((m) =>
        m.id === first.id
          ? { ...m, normStatus: "queued", normError: null }
          : m,
      ),
    });
    await runNormQueue("proof");
  },

  normalizeRemaining: async () => {
    const { members, normRun } = get();
    if (normRun === "proof" || normRun === "remaining") return;
    const candidates = members.filter(needsNormalize);
    if (candidates.length === 0) return;
    const anyDone = candidates.some((m) => m.normStatus === "done");
    if (!anyDone) {
      toast.error("Proof-normalize one root first");
      return;
    }
    set({
      members: members.map((m) =>
        needsNormalize(m) &&
        (m.normStatus === "raw" || m.normStatus === "failed")
          ? { ...m, normStatus: "queued", normError: null }
          : m,
      ),
    });
    await runNormQueue("remaining");
  },

  pauseNormalize: () => {
    const { normRun } = get();
    if (normRun !== "proof" && normRun !== "remaining") return;
    normStop = true;
  },

  resumeNormalize: async () => {
    const { normRun, members } = get();
    if (normRun !== "paused") return;
    const anyDone = members.some((m) => m.normStatus === "done");
    if (!anyDone) {
      await runNormQueue("proof");
      return;
    }
    await runNormQueue("remaining");
  },

  retryNormalizeFailed: async () => {
    const { members, normRun } = get();
    if (normRun === "proof" || normRun === "remaining") return;
    const failed = members.filter((m) => m.normStatus === "failed");
    if (failed.length === 0) return;
    set({
      members: members.map((m) =>
        m.normStatus === "failed"
          ? { ...m, normStatus: "queued", normError: null }
          : m,
      ),
    });
    const anyDone = get().members.some((m) => m.normStatus === "done");
    if (!anyDone) {
      await runNormQueue("proof");
      return;
    }
    await runNormQueue("remaining");
  },

  redoNormalize: async (id) => {
    const { members, normRun } = get();
    if (normRun === "proof" || normRun === "remaining") return;
    const target = members.find((m) => m.id === id);
    if (!target || !needsNormalize(target)) return;
    if (normQueueActive) return;
    normQueueActive = true;
    normStop = false;
    const myEpoch = normEpoch;
    useCast.setState({
      normRun: "remaining",
      normStartedAt: Date.now(),
      members: members.map((m) =>
        m.id === id
          ? { ...m, normStatus: "running" as const, normError: null }
          : m,
      ),
    });
    try {
      await normalizeOne(
        { ...target, normStatus: "running", normError: null },
        myEpoch,
      );
      if (myEpoch === normEpoch) {
        enqueuePersist(() => useCast.getState().members);
        useCast.setState({ normRun: "idle", normStartedAt: null });
      }
    } finally {
      if (myEpoch === normEpoch) {
        useCast.setState((state) => ({
          normRun: "idle",
          normStartedAt: null,
          members: state.members.map((m) =>
            m.id === id && m.normStatus === "running"
              ? {
                  ...m,
                  normStatus: "failed" as const,
                  normError:
                    "Normalize interrupted. Tap Redo on that card only.",
                }
              : m,
          ),
        }));
      }
      normQueueActive = false;
    }
  },
}));

export type { CastTier, NormStatus };
export { LIVING_WORLDS_HOUSE_URL };
