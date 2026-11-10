import { create } from "zustand";
import { toast } from "sonner";
import {
  loadSession,
  writeSession,
  type HouseRecord,
  type PageRecord,
  type PageStatus,
  type RestyleMode,
  type RunMode,
} from "@/lib/idb";
import {
  blobToDataUrl,
  centerCropToSquare,
  dataUrlToBlob,
  isImageFile,
  yieldTick,
} from "@/lib/image";
import { restylePage } from "@/lib/restyle";
import { buildCastLockText, useCast } from "@/lib/cast-store";

export type { PageStatus, RestyleMode, RunMode };

export type House = {
  name: string;
  blob: Blob;
  url: string;
};

export type Page = {
  id: string;
  name: string;
  order: number;
  croppedBlob: Blob;
  croppedUrl: string;
  restyleBlob: Blob | null;
  restyleUrl: string | null;
  status: PageStatus;
  error: string | null;
};

type StudioState = {
  hydrating: boolean;
  house: House | null;
  pages: Page[];
  run: RunMode;
  restyleMode: RestyleMode;
  preparing: number;
  preparingTotal: number;
  restyleStartedAt: number | null;
  hydrate: () => Promise<void>;
  lockHouse: (file: File) => Promise<void>;
  addPages: (files: File[]) => Promise<void>;
  setRestyleMode: (mode: RestyleMode) => void;
  proofFirst: () => Promise<void>;
  restyleRemaining: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  retryFailed: () => Promise<void>;
  retryPage: (id: string) => Promise<void>;
  removePage: (id: string) => void;
  startOver: () => void;
};

let epoch = 0;
let stopRequested = false;
let queueActive = false;
let persistChain: Promise<void> = Promise.resolve();

function currentEpoch() {
  return epoch;
}

function collectUrls(house: House | null, pages: Page[]): string[] {
  const urls: string[] = [];
  if (house) urls.push(house.url);
  for (const page of pages) {
    urls.push(page.croppedUrl);
    if (page.restyleUrl) urls.push(page.restyleUrl);
  }
  return urls;
}

function revokeLater(urls: string[]) {
  const unique = [...new Set(urls.filter(Boolean))];
  requestAnimationFrame(() => {
    for (const url of unique) URL.revokeObjectURL(url);
  });
}

function enqueuePersist(read: () => {
  house: House | null;
  pages: Page[];
  run: RunMode;
  restyleMode: RestyleMode;
}) {
  const myEpoch = currentEpoch();
  persistChain = persistChain
    .then(async () => {
      if (myEpoch !== currentEpoch()) return;
      const snap = read();
      if (myEpoch !== currentEpoch()) return;
      await writeSession({
        house: snap.house
          ? { name: snap.house.name, blob: snap.house.blob }
          : null,
        pages: snap.pages.map(
          (page): PageRecord => ({
            id: page.id,
            name: page.name,
            order: page.order,
            croppedBlob: page.croppedBlob,
            restyleBlob: page.restyleBlob,
            status: page.status === "restyling" ? "queued" : page.status,
            error: page.error,
          }),
        ),
        meta: {
          run: snap.run === "paused" ? "paused" : "idle",
          restyleMode: snap.restyleMode,
        },
      });
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : "Could not save studio";
      toast.error(message);
    });
}

function toHouse(record: HouseRecord): House {
  return {
    name: record.name,
    blob: record.blob,
    url: URL.createObjectURL(record.blob),
  };
}

function toPage(record: PageRecord): Page {
  return {
    id: record.id,
    name: record.name,
    order: record.order,
    croppedBlob: record.croppedBlob,
    croppedUrl: URL.createObjectURL(record.croppedBlob),
    restyleBlob: record.restyleBlob,
    restyleUrl: record.restyleBlob
      ? URL.createObjectURL(record.restyleBlob)
      : null,
    status: record.status === "restyling" ? "queued" : record.status,
    error: record.error,
  };
}

