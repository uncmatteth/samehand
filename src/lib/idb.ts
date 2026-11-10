const DB_NAME = "samehand";
const DB_VERSION = 1;

export type PageStatus = "queued" | "restyling" | "done" | "failed";
export type RunMode = "idle" | "proof" | "remaining" | "paused";
export type RestyleMode = "artist" | "place" | "artifact";

export type PageRecord = {
  id: string;
  name: string;
  order: number;
  croppedBlob: Blob;
  restyleBlob: Blob | null;
  status: PageStatus;
  error: string | null;
};

export type HouseRecord = {
  name: string;
  blob: Blob;
};

export type MetaRecord = {
  run: RunMode;
  restyleMode: RestyleMode;
};

export type SessionSnapshot = {
  house: HouseRecord | null;
  pages: PageRecord[];
  meta: MetaRecord;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv");
      }
      if (!db.objectStoreNames.contains("pages")) {
        db.createObjectStore("pages", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("Could not open studio storage"));
  });
}

function readRestyleMode(value: unknown): RestyleMode {
  if (value === "place" || value === "artifact") return value;
  return "artist";
}

function reqAs<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Storage failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Storage failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Storage aborted"));
  });
}

export async function loadSession(): Promise<SessionSnapshot> {
  const db = await openDb();
  try {
    const tx = db.transaction(["kv", "pages"], "readonly");
    const kv = tx.objectStore("kv");
    const pagesStore = tx.objectStore("pages");
    const [house, meta, pages] = await Promise.all([
      reqAs<HouseRecord | undefined>(kv.get("house")),
      reqAs<MetaRecord | undefined>(kv.get("meta")),
      reqAs<PageRecord[]>(pagesStore.getAll()),
    ]);
    await txDone(tx);
    const sorted = [...pages].sort((a, b) => a.order - b.order);
    const recovered = sorted.map((page) =>
      page.status === "restyling"
        ? { ...page, status: "queued" as const, error: null }
        : page,
    );
    return {
      house: house ?? null,
      pages: recovered,
      meta: {
        run: "idle",
        restyleMode: readRestyleMode(meta?.restyleMode),
      },
    };
  } finally {
    db.close();
  }
}

export async function writeSession(snap: SessionSnapshot): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(["kv", "pages"], "readwrite");
    const kv = tx.objectStore("kv");
    const pagesStore = tx.objectStore("pages");
    pagesStore.clear();
    if (snap.house) kv.put(snap.house, "house");
    else kv.delete("house");
    kv.put(
      {
        run: snap.meta.run === "paused" ? "paused" : "idle",
        restyleMode: readRestyleMode(snap.meta.restyleMode),
      },
      "meta",
    );
    for (const page of snap.pages) {
      pagesStore.put(page);
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}
