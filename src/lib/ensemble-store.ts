import { create } from "zustand";
import { toast } from "sonner";
import { buildIdentityCollage } from "@/lib/collage";
import {
  loadEnsemble,
  writeEnsemble,
  type EnsembleKind,
  type PlateRecord,
  type PlateStatus,
  type RosterRecord,
} from "@/lib/ensemble-idb";
import { composeEnsemble } from "@/lib/ensemble";
import {
  blobToDataUrl,
  dataUrlToBlob,
  isImageFile,
  yieldTick,
} from "@/lib/image";

export type RosterMember = {
  id: string;
  name: string;
  order: number;
  blob: Blob;
  url: string;
};

export type Plate = {
  id: string;
  name: string;
  kind: EnsembleKind;
  order: number;
  memberIds: string[];
  blob: Blob | null;
  url: string | null;
  status: PlateStatus;
  error: string | null;
};

type EnsembleState = {
  hydrating: boolean;
  roster: RosterMember[];
  plates: Plate[];
  selectedIds: string[];
  composing: boolean;
  hydrate: () => Promise<void>;
  addToRoster: (files: File[]) => Promise<void>;
  addBlobsToRoster: (items: { name: string; blob: Blob }[]) => Promise<void>;
  removeFromRoster: (id: string) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  composeSelection: (kind: EnsembleKind) => Promise<void>;
  redoPlate: (id: string) => Promise<void>;
  removePlate: (id: string) => void;
  clearEnsemble: () => void;
};

let persistChain: Promise<void> = Promise.resolve();

function revokeLater(urls: string[]) {
  const unique = [...new Set(urls.filter(Boolean))];
  requestAnimationFrame(() => {
    for (const url of unique) URL.revokeObjectURL(url);
  });
}

function enqueuePersist(read: () => { roster: RosterMember[]; plates: Plate[] }) {
  persistChain = persistChain
    .then(async () => {
      const snap = read();
      await writeEnsemble({
        roster: snap.roster.map(
          (r): RosterRecord => ({
            id: r.id,
            name: r.name,
            order: r.order,
            blob: r.blob,
          }),
        ),
        plates: snap.plates.map(
          (p): PlateRecord => ({
            id: p.id,
            name: p.name,
            kind: p.kind,
            order: p.order,
            memberIds: p.memberIds,
            blob: p.blob,
            status: p.status === "composing" ? "failed" : p.status,
            error: p.error,
          }),
        ),
      });
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Could not save ensemble";
      toast.error(message);
    });
}

function toMember(r: RosterRecord): RosterMember {
  return {
    id: r.id,
    name: r.name,
    order: r.order,
    blob: r.blob,
    url: URL.createObjectURL(r.blob),
  };
}

function toPlate(p: PlateRecord): Plate {
  return {
    id: p.id,
    name: p.name,
    kind: p.kind,
    order: p.order,
    memberIds: p.memberIds,
    blob: p.blob,
    url: p.blob ? URL.createObjectURL(p.blob) : null,
    status: p.status === "composing" ? "failed" : p.status,
    error: p.error,
  };
}

