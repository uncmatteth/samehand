import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { CastPanel } from "@/components/studio/cast-panel";
import { DropZone } from "@/components/studio/drop-zone";
import { EnsemblePanel } from "@/components/studio/ensemble-panel";
import { HousePlate } from "@/components/studio/house-plate";
import { PageCard } from "@/components/studio/page-card";
import { StudioToolbar } from "@/components/studio/studio-toolbar";
import { Button } from "@/components/ui/button";
import { useCast } from "@/lib/cast-store";
import { checkAiAvailable } from "@/lib/restyle";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

type Workspace = "bible" | "pages" | "ensemble";

export function StudioApp() {
  const hydrate = useStudio((s) => s.hydrate);
  const hydrateCast = useCast((s) => s.hydrate);
  const hydrating = useStudio((s) => s.hydrating);
  const house = useStudio((s) => s.house);
  const pages = useStudio((s) => s.pages);
  const addPages = useStudio((s) => s.addPages);
  const castMembers = useCast((s) => s.members);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [workspace, setWorkspace] = useState<Workspace>("bible");

  useEffect(() => {
    void hydrate();
    void hydrateCast();
  }, [hydrate, hydrateCast]);

  useEffect(() => {
    void checkAiAvailable().then((res) => setAiAvailable(res.available));
  }, []);

  const aRooted = castMembers.filter((m) => m.tier === "A" && m.sourceBlob).length;
  const aTotal = castMembers.filter((m) => m.tier === "A").length;
  const aNormed = castMembers.filter((m) => m.tier === "A" && m.normStatus === "done").length;

  return (
    <div className="min-h-dvh">
      <Toaster position="top-center" richColors={false} />
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-4 sm:px-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-soft">Studio</p>
            <h1 className="font-display text-3xl font-medium tracking-display sm:text-4xl">
              Samehand
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Bible: load roots → normalize craft → then Pages (E01 house + 167
              stills). Cast survives Start over for the whole series.
            </p>
          </div>
          <div
            className="grid grid-cols-3 gap-1 rounded-lg bg-fog p-1 shadow-[var(--shadow-border)] sm:max-w-lg"
            role="tablist"
            aria-label="Workspace"
          >
            {(
              [
                ["bible", "Bible"],
                ["pages", "Pages"],
                ["ensemble", "Ensemble"],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                type="button"
                role="tab"
                aria-selected={workspace === id}
                variant={workspace === id ? "default" : "ghost"}
                className={cn(
                  "min-h-12 text-base font-medium",
                  workspace !== id && "shadow-none text-ink",
                )}
                onClick={() => setWorkspace(id)}
              >
                {label}
              </Button>
            ))}
          </div>
          {workspace === "bible" ? (
            <p className="text-xs text-olive">
              Load roots → Proof normalize 1 → Normalize remaining
              {aTotal ? ` · ${aNormed}/${aTotal} A normalized` : ""}.
            </p>
          ) : workspace === "pages" ? (
            <p className="text-xs text-olive">
              After bible is normalized: lock E01 house → drop 167 → Proof 1 →
              restyle. Cast lock rides with every restyle.
            </p>
          ) : (
            <p className="text-xs text-olive">
              Ensemble — roster → group (2–5) → section → poster.
            </p>
          )}
        </div>
      </header>

      <main
        className={cn(
          "mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:px-8",
          workspace === "pages" &&
            "lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]",
        )}
      >
        {workspace === "bible" ? (
          <CastPanel />
        ) : workspace === "pages" ? (
          <>
            <HousePlate />
            <section className="flex min-w-0 flex-col gap-5">
              <StudioToolbar aiAvailable={aiAvailable} />
              {hydrating ? (
                <p className="text-sm text-muted">Restoring studio…</p>
              ) : house ? (
                <>
                  <DropZone
                    label="Drop episode pages"
                    hint="E01 only for this pass. Center-cropped square, restyled once. Cast bible names ride in the prompt."
                    multiple
                    className="min-h-36 rounded-xl bg-paper-2 px-5 py-8 shadow-[var(--shadow-border)]"
                    onFiles={(files) => void addPages(files)}
                  />
                  {pages.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {pages.map((page) => (
                        <PageCard key={page.id} page={page} />
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rounded-xl bg-paper-2 px-5 py-16 text-center shadow-[var(--shadow-border)]">
                  <p className="font-display text-lg tracking-display">
                    Lock the house first
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Use your E01 world plate (craft + materials). Character
                    identity comes from the Bible tab, not the house face.
                  </p>
                </div>
              )}
            </section>
          </>
        ) : (
          <EnsemblePanel aiAvailable={aiAvailable} />
        )}
      </main>
    </div>
  );
}
