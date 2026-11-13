import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { CastPanel } from "@/components/studio/cast-panel";
import { DropZone } from "@/components/studio/drop-zone";
import { HousePlate } from "@/components/studio/house-plate";
import { PageCard } from "@/components/studio/page-card";
import { StudioToolbar } from "@/components/studio/studio-toolbar";
import { Button } from "@/components/ui/button";
import { useCast } from "@/lib/cast-store";
import { checkAiAvailable } from "@/lib/restyle";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

type Step = "cast" | "episode";

export function StudioApp() {
  const hydrate = useStudio((s) => s.hydrate);
  const hydrateCast = useCast((s) => s.hydrate);
  const hydrating = useStudio((s) => s.hydrating);
  const house = useStudio((s) => s.house);
  const pages = useStudio((s) => s.pages);
  const addPages = useStudio((s) => s.addPages);
  const members = useCast((s) => s.members);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [step, setStep] = useState<Step>("cast");

  useEffect(() => {
    void hydrate();
    void hydrateCast();
  }, [hydrate, hydrateCast]);

  useEffect(() => {
    void checkAiAvailable().then((res) => setAiAvailable(res.available));
  }, []);

  const castNeed = members.filter((m) => m.tier !== "C" && m.sourceBlob);
  const castDone = castNeed.filter((m) => m.normStatus === "done").length;
  const castReady = castNeed.length > 0 && castDone >= castNeed.length;

  return (
    <div className="min-h-dvh">
      <Toaster position="top-center" richColors={false} />
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg flex-col gap-3 px-5 py-4">
          <div>
            <h1 className="font-display text-2xl font-medium leading-snug tracking-display">
              Draw Me Like One of Your French Girls Uncle Matt
            </h1>
            <p className="mt-1 text-sm text-muted">
              Two steps only. Characters first, then episode pictures.
            </p>
          </div>
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-fog p-1 shadow-[var(--shadow-border)]"
            role="tablist"
          >
            <Button
              type="button"
              role="tab"
              aria-selected={step === "cast"}
              variant={step === "cast" ? "default" : "ghost"}
              className={cn(
                "min-h-12 text-base",
                step !== "cast" && "shadow-none text-ink",
              )}
              onClick={() => setStep("cast")}
            >
              1 · Characters
              {castReady ? " ✓" : ""}
            </Button>
            <Button
              type="button"
              role="tab"
              aria-selected={step === "episode"}
              variant={step === "episode" ? "default" : "ghost"}
              className={cn(
                "min-h-12 text-base",
                step !== "episode" && "shadow-none text-ink",
              )}
              onClick={() => setStep("episode")}
            >
              2 · Episode
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-5 py-6">
        {step === "cast" ? (
          <CastPanel
            onReadyForEpisode={() => setStep("episode")}
          />
        ) : (
          <section className="flex flex-col gap-5">
            {!castReady ? (
              <div className="rounded-xl bg-paper-2 px-4 py-4 text-sm shadow-[var(--shadow-border)]">
                <p className="font-medium">Finish characters first</p>
                <p className="mt-1 text-muted">
                  Go back to <strong>1 · Characters</strong> and hit the big
                  green button until everyone is Ready.
                </p>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  onClick={() => setStep("cast")}
                >
                  Back to characters
                </Button>
              </div>
            ) : null}

            <div className="rounded-xl bg-paper-2 p-4 shadow-[var(--shadow-border)]">
              <p className="text-xs uppercase tracking-wide text-ink-soft">
                Episode pictures
              </p>
              <h2 className="mt-1 font-display text-xl tracking-display">
                Your 167 photos
              </h2>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
                <li>Lock the house look (one button)</li>
                <li>Drop your photos — blurry or rough is fine</li>
                <li>Press Proof 1 — check that one</li>
                <li>Press Restyle remaining</li>
                <li>Zip when done</li>
              </ol>
            </div>

            <HousePlate simple />

            {house ? (
              <>
                <StudioToolbar aiAvailable={aiAvailable} simple />
                <DropZone
                  label="Drop your episode photos here"
                  hint="Blurry, small, or rough is fine. The restyle finishes them."
                  multiple
                  className="min-h-32 rounded-xl bg-paper-2 px-5 py-8 shadow-[var(--shadow-border)]"
                  onFiles={(files) => void addPages(files)}
                />
                {hydrating ? (
                  <p className="text-sm text-muted">Loading…</p>
                ) : pages.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {pages.map((page) => (
                      <PageCard key={page.id} page={page} />
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-center text-sm text-muted">
                Press Lock house above first.
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
