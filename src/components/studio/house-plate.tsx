import { Lock, ImageIcon } from "lucide-react";
import { DropZone } from "@/components/studio/drop-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LIVING_WORLDS_HOUSE_URL } from "@/lib/living-worlds-template";
import { useStudio, type RestyleMode } from "@/lib/studio-store";
import { MODE_COPY } from "@/lib/style-bible";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function HousePlate({ simple = false }: { simple?: boolean }) {
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

  async function lockE01House() {
    try {
      const res = await fetch(LIVING_WORLDS_HOUSE_URL);
      if (!res.ok) throw new Error("Could not load house look");
      const blob = await res.blob();
      const file = new File([blob], "e01-house.png", {
        type: blob.type || "image/png",
      });
      await lockHouse(file);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not lock house";
      toast.error(message);
    }
  }

  if (simple) {
    return (
      <section className="flex flex-col gap-3">
        {house ? (
          <div className="flex items-center gap-3 rounded-xl bg-paper-2 p-3 shadow-[var(--shadow-border)]">
            <img
              src={house.url}
              alt=""
              className="size-16 rounded-md object-cover"
              draggable={false}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">House look locked</p>
              <p className="text-xs text-muted">Drop photos below next</p>
            </div>
            <Badge>
              <Lock className="mr-1 size-3" />
              On
            </Badge>
          </div>
        ) : (
          <Button
            type="button"
            className="min-h-14 w-full text-base"
            disabled={busy}
            onClick={() => void lockE01House()}
          >
            Lock house look
          </Button>
        )}
        {house && !lockedHard ? (
          <button
            type="button"
            className="text-xs text-muted underline"
            onClick={() => void lockE01House()}
          >
            Use a different house photo…
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-medium tracking-display">
          House look
        </h2>
        {house ? (
          <Badge>
            <Lock className="mr-1 size-3" strokeWidth={2} />
            Locked
          </Badge>
        ) : (
          <Badge variant="muted">Needed</Badge>
        )}
      </div>

      {house ? (
        <div className="rounded-xl bg-paper-2 p-3 shadow-[var(--shadow-border)]">
          <div className="relative aspect-square overflow-hidden rounded-md bg-fog">
            <img
              src={house.url}
              alt="House look"
              className="size-full object-cover outline outline-1 -outline-offset-1 outline-ink/10"
              draggable={false}
            />
          </div>
          <div
            className="mt-3 grid grid-cols-1 gap-1 rounded-md bg-paper p-1 shadow-[var(--shadow-border)]"
            role="group"
            aria-label="Restyle mode"
          >
            {(["artist", "place", "artifact"] as const).map(
              (mode: RestyleMode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={restyleMode === mode ? "default" : "ghost"}
                  className={cn(
                    "min-h-11 px-2",
                    restyleMode !== mode && "shadow-none",
                  )}
                  disabled={busy}
                  aria-pressed={restyleMode === mode}
                  onClick={() => setRestyleMode(mode)}
                >
                  {MODE_COPY[mode].label}
                </Button>
              ),
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            className="min-h-14 w-full"
            disabled={busy}
            onClick={() => void lockE01House()}
          >
            Lock house look
          </Button>
          <DropZone
            label="Or drop a house photo"
            hint="One world plate for this episode"
            className="min-h-32 rounded-xl bg-paper-2 px-5 py-8 shadow-[var(--shadow-border)]"
            onFiles={(files) => {
              const file = files[0];
              if (file) void lockHouse(file);
            }}
          >
            <ImageIcon className="mb-3 size-6 text-olive" strokeWidth={1.5} />
          </DropZone>
        </div>
      )}
    </section>
  );
}
