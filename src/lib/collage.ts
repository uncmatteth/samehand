import { yieldTick } from "@/lib/image";

const SIZE = 1280;
const JPEG_Q = 0.9;

async function decode(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(blob);
  } catch {
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not decode image"));
        el.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function layout(n: number): { cols: number; rows: number } {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n === 3) return { cols: 3, rows: 1 };
  if (n === 4) return { cols: 2, rows: 2 };
  return { cols: 3, rows: 2 };
}

/** Build a locked identity sheet — every face stays pixel-true for the compose pass. */
export async function buildIdentityCollage(blobs: Blob[]): Promise<Blob> {
  if (blobs.length < 2 || blobs.length > 5) {
    throw new Error("Pick 2 to 5 characters or plates");
  }
  const bitmaps = [];
  for (const blob of blobs) {
    bitmaps.push(await decode(blob));
    await yieldTick();
  }
  const { cols, rows } = layout(blobs.length);
  const cellW = Math.floor(SIZE / cols);
  const cellH = Math.floor(SIZE / rows);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not build collage");
  ctx.fillStyle = "#ebe1cc";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  for (let i = 0; i < bitmaps.length; i += 1) {
    const bmp = bitmaps[i];
    const w = "width" in bmp ? bmp.width : 0;
    const h = "height" in bmp ? bmp.height : 0;
    if (!w || !h) continue;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const side = Math.min(w, h);
    const sx = (w - side) / 2;
    const sy = (h - side) / 2;
    const dx = col * cellW;
    const dy = row * cellH;
    ctx.drawImage(bmp, sx, sy, side, side, dx, dy, cellW, cellH);
    if ("close" in bmp && typeof bmp.close === "function") bmp.close();
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not encode collage"));
      },
      "image/jpeg",
      JPEG_Q,
    );
  });
}
