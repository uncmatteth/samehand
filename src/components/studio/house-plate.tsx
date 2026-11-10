import { Lock, ImageIcon } from "lucide-react";
import { DropZone } from "@/components/studio/drop-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HOUSE_LOOK_NAME, MODE_COPY, STYLE_PALETTE } from "@/lib/style-bible";
import { LIVING_WORLDS_HOUSE_URL } from "@/lib/living-worlds-template";
import { useStudio, type RestyleMode } from "@/lib/studio-store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function HousePlate() {
  const house = useStudio((s) => s.house);
  const pages = useStudio((s) => s.pages);
  const run = useStudio((s) => s.run);
  const restyleMode = useStudio((s) => s.restyleMode);
  const lockHouse = useStudio((s) => s.lockHouse);
  const setRestyleMode = useStudio((s) => s.setRestyleMode);
  const lockedHard = pages.some(
    (page) => page.status === "done" || page.status === "restyling",
  );
  const busy = run === "proof" || run === "remaining";
  const copy = MODE_COPY[restyleMode];

  async function lockE01House() {
    try {
      const res = await fetch(LIVING_WORLDS_HOUSE_URL);
      if (!res.ok) throw new Error("Could not load E01 house plate");
      const blob = await res.blob();
      const file = new File([blob], "e01-house.png", {
        type: blob.type || "image/png",
      });
      await lockHouse(file);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not lock E01 house";
      toast.error(message);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-medium tracking-display">House look</h2>
        {house ? (
          <Badge>
            <Lock className="mr-1 size-3" strokeWidth={2} />
            Locked
          </Badge>
        ) : (
          <Badge variant="muted">Drop first</Badge>
        )}
      </div>

      {house ? (
        <div className="rounded-xl bg-paper-2 p-3 shadow-[var(--shadow-border)]">
          <div className="relative aspect-square overflow-hidden rounded-md bg-fog">
            <img
              src={house.url}
              alt="Locked house look"
              className="size-full object-cover outline outline-1 -outline-offset-1 outline-ink/10"
              draggable={false}
            />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <p className="font-display text-base font-medium tracking-display">
              {HOUSE_LOOK_NAME}
            </p>
            <p className="text-sm text-muted">{copy.summary}</p>
            <p className="text-xs tracking-wide text-ink-soft uppercase">{STYLE_PALETTE}</p>
          </div>
          <div
            className="mt-3 grid grid-cols-1 gap-1 rounded-md bg-paper p-1 shadow-[var(--shadow-border)]"
            role="group"
            aria-label="Restyle mode"
          >
            {(["artist", "place", "artifact"] as const).map((mode: RestyleMode) => (
              <Button
                key={mode}
                type="button"
                variant={restyleMode === mode ? "default" : "ghost"}
                className={cn("min-h-11 px-2", restyleMode !== mode && "shadow-none")}
                disabled={busy}
                aria-pressed={restyleMode === mode}
                onClick={() => setRestyleMode(mode)}
              >
                {MODE_COPY[mode].label}
              </Button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Switching mode does not restyle. Redo a card to apply. The place in
            the picture stays — whatever it is.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            className="min-h-14 w-full"
            disabled={busy}
            onClick={() => void lockE01House()}
          >
            Lock E01 house (one click)
          </Button>
          <DropZone
            label="Or drop another house look"
            hint="E01 world plate. Craft from Living Worlds bible; identities from Cast Bible."
            className="min-h-40 rounded-xl bg-paper-2 px-5 py-8 shadow-[var(--shadow-border)]"
            onFiles={(files) => {
              const file = files[0];
              if (file) void lockHouse(file);
            }}
          >
            <ImageIcon className="mb-3 size-6 text-olive" strokeWidth={1.5} />
          </DropZone>
        </div>
      )}

      {house && !lockedHard ? (
        <DropZone
          label="Replace house"
          hint="Available until the first restyle."
          className="min-h-11 py-3"
          onFiles={(files) => {
            const file = files[0];
            if (file) void lockHouse(file);
          }}
        />
      ) : null}
    </section>
  );
}
