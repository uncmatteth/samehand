import { createServerFn } from "@tanstack/react-start";
import { promptForEnsemble, type EnsembleKind } from "@/lib/style-bible";

const TIMEOUT_MS = 180_000;

export type ComposeResult =
  | { ok: true; dataUrl: string }
  | { ok: false; error: string };

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function isTimeout(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "TimeoutError" || name === "AbortError";
}

async function callEdits(
  apiKey: string,
  imageDataUrl: string,
  prompt: string,
  aspectRatio: "1:1" | "16:9",
): Promise<Response> {
  return fetch("https://api.x.ai/v1/images/edits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-imagine-image-2.0",
      prompt,
      image: { url: imageDataUrl, type: "image_url" },
      aspect_ratio: aspectRatio,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export const composeEnsemble = createServerFn({ method: "POST" })
  .validator(
    (input: {
      imageDataUrl: string;
      kind?: EnsembleKind;
      count?: number;
    }) => {
      if (!input || typeof input.imageDataUrl !== "string") {
        throw new Error("imageDataUrl required");
      }
      if (!input.imageDataUrl.startsWith("data:image/")) {
        throw new Error("Expected a data URL");
      }
      if (input.imageDataUrl.length > 10_000_000) {
        throw new Error("Image is too large to compose");
      }
      const kind: EnsembleKind =
        input.kind === "section" || input.kind === "poster"
          ? input.kind
          : "group";
      const count =
        typeof input.count === "number" && input.count >= 2 && input.count <= 5
          ? Math.floor(input.count)
          : 3;
      return { imageDataUrl: input.imageDataUrl, kind, count };
    },
  )
  .handler(async ({ data }): Promise<ComposeResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "AI is not available in this environment" };
    }
    const prompt = promptForEnsemble(data.kind, data.count);
    const aspectRatio = data.kind === "poster" ? "16:9" : "1:1";

    try {
      let res: Response;
      try {
        res = await callEdits(apiKey, data.imageDataUrl, prompt, aspectRatio);
      } catch (err) {
        if (isTimeout(err)) {
          return { ok: false, error: "Compose timed out. Redo this plate only." };
        }
        throw err;
      }

      if (!res.ok && res.status >= 500) {
        try {
          res = await callEdits(apiKey, data.imageDataUrl, prompt, aspectRatio);
        } catch (err) {
          if (isTimeout(err)) {
            return { ok: false, error: "Compose timed out. Redo this plate only." };
          }
          throw err;
        }
      }

      if (!res.ok) {
        let payload: unknown = null;
        try {
          payload = await res.json();
        } catch {
          payload = null;
        }
        return {
          ok: false,
          error: readErrorMessage(payload, `Compose failed (${res.status})`),
        };
      }

      const json = (await res.json()) as {
        data?: Array<{ url?: string; b64_json?: string }>;
      };
      const first = json.data?.[0];
      if (first?.b64_json) {
        return { ok: true, dataUrl: `data:image/jpeg;base64,${first.b64_json}` };
      }
      if (first?.url) {
        const imgRes = await fetch(first.url, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!imgRes.ok) {
          return { ok: false, error: "Could not fetch compose result" };
        }
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const mime = imgRes.headers.get("content-type") || "image/jpeg";
        return {
          ok: true,
          dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
        };
      }
      return { ok: false, error: "Empty compose response" };
    } catch (err) {
      if (isTimeout(err)) {
        return { ok: false, error: "Compose timed out. Redo this plate only." };
      }
      const message = err instanceof Error ? err.message : "Compose failed";
      return { ok: false, error: message };
    }
  });
