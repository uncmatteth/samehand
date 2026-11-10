const DB_NAME = "samehand-cast";
const DB_VERSION = 2;

export type CastTier = "A" | "B" | "C";
export type NormStatus = "raw" | "queued" | "running" | "done" | "failed";

export type CastRecord = {
  id: string;
  name: string;
  tier: CastTier;
  costumeNotes: string;
  notes: string;
  e01: boolean;
  order: number;
  /** Original root still (never overwritten by normalize) */
  sourceBlob: Blob | null;
  /** Normalized Living Worlds root — used as active identity after done */
  normBlob: Blob | null;
  normStatus: NormStatus;
  normError: string | null;
};

export type CastSnapshot = {
  members: CastRecord[];
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("members")) {
        db.createObjectStore("members", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(req.error ?? new Error("Could not open cast storage"));
  });
}

function reqAs<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Cast storage failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Cast storage failed"));
    tx.onabort = () => reject(tx.error ?? new Error("Cast storage aborted"));
  });
}

function migrateRecord(raw: Record<string, unknown>): CastRecord {
  const oldBlob = (raw.blob as Blob | null | undefined) ?? null;
  const sourceBlob =
    (raw.sourceBlob as Blob | null | undefined) ?? oldBlob ?? null;
  const normBlob = (raw.normBlob as Blob | null | undefined) ?? null;
  let normStatus = raw.normStatus as string | undefined;
  if (normStatus === "restyling") normStatus = "running";
  if (
    normStatus !== "raw" &&
    normStatus !== "queued" &&
    normStatus !== "running" &&
    normStatus !== "done" &&
    normStatus !== "failed"
  ) {
    normStatus = normBlob ? "done" : sourceBlob ? "raw" : "raw";
  }
  return {
    id: String(raw.id),
    name: String(raw.name ?? "Unnamed"),
    tier: raw.tier === "A" || raw.tier === "C" ? raw.tier : "B",
    costumeNotes: String(raw.costumeNotes ?? ""),
    notes: String(raw.notes ?? ""),
    e01: Boolean(raw.e01),
    order: Number(raw.order) || 0,
    sourceBlob,
    normBlob,
    normStatus: normStatus as NormStatus,
    normError:
      typeof raw.normError === "string" ? raw.normError : null,
  };
}

export async function loadCast(): Promise<CastSnapshot> {
  const db = await openDb();
  try {
    const tx = db.transaction(["members"], "readonly");
    const raw = await reqAs<Record<string, unknown>[]>(
      tx.objectStore("members").getAll(),
    );
    await txDone(tx);
    const members = raw
      .map(migrateRecord)
      .map((m) =>
        m.normStatus === "running"
          ? {
              ...m,
              normStatus: "queued" as const,
              normError: null,
            }
          : m,
      )
      .sort((a, b) => a.order - b.order);
    return { members };
  } finally {
    db.close();
  }
}

export async function writeCast(snap: CastSnapshot): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(["members"], "readwrite");
    const store = tx.objectStore("members");
    store.clear();
    for (const member of snap.members) {
      store.put({
        ...member,
        normStatus:
          member.normStatus === "running" ? "queued" : member.normStatus,
      });
    }
    await txDone(tx);
  } finally {
    db.close();
  }
}
