import { useEffect } from "react";
import {
  Download,
  Layers,
  RotateCcw,
  Trash2,
  Users,
} from "lucide-react";
import { DropZone } from "@/components/studio/drop-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEnsemble } from "@/lib/ensemble-store";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

export function EnsemblePanel({ aiAvailable }: { aiAvailable: boolean }) {
  const hydrate = useEnsemble((s) => s.hydrate);
  const hydrating = useEnsemble((s) => s.hydrating);
  const roster = useEnsemble((s) => s.roster);
  const plates = useEnsemble((s) => s.plates);
  const selectedIds = useEnsemble((s) => s.selectedIds);
  const composing = useEnsemble((s) => s.composing);
  const addToRoster = useEnsemble((s) => s.addToRoster);
  const addBlobsToRoster = useEnsemble((s) => s.addBlobsToRoster);
  const removeFromRoster = useEnsemble((s) => s.removeFromRoster);
  const toggleSelect = useEnsemble((s) => s.toggleSelect);
  const clearSelection = useEnsemble((s) => s.clearSelection);
  const composeSelection = useEnsemble((s) => s.composeSelection);
  const redoPlate = useEnsemble((s) => s.redoPlate);
  const removePlate = useEnsemble((s) => s.removePlate);
  const clearEnsemble = useEnsemble((s) => s.clearEnsemble);

  const pages = useStudio((s) => s.pages);
  const doneFinals = pages.filter((p) => p.status === "done" && p.restyleBlob);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const selectedCount = selectedIds.length;
  const canGroup =
    selectedCount >= 2 &&
    selectedCount <= 5 &&
    selectedIds.every((id) => roster.some((r) => r.id === id));
  const canSection =
    selectedCount >= 2 &&
    selectedCount <= 5 &&
    selectedIds.every((id) =>
      plates.some((p) => p.id === id && p.status === "done" && p.kind === "group"),
    );
  const canPoster =
    selectedCount >= 2 &&
    selectedCount <= 5 &&
    selectedIds.every((id) =>
      plates.some(
        (p) =>
          p.id === id &&
          p.status === "done" &&
          (p.kind === "group" || p.kind === "section"),
      ),
    );

  return (
    <section className="flex min-w-0 flex-col gap-5">
      <div className="rounded-xl bg-paper-2 p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 size-5 shrink-0 text-olive" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-medium tracking-display">
              Ensemble tree
            </p>
            <p className="mt-1 text-sm text-muted">
              Never dump all 125 at once. Roster → groups of 2–5 → sections →
              one poster. Each pass freezes who is already approved.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canGroup || composing || !aiAvailable}
            onClick={() => void composeSelection("group")}
          >
            <Layers />
            Compose group
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!canSection || composing || !aiAvailable}
            onClick={() => void composeSelection("section")}
          >
            Compose section
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!canPoster || composing || !aiAvailable}
            onClick={() => void composeSelection("poster")}
          >
            Compose poster
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={selectedCount === 0 || composing}
            onClick={clearSelection}
          >
            Clear pick
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={(roster.length === 0 && plates.length === 0) || composing}
            onClick={clearEnsemble}
          >
            <Trash2 />
            Clear all
          </Button>
        </div>
        <p className="mt-2 tabular-nums text-xs text-ink-soft">
          {selectedCount}/5 selected
          {composing ? " · Composing…" : ""}
        </p>
        {!aiAvailable ? (
          <p className="mt-2 text-sm text-umber">AI is not available in this environment.</p>
        ) : null}
      </div>

      {hydrating ? (
        <p className="text-sm text-muted">Restoring ensemble…</p>
      ) : (
        <>
          <DropZone
            label="Drop characters onto the roster"
            hint="Finals from Pages, or any locked character stills. Batch as many as you need."
            multiple
            className="min-h-28 rounded-xl bg-paper-2 px-5 py-8 shadow-[var(--shadow-border)]"
            onFiles={(files) => void addToRoster(files)}
          />

          {doneFinals.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="self-start"
              disabled={composing}
              onClick={() =>
                void addBlobsToRoster(
                  doneFinals.map((p) => ({
                    name: p.name,
                    blob: p.restyleBlob as Blob,
                  })),
                )
              }
            >
              Pull {doneFinals.length} restyle final
              {doneFinals.length === 1 ? "" : "s"} into roster
            </Button>
          ) : null}

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="font-display text-lg tracking-display">Roster</h3>
              <span className="tabular-nums text-xs text-muted">
                {roster.length} character{roster.length === 1 ? "" : "s"}
              </span>
            </div>
            {roster.length === 0 ? (
              <p className="text-sm text-muted">
                Empty. Drop locked character stills, or pull restyle finals.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {roster.map((member) => {
                  const on = selectedIds.includes(member.id);
                  return (
                    <div
                      key={member.id}
                      className={cn(
                        "relative overflow-hidden rounded-lg bg-paper shadow-[var(--shadow-border)]",
                        on && "ring-2 ring-moss",
                      )}
                    >
                      <button
                        type="button"
                        className="aspect-square w-full"
                        onClick={() => toggleSelect(member.id)}
                        disabled={composing}
                        aria-pressed={on}
                        aria-label={member.name}
                      >
                        <img
                          src={member.url}
                          alt=""
                          className="size-full object-cover outline outline-1 -outline-offset-1 outline-ink/10"
                          draggable={false}
                        />
                      </button>
                      <div className="flex items-center gap-1 px-1.5 py-1">
                        <span className="min-w-0 flex-1 truncate text-[10px] text-muted">
                          {member.name}
                        </span>
                        <button
                          type="button"
                          className="flex size-8 items-center justify-center rounded text-ink-soft hover:bg-fog"
                          aria-label="Remove from roster"
                          disabled={composing}
                          onClick={() => removeFromRoster(member.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="font-display text-lg tracking-display">Plates</h3>
              <span className="tabular-nums text-xs text-muted">
                {plates.length} plate{plates.length === 1 ? "" : "s"}
              </span>
            </div>
            {plates.length === 0 ? (
              <p className="text-sm text-muted">
                No plates yet. Select 2–5 roster cards → Compose group.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {plates.map((plate) => {
                  const on = selectedIds.includes(plate.id);
                  const canPick = plate.status === "done";
                  return (
                    <article
                      key={plate.id}
                      className={cn(
                        "overflow-hidden rounded-xl bg-paper-2 shadow-[var(--shadow-border)]",
                        on && "ring-2 ring-moss",
                      )}
                    >
                      <button
                        type="button"
                        className={cn(
                          "relative w-full bg-fog",
                          plate.kind === "poster" ? "aspect-video" : "aspect-square",
                        )}
                        disabled={!canPick || composing}
                        onClick={() => canPick && toggleSelect(plate.id)}
                        aria-pressed={on}
                      >
                        {plate.url ? (
                          <img
                            src={plate.url}
                            alt=""
                            className="size-full object-cover outline outline-1 -outline-offset-1 outline-ink/10"
                            draggable={false}
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-sm text-muted">
                            {plate.status === "composing" ? "Composing…" : "No image"}
                          </div>
                        )}
                        {plate.status === "composing" ? (
                          <div className="absolute inset-0 flex items-center justify-center bg-ink/35">
                            <span className="text-sm font-medium text-moss-fg">
                              Composing…
                            </span>
                          </div>
                        ) : null}
                      </button>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <Badge
                          variant={
                            plate.status === "done"
                              ? "default"
                              : plate.status === "failed"
                                ? "outline"
                                : "muted"
                          }
                        >
                          {plate.kind}
                        </Badge>
                        <span className="min-w-0 flex-1 truncate text-xs text-muted">
                          {plate.name}
                        </span>
                        {plate.status === "done" && plate.url ? (
                          <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
                            <a
                              href={plate.url}
                              download={`${plate.kind}-${plate.order}.jpg`}
                              aria-label="Save plate"
                            >
                              <Download />
                            </a>
                          </Button>
                        ) : null}
                        {(plate.status === "done" || plate.status === "failed") && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-11 shrink-0"
                            disabled={composing}
                            onClick={() => void redoPlate(plate.id)}
                            aria-label="Redo plate"
                          >
                            <RotateCcw />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-11 shrink-0"
                          disabled={composing}
                          onClick={() => removePlate(plate.id)}
                          aria-label="Remove plate"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                      {plate.error ? (
                        <p className="px-3 pb-3 text-xs text-umber">{plate.error}</p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