async function runCompose(
  kind: EnsembleKind,
  sources: { id: string; name: string; blob: Blob }[],
  existingPlateId?: string,
): Promise<void> {
  if (sources.length < 2 || sources.length > 5) {
    toast.error("Select 2 to 5 characters or plates");
    return;
  }
  const state = useEnsemble.getState();
  if (state.composing) {
    toast.error("Wait for the current compose to finish");
    return;
  }

  const plateId = existingPlateId ?? crypto.randomUUID();
  const name =
    kind === "poster"
      ? `Poster · ${sources.length} plates`
      : kind === "section"
        ? `Section · ${sources.length} groups`
        : `Group · ${sources.map((s) => s.name.replace(/\.[^.]+$/, "")).slice(0, 3).join(", ")}`;

  const order =
    existingPlateId != null
      ? state.plates.find((p) => p.id === existingPlateId)?.order ??
        state.plates.length + 1
      : state.plates.length + 1;

  useEnsemble.setState((s) => {
    const nextPlate: Plate = {
      id: plateId,
      name,
      kind,
      order,
      memberIds: sources.map((x) => x.id),
      blob: null,
      url: null,
      status: "composing",
      error: null,
    };
    const plates = existingPlateId
      ? s.plates.map((p) =>
          p.id === plateId
            ? {
                ...p,
                status: "composing" as const,
                error: null,
                blob: null,
                url: p.url ? (revokeLater([p.url]), null) : null,
              }
            : p,
        )
      : [...s.plates, nextPlate];
    return { plates, composing: true, selectedIds: [] };
  });

  try {
    const collage = await buildIdentityCollage(sources.map((s) => s.blob));
    const dataUrl = await blobToDataUrl(collage);
    const result = await composeEnsemble({
      data: { imageDataUrl: dataUrl, kind, count: sources.length },
    });
    if (!result.ok) {
      useEnsemble.setState((s) => ({
        composing: false,
        plates: s.plates.map((p) =>
          p.id === plateId
            ? { ...p, status: "failed" as const, error: result.error }
            : p,
        ),
      }));
      toast.error(result.error);
      enqueuePersist(() => useEnsemble.getState());
      return;
    }
    const blob = await dataUrlToBlob(result.dataUrl);
    const url = URL.createObjectURL(blob);
    useEnsemble.setState((s) => ({
      composing: false,
      plates: s.plates.map((p) => {
        if (p.id !== plateId) return p;
        if (p.url) revokeLater([p.url]);
        return {
          ...p,
          blob,
          url,
          status: "done" as const,
          error: null,
        };
      }),
    }));
    enqueuePersist(() => useEnsemble.getState());
    toast.success(
      kind === "poster"
        ? "Poster ready"
        : kind === "section"
          ? "Section plate ready"
          : "Group plate ready",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Compose failed";
    useEnsemble.setState((s) => ({
      composing: false,
      plates: s.plates.map((p) =>
        p.id === plateId
          ? { ...p, status: "failed" as const, error: message }
          : p,
      ),
    }));
    toast.error(message);
    enqueuePersist(() => useEnsemble.getState());
  }
}

export const useEnsemble = create<EnsembleState>((set, get) => ({
  hydrating: true,
  roster: [],
  plates: [],
  selectedIds: [],
  composing: false,

  hydrate: async () => {
    set({ hydrating: true });
    try {
      const snap = await loadEnsemble();
      const roster: RosterMember[] = [];
      for (const r of snap.roster) {
        roster.push(toMember(r));
        if (roster.length % 8 === 0) await yieldTick();
      }
      const plates = snap.plates.map(toPlate);
      set({ roster, plates, hydrating: false, selectedIds: [], composing: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not restore ensemble";
      toast.error(message);
      set({ hydrating: false });
    }
  },

  addToRoster: async (files) => {
    const images = files.filter(isImageFile);
    if (images.length === 0) {
      toast.error("Drop character images (JPEG, PNG, or WebP)");
      return;
    }
    const start = get().roster.reduce((m, r) => Math.max(m, r.order), 0);
    const added: RosterMember[] = [];
    for (let i = 0; i < images.length; i += 1) {
      const file = images[i];
      added.push({
        id: crypto.randomUUID(),
        name: file.name,
        order: start + i + 1,
        blob: file,
        url: URL.createObjectURL(file),
      });
      if (i % 4 === 3) await yieldTick();
    }
    set((s) => ({ roster: [...s.roster, ...added] }));
    enqueuePersist(() => get());
    toast.success(
      added.length === 1 ? "1 character on roster" : `${added.length} on roster`,
    );
  },

  addBlobsToRoster: async (items) => {
    if (items.length === 0) return;
    const start = get().roster.reduce((m, r) => Math.max(m, r.order), 0);
    const added: RosterMember[] = items.map((item, i) => ({
      id: crypto.randomUUID(),
      name: item.name,
      order: start + i + 1,
      blob: item.blob,
      url: URL.createObjectURL(item.blob),
    }));
    set((s) => ({ roster: [...s.roster, ...added] }));
    enqueuePersist(() => get());
    toast.success(
      added.length === 1
        ? "Final added to roster"
        : `${added.length} finals on roster`,
    );
  },

  removeFromRoster: (id) => {
    const { roster, selectedIds } = get();
    const target = roster.find((r) => r.id === id);
    if (!target) return;
    set({
      roster: roster.filter((r) => r.id !== id),
      selectedIds: selectedIds.filter((x) => x !== id),
    });
    revokeLater([target.url]);
    enqueuePersist(() => get());
  },

  toggleSelect: (id) => {
    const { selectedIds, composing } = get();
    if (composing) return;
    if (selectedIds.includes(id)) {
      set({ selectedIds: selectedIds.filter((x) => x !== id) });
      return;
    }
    if (selectedIds.length >= 5) {
      toast.error("Max 5 per compose — build the tree in small groups");
      return;
    }
    set({ selectedIds: [...selectedIds, id] });
  },

  clearSelection: () => set({ selectedIds: [] }),

  composeSelection: async (kind) => {
    const { selectedIds, roster, plates, composing } = get();
    if (composing) return;
    if (selectedIds.length < 2 || selectedIds.length > 5) {
      toast.error("Select 2 to 5 items");
      return;
    }

    if (kind === "group") {
      const sources = selectedIds
        .map((id) => roster.find((r) => r.id === id))
        .filter(Boolean) as RosterMember[];
      if (sources.length !== selectedIds.length) {
        toast.error("Selection must be characters for a group plate");
        return;
      }
      await runCompose(
        "group",
        sources.map((s) => ({ id: s.id, name: s.name, blob: s.blob })),
      );
      return;
    }

    const sources = selectedIds
      .map((id) => plates.find((p) => p.id === id && p.status === "done" && p.blob))
      .filter(Boolean) as Plate[];
    if (sources.length !== selectedIds.length) {
      toast.error(
        kind === "poster"
          ? "Select 2–5 finished group or section plates for a poster"
          : "Select 2–5 finished group plates for a section",
      );
      return;
    }
    if (kind === "section" && sources.some((p) => p.kind === "poster")) {
      toast.error("Build sections from groups, not posters");
      return;
    }
    await runCompose(
      kind,
      sources.map((s) => ({
        id: s.id,
        name: s.name,
        blob: s.blob as Blob,
      })),
    );
  },

  redoPlate: async (id) => {
    const { plates, roster, composing } = get();
    if (composing) return;
    const plate = plates.find((p) => p.id === id);
    if (!plate || plate.memberIds.length < 2) return;

    if (plate.kind === "group") {
      const sources = plate.memberIds
        .map((mid) => roster.find((r) => r.id === mid))
        .filter(Boolean) as RosterMember[];
      if (sources.length < 2) {
        toast.error("Original characters missing from roster");
        return;
      }
      await runCompose(
        "group",
        sources.map((s) => ({ id: s.id, name: s.name, blob: s.blob })),
        plate.id,
      );
      return;
    }

    const sources = plate.memberIds
      .map((mid) => plates.find((p) => p.id === mid && p.status === "done" && p.blob))
      .filter(Boolean) as Plate[];
    if (sources.length < 2) {
      toast.error("Source plates missing — keep lower plates locked");
      return;
    }
    await runCompose(
      plate.kind,
      sources.map((s) => ({ id: s.id, name: s.name, blob: s.blob as Blob })),
      plate.id,
    );
  },

  removePlate: (id) => {
    const { plates, selectedIds, composing } = get();
    if (composing) {
      toast.error("Wait for compose to finish");
      return;
    }
    const target = plates.find((p) => p.id === id);
    if (!target) return;
    set({
      plates: plates.filter((p) => p.id !== id),
      selectedIds: selectedIds.filter((x) => x !== id),
    });
    if (target.url) revokeLater([target.url]);
    enqueuePersist(() => get());
  },

  clearEnsemble: () => {
    const { roster, plates, composing } = get();
    if (composing) {
      toast.error("Wait for compose to finish");
      return;
    }
    const urls = [
      ...roster.map((r) => r.url),
      ...plates.map((p) => p.url).filter(Boolean),
    ] as string[];
    set({ roster: [], plates: [], selectedIds: [] });
    revokeLater(urls);
    enqueuePersist(() => get());
    toast.success("Ensemble cleared");
  },
}));
