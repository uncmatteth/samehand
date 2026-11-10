const DB_NAME = "samehand-ensemble";
const DB_VERSION = 1;

export type EnsembleKind = "group" | "section" | "poster";
export type PlateStatus = "idle" | "composing" | "done" | "failed";

export type RosterRecord = {
  id: string;
  name: string;
  order: number;
  blob: Blob;
};

export type PlateRecord = {
  id: string;
  name: string;
  kind: EnsembleKind;
  order: number;
  memberIds: string[];
  blob: Blob | null;
  status: PlateStatus;
  error: string | null;
};

export type EnsembleSnapshot = {
  roster: RosterRecord[];
  plates: PlateRecord[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("roster")) {
        db.createObjectStore("roster", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("plates")) {
        db.createObjectStore("plates", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("Could not open ensemble storage"));
  });
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

export async function loadEnsemble(): Promise<EnsembleSnapshot> {
  const db = await openDb();
  try {
    const tx = db.transaction(["roster", "plates"], "readonly");
    const [roster, plates] = await Promise.all([
      reqAs<RosterRecord[]>(tx.objectStore("roster").getAll()),
      reqAs<PlateRecord[]>(tx.objectStore("plates").getAll()),
    ]);
    await txDone(tx);
    const recovered = plates.map((p) =>
      p.status === "composing"
        ? { ...p, status: "failed" as const, error: "Compose interrupted. Redo this plate." }
        : p,
    );
    return {
      roster: [...roster].sort((a, b) => a.order - b.order),
      plates: [...recovered].sort((a, b) => a.order - b.order),
    };
  } finally {
    db.close();
  }
}

export async function writeEnsemble(snap: EnsembleSnapshot): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(["roster", "plates"], "readwrite");
    const rosterStore = tx.objectStore("roster");
    const platesStore = tx.objectStore("plates");
    rosterStore.clear();
    platesStore.clear();
    for (const r of snap.roster) rosterStore.put(r);
    for (const p of snap.plates) {
      platesStore.put({
        ...p,
        status: p.status === "composing" ? "failed" : p.status,
      });
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}
