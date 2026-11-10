import { createServerFn } from "@tanstack/react-start";
import {
  promptForMode,
  promptForNormalize,
  type RestyleMode,
} from "@/lib/style-bible";

const RESTYLE_TIMEOUT_MS = 180_000;

export const checkAiAvailable = createServerFn({ method: "GET" }).handler(
  async () => ({ available: Boolean(process.env.XAI_API_KEY) }),
);

export type RestyleResult =
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
      aspect_ratio: "1:1",
    }),
    signal: AbortSignal.timeout(RESTYLE_TIMEOUT_MS),
  });
}

export const restylePage = createServerFn({ method: "POST" })
  .validator((input: {
    imageDataUrl: string;
    mode?: RestyleMode;
    castLock?: string;
  }) => {
    if (!input || typeof input.imageDataUrl !== "string") {
      throw new Error("imageDataUrl required");
    }
    if (!input.imageDataUrl.startsWith("data:image/")) {
      throw new Error("Expected a data URL");
    }
    if (input.imageDataUrl.length > 8_000_000) {
      throw new Error("Image is too large to restyle");
    }
    const mode: RestyleMode =
      input.mode === "place" || input.mode === "artifact" ? input.mode : "artist";
    const castLock =
      typeof input.castLock === "string" && input.castLock.length < 12_000
        ? input.castLock
        : "";
    return { imageDataUrl: input.imageDataUrl, mode, castLock };
  })
  .handler(async ({ data }): Promise<RestyleResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "AI is not available in this environment" };
    }
    const prompt = promptForMode(data.mode, data.castLock);

    try {
      let res: Response;
      try {
        res = await callEdits(apiKey, data.imageDataUrl, prompt);
      } catch (err) {
        if (isTimeout(err)) {
          return {
            ok: false,
            error: "Restyle timed out. Tap Redo on that card only.",
          };
        }
        throw err;
      }

      if (!res.ok && res.status >= 500) {
        try {
          res = await callEdits(apiKey, data.imageDataUrl, prompt);
        } catch (err) {
          if (isTimeout(err)) {
            return {
              ok: false,
              error: "Restyle timed out. Tap Redo on that card only.",
            };
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
          error: readErrorMessage(payload, `Restyle failed (${res.status})`),
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
          return { ok: false, error: "Could not fetch restyle" };
        }
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const mime = imgRes.headers.get("content-type") || "image/jpeg";
        return {
          ok: true,
          dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
        };
      }
      return { ok: false, error: "Empty restyle response" };
    } catch (err) {
      if (isTimeout(err)) {
        return {
          ok: false,
          error: "Restyle timed out. Tap Redo on that card only.",
        };
      }
      const message = err instanceof Error ? err.message : "Restyle failed";
      return { ok: false, error: message };
    }
  });


export const normalizeCastRoot = createServerFn({ method: "POST" })
  .validator((input: {
    imageDataUrl: string;
    name: string;
    costumeNotes?: string;
    tier?: string;
    isArtifact?: boolean;
  }) => {
    if (!input || typeof input.imageDataUrl !== "string") {
      throw new Error("imageDataUrl required");
    }
    if (!input.imageDataUrl.startsWith("data:image/")) {
      throw new Error("Expected a data URL");
    }
    if (input.imageDataUrl.length > 8_000_000) {
      throw new Error("Image is too large to normalize");
    }
    const name =
      typeof input.name === "string" && input.name.trim()
        ? input.name.trim().slice(0, 80)
        : "Character";
    const costumeNotes =
      typeof input.costumeNotes === "string"
        ? input.costumeNotes.slice(0, 800)
        : "";
    const tier =
      input.tier === "A" || input.tier === "C" ? input.tier : "B";
    return {
      imageDataUrl: input.imageDataUrl,
      name,
      costumeNotes,
      tier,
      isArtifact: Boolean(input.isArtifact),
    };
  })
  .handler(async ({ data }): Promise<RestyleResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "AI is not available in this environment" };
    }
    const prompt = promptForNormalize({
      name: data.name,
      costumeNotes: data.costumeNotes,
      tier: data.tier,
      isArtifact: data.isArtifact,
    });

    try {
      let res: Response;
      try {
        res = await callEdits(apiKey, data.imageDataUrl, prompt);
      } catch (err) {
        if (isTimeout(err)) {
          return {
            ok: false,
            error: "Normalize timed out. Tap Redo on that card only.",
          };
        }
        throw err;
      }

      if (!res.ok && res.status >= 500) {
        try {
          res = await callEdits(apiKey, data.imageDataUrl, prompt);
        } catch (err) {
          if (isTimeout(err)) {
            return {
              ok: false,
              error: "Normalize timed out. Tap Redo on that card only.",
            };
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
          error: readErrorMessage(payload, `Normalize failed (${res.status})`),
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
          return { ok: false, error: "Could not fetch normalize result" };
        }
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const mime = imgRes.headers.get("content-type") || "image/jpeg";
        return {
          ok: true,
          dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
        };
      }
      return { ok: false, error: "Empty normalize response" };
    } catch (err) {
      if (isTimeout(err)) {
        return {
          ok: false,
          error: "Normalize timed out. Tap Redo on that card only.",
        };
      }
      const message = err instanceof Error ? err.message : "Normalize failed";
      return { ok: false, error: message };
    }
  });