async function restyleOne(page: Page, myEpoch: number): Promise<void> {
  try {
    const dataUrl = await blobToDataUrl(page.croppedBlob);
    if (myEpoch !== currentEpoch()) return;
    const castLock = buildCastLockText(useCast.getState().members);
    const result = await restylePage({
      data: {
        imageDataUrl: dataUrl,
        mode: useStudio.getState().restyleMode,
        castLock,
      },
    });
    if (myEpoch !== currentEpoch()) return;
    if (!result.ok) {
      failPage(page.id, result.error);
      return;
    }
    const restyleBlob = await dataUrlToBlob(result.dataUrl);
    if (myEpoch !== currentEpoch()) return;
    const restyleUrl = URL.createObjectURL(restyleBlob);
    useStudio.setState((state) => ({
      pages: state.pages.map((item) => {
        if (item.id !== page.id) return item;
        if (item.restyleUrl && item.restyleUrl !== restyleUrl) {
          revokeLater([item.restyleUrl]);
        }
        return {
          ...item,
          restyleBlob,
          restyleUrl,
          status: "done",
          error: null,
        };
      }),
    }));
  } catch (err) {
    if (myEpoch !== currentEpoch()) return;
    const raw = err instanceof Error ? err.message : "Restyle failed";
    const message = /timeout|abort|network|failed to fetch/i.test(raw)
      ? "Restyle timed out. Tap Redo on that card only."
      : raw;
    failPage(page.id, message);
  }
}

function failPage(id: string, error: string) {
  useStudio.setState((state) => ({
    pages: state.pages.map((item) =>
      item.id === id ? { ...item, status: "failed" as const, error } : item,
    ),
  }));
  toast.error(error);
}

async function runQueue(mode: "proof" | "remaining") {
  if (queueActive) return;
  queueActive = true;
  stopRequested = false;
  const myEpoch = currentEpoch();
  useStudio.setState({ run: mode });
  try {
    while (true) {
      if (myEpoch !== currentEpoch()) return;
      if (stopRequested) break;
      const { pages, house } = useStudio.getState();
      if (!house) break;
      let target: Page | undefined;
      if (mode === "proof") {
        target = pages[0]?.status === "queued" ? pages[0] : undefined;
      } else {
        if (pages[0] && pages[0].status !== "done") {
          toast.error("Proof the first page before restyling the rest");
          break;
        }
        target = pages.find((page) => page.status === "queued");
      }
      if (!target) break;
      useStudio.setState((state) => ({
        restyleStartedAt: Date.now(),
        pages: state.pages.map((page) =>
          page.id === target.id
            ? { ...page, status: "restyling" as const, error: null }
            : page,
        ),
      }));
      await restyleOne(target, myEpoch);
      if (myEpoch !== currentEpoch()) return;
      enqueuePersist(() => useStudio.getState());
      if (mode === "proof") break;
    }
  } finally {
    if (myEpoch === currentEpoch()) {
      const { pages } = useStudio.getState();
      const leftover = pages.some((page) => page.status === "restyling");
      if (leftover) {
        useStudio.setState((state) => ({
          pages: state.pages.map((page) =>
            page.status === "restyling"
              ? {
                  ...page,
                  status: "failed" as const,
                  error: "Restyle interrupted. Tap Redo on that card only.",
                }
              : page,
          ),
        }));
      }
      const next = useStudio.getState().pages;
      const remaining = next.some((page) => page.status === "queued");
      const run: RunMode = stopRequested && remaining ? "paused" : "idle";
      useStudio.setState({ run, restyleStartedAt: null });
      enqueuePersist(() => useStudio.getState());
      const done = next.filter((page) => page.status === "done").length;
      if (!stopRequested && done === next.length && next.length > 0) {
        toast.success(`${done} restyle${done === 1 ? "" : "s"} ready`);
      }
    }
    queueActive = false;
  }
}

