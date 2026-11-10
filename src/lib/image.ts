const CROP_SIZE = 1280;
const JPEG_QUALITY = 0.9;

export function isImageFile(file: File): boolean {
  return /image\/(jpeg|jpg|png|webp)/i.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function yieldTick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image"));
    };
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

async function decodeBitmap(source: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(source);
  } catch {
    const url = URL.createObjectURL(source);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not decode image"));
        el.src = url;
      });
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function centerCropToSquare(file: Blob, size = CROP_SIZE): Promise<Blob> {
  const bitmap = await decodeBitmap(file);
  const w = "width" in bitmap ? bitmap.width : 0;
  const h = "height" in bitmap ? bitmap.height : 0;
  if (!w || !h) throw new Error("Image has no size");
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = (h - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop image");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (next) resolve(next);
        else reject(new Error("Could not encode image"));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
  return blob;
}

export async function saveBlob(blob: Blob, filename: string): Promise<boolean> {
  const picker = (
    window as Window & {
      showSaveFilePicker?: (opts: {
        suggestedName: string;
        types: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<{ createWritable: () => Promise<FileSystemWritableFileStream> }>;
    }
  ).showSaveFilePicker;
  if (typeof picker === "function") {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [
          {
            description: "Image",
            accept: { "image/jpeg": [".jpg"], "application/zip": [".zip"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4_000);
  return true;
}

export function restyleFilename(name: string, order: number): string {
  const base = name.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_");
  const idx = String(order).padStart(2, "0");
  return `restyle-${idx}-${base || "page"}.jpg`;
}