export const useStudio = create<StudioState>((set, get) => ({
  hydrating: true,
  house: null,
  pages: [],
  run: "idle",
  restyleMode: "artist",
  preparing: 0,
  preparingTotal: 0,
  restyleStartedAt: null,

  hydrate: async () => {
    const myEpoch = currentEpoch();
    set({ hydrating: true });
    try {
      const snap = await loadSession();
      if (myEpoch !== currentEpoch()) return;
      const house = snap.house ? toHouse(snap.house) : null;
      const pages: Page[] = [];
      for (const record of snap.pages) {
        if (myEpoch !== currentEpoch()) {
          revokeLater(collectUrls(house, pages));
          return;
        }
        pages.push(toPage(record));
        if (pages.length % 4 === 0) await yieldTick();
      }
      if (myEpoch !== currentEpoch()) {
        revokeLater(collectUrls(house, pages));
        return;
      }
      set({
        house,
        pages,
        run: "idle",
        restyleMode: snap.meta.restyleMode,
        hydrating: false,
      });
    } catch (err) {
      if (myEpoch !== currentEpoch()) return;
      const message = err instanceof Error ? err.message : "Could not restore studio";
      toast.error(message);
      set({ hydrating: false });
    }
  },

  lockHouse: async (file) => {
    if (!isImageFile(file)) {
      toast.error("Drop a house image (JPEG, PNG, or WebP)");
      return;
    }
    const { pages, house: prev } = get();
    if (pages.some((page) => page.status === "done" || page.status === "restyling")) {
      toast.error("Start over to lock a new house look");
      return;
    }
    const url = URL.createObjectURL(file);
    const next: House = { name: file.name, blob: file, url };
    set({ house: next });
    if (prev) revokeLater([prev.url]);
    enqueuePersist(() => get());
    toast.success("House look locked");
  },

  setRestyleMode: (mode) => {
    const { run, restyleMode } = get();
    if (mode === restyleMode) return;
    if (run === "proof" || run === "remaining") {
      toast.error("Pause before changing mode");
      return;
    }
    set({ restyleMode: mode });
    enqueuePersist(() => get());
    toast.success(
      mode === "artifact"
        ? "Artifact on. Same CGI, same ground. Redo a card to apply."
        : mode === "place"
          ? "Keep place on. Redo a card to apply — does not restyle by itself."
          : "Same artist on. Redo a card to apply — does not restyle by itself.",
    );
  },

  addPages: async (files) => {
    if (!get().house) {
      toast.error("Lock the house look first");
      return;
    }
    const images = files.filter(isImageFile);
    if (images.length === 0) {
      toast.error("Drop page images (JPEG, PNG, or WebP)");
      return;
    }
    const myEpoch = currentEpoch();
    set({ preparing: 0, preparingTotal: images.length });
    const added: Page[] = [];
    const startOrder = get().pages.reduce((max, page) => Math.max(max, page.order), 0);
    try {
      for (let i = 0; i < images.length; i += 1) {
        if (myEpoch !== currentEpoch()) {
          revokeLater(added.map((page) => page.croppedUrl));
          return;
        }
        const file = images[i];
        const croppedBlob = await centerCropToSquare(file);
        if (myEpoch !== currentEpoch()) {
          revokeLater(added.map((page) => page.croppedUrl));
          return;
        }
        added.push({
          id: crypto.randomUUID(),
          name: file.name,
          order: startOrder + i + 1,
          croppedBlob,
          croppedUrl: URL.createObjectURL(croppedBlob),
          restyleBlob: null,
          restyleUrl: null,
          status: "queued",
          error: null,
        });
        set({ preparing: i + 1 });
        if (i % 3 === 2) await yieldTick();
      }
      if (myEpoch !== currentEpoch()) {
        revokeLater(added.map((page) => page.croppedUrl));
        return;
      }
      set((state) => ({
        pages: [...state.pages, ...added],
        preparing: 0,
        preparingTotal: 0,
      }));
      enqueuePersist(() => get());
      toast.success(
        added.length === 1 ? "1 page ready" : `${added.length} pages ready`,
      );
    } catch (err) {
      revokeLater(added.map((page) => page.croppedUrl));
      if (myEpoch !== currentEpoch()) return;
      const message = err instanceof Error ? err.message : "Could not crop pages";
      toast.error(message);
      set({ preparing: 0, preparingTotal: 0 });
    }
  },

  proofFirst: async () => {
    const { house, pages, run } = get();
    if (!house) {
      toast.error("Lock the house look first");
      return;
    }
    if (pages.length === 0) {
      toast.error("Drop pages to restyle");
      return;
    }
    if (run === "proof" || run === "remaining") return;
    const first = pages[0];
    if (first.status === "done") {
      toast.success("Proof is already in. Restyle remaining when ready.");
      return;
    }
    if (first.status !== "queued" && first.status !== "failed") {
      return;
    }
    if (first.status === "failed") {
      set({
        pages: pages.map((page, i) =>
          i === 0 ? { ...page, status: "queued", error: null } : page,
        ),
      });
    }
    await runQueue("proof");
  },

  restyleRemaining: async () => {
    const { house, pages, run } = get();
    if (!house || pages.length === 0) return;
    if (run === "proof" || run === "remaining") return;
    if (pages[0].status !== "done") {
      toast.error("Proof the first page before restyling the rest");
      return;
    }
    await runQueue("remaining");
  },

  pause: () => {
    const { run } = get();
    if (run !== "proof" && run !== "remaining") return;
    stopRequested = true;
  },

  resume: async () => {
    const { pages, run } = get();
    if (run !== "paused") return;
    const first = pages[0];
    if (!first || first.status !== "done") {
      await runQueue("proof");
      return;
    }
    await runQueue("remaining");
  },

  retryFailed: async () => {
    const { pages, run } = get();
    if (run === "proof" || run === "remaining") return;
    const failed = pages.filter((page) => page.status === "failed");
    if (failed.length === 0) return;
    set({
      pages: pages.map((page) =>
        page.status === "failed" ? { ...page, status: "queued", error: null } : page,
      ),
    });
    const first = get().pages[0];
    if (!first || first.status !== "done") {
      await runQueue("proof");
      return;
    }
    await runQueue("remaining");
  },

  retryPage: async (id) => {
    const { pages, run } = get();
    if (run === "proof" || run === "remaining") return;
    const target = pages.find((page) => page.id === id);
    if (!target || (target.status !== "failed" && target.status !== "done")) return;
    set({
      pages: pages.map((page) =>
        page.id === id ? { ...page, status: "queued", error: null } : page,
      ),
    });
    const first = get().pages[0];
    if (first?.id === id) {
      await runQueue("proof");
      return;
    }
    if (first?.status !== "done") {
      toast.error("Proof the first page before restyling the rest");
      return;
    }
    await runQueue("remaining");
  },

  removePage: (id) => {
    const { pages, run } = get();
    if (run === "proof" || run === "remaining") {
      toast.error("Pause before removing a page");
      return;
    }
    const target = pages.find((page) => page.id === id);
    if (!target || target.status === "restyling") return;
    const urls = [target.croppedUrl, ...(target.restyleUrl ? [target.restyleUrl] : [])];
    set({ pages: pages.filter((page) => page.id !== id) });
    revokeLater(urls);
    enqueuePersist(() => get());
  },

  startOver: () => {
    epoch += 1;
    stopRequested = true;
    const { house, pages } = get();
    const urls = collectUrls(house, pages);
    set({
      house: null,
      pages: [],
      run: "idle",
      hydrating: false,
      preparing: 0,
      preparingTotal: 0,
      restyleStartedAt: null,
    });
    revokeLater(urls);
    enqueuePersist(() => get());
  },
}));
