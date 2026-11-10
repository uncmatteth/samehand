import { useEffect, useRef, useState } from "react";
import {
  BookUser,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { DropZone } from "@/components/studio/drop-zone";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { checkAiAvailable } from "@/lib/restyle";
import { useCast, type CastTier } from "@/lib/cast-store";
import { cn } from "@/lib/utils";

const TIERS: CastTier[] = ["A", "B", "C"];

export function CastPanel() {
  const hydrate = useCast((s) => s.hydrate);
  const hydrating = useCast((s) => s.hydrating);
  const settingUp = useCast((s) => s.settingUp);
  const members = useCast((s) => s.members);
  const normRun = useCast((s) => s.normRun);
  const normStartedAt = useCast((s) => s.normStartedAt);
  const setupLivingWorlds = useCast((s) => s.setupLivingWorlds);
  const addMember = useCast((s) => s.addMember);
  const attachRoot = useCast((s) => s.attachRoot);
  const updateMember = useCast((s) => s.updateMember);
  const removeMember = useCast((s) => s.removeMember);
  const clearCast = useCast((s) => s.clearCast);
  const proofNormalize = useCast((s) => s.proofNormalize);
  const normalizeRemaining = useCast((s) => s.normalizeRemaining);
  const pauseNormalize = useCast((s) => s.pauseNormalize);
  const resumeNormalize = useCast((s) => s.resumeNormalize);
  const retryNormalizeFailed = useCast((s) => s.retryNormalizeFailed);
  const redoNormalize = useCast((s) => s.redoNormalize);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [aiAvailable, setAiAvailable] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    void checkAiAvailable().then((r) => setAiAvailable(r.available));
  }, []);

  useEffect(() => {
    if (!normStartedAt) {
      setElapsed(0);
      return;
    }
    const tick = () =>
      setElapsed(Math.floor((Date.now() - normStartedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [normStartedAt]);

  const normable = members.filter(
    (m) => m.sourceBlob && m.tier !== "C",
  );
  const aCount = members.filter((m) => m.tier === "A").length;
  const rooted = members.filter((m) => m.sourceBlob).length;
  const normDone = normable.filter((m) => m.normStatus === "done").length;
  const normFailed = normable.filter((m) => m.normStatus === "failed").length;
  const aMissing = members.filter((m) => m.tier === "A" && !m.sourceBlob).length;
  const busy = normRun === "proof" || normRun === "remaining";
  const active = members.find((m) => m.normStatus === "running");
  const canProof =
    normable.some(
      (m) =>
        m.normStatus === "raw" ||
        m.normStatus === "queued" ||
        m.normStatus === "failed",
    ) && !normable.every((m) => m.normStatus === "done");
  const canRemaining =
    normDone > 0 &&
    normable.some(
      (m) => m.normStatus === "raw" || m.normStatus === "queued",
    );

  return (
    <section className="flex min-w-0 flex-col gap-5">
      <div className="rounded-xl bg-paper-2 p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-start gap-3">
          <BookUser className="mt-0.5 size-5 shrink-0 text-olive" strokeWidth={1.5} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-medium tracking-display">
              Cast bible
            </p>
            <p className="mt-1 text-sm text-muted">
              1) One-click load roots · 2) <strong>Normalize</strong> every A/B
              root into the same Living Worlds craft · 3) Then restyle your 167
              pages. Bible survives Pages start-over.
            </p>
          </div>
        </div>

        <Button
          type="button"
          className="mt-4 min-h-14 w-full text-base sm:text-lg"
          disabled={settingUp || busy}
          onClick={() =>
            void setupLivingWorlds({
              force: members.length > 0,
            })
          }
        >
          <Sparkles className="size-5" />
          {settingUp
            ? "Setting up Living Worlds…"
            : members.length > 0
              ? "Reload Living Worlds roots"
              : "Set up Living Worlds (one click)"}
        </Button>

        <div className="mt-4 rounded-lg bg-paper p-3 shadow-[var(--shadow-border)]">
          <p className="font-display text-sm tracking-display">
            Normalize bible roots
          </p>
          <p className="mt-1 text-xs text-muted">
            Same craft on Mara, Kael, Tamsin, … before the 167 pages. Proof one
            first. Pause anytime. C rows skip (no face lock).
          </p>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-fog"
            role="progressbar"
            aria-valuenow={normDone}
            aria-valuemax={normable.length || 1}
          >
            <div
              className="h-full bg-moss transition-[width] duration-200"
              style={{
                width: normable.length
                  ? `${(normDone / normable.length) * 100}%`
                  : "0%",
              }}
            />
          </div>
          <p className="mt-2 tabular-nums text-xs text-ink-soft">
            {normDone} of {normable.length} normalized
            {busy && active
              ? ` · ${normRun === "proof" ? "Proofing" : "Normalizing"} ${active.name} · ${elapsed}s`
              : ""}
          </p>
          {!aiAvailable ? (
            <p className="mt-2 text-sm text-umber">
              AI is not available in this environment.
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void proofNormalize()}
              disabled={!canProof || busy || !aiAvailable || settingUp}
            >
              <Play />
              Proof normalize 1
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void normalizeRemaining()}
              disabled={!canRemaining || busy || !aiAvailable}
            >
              <Wand2 />
              Normalize remaining
            </Button>
            {busy ? (
              <Button type="button" variant="outline" onClick={pauseNormalize}>
                <Pause />
                Pause
              </Button>
            ) : null}
            {normRun === "paused" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void resumeNormalize()}
              >
                <Play />
                Resume
              </Button>
            ) : null}
            {normFailed > 0 && !busy ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void retryNormalizeFailed()}
              >
                <RotateCcw />
                Retry failed
              </Button>
            ) : null}
          </div>
          {normDone > 0 && normDone >= normable.length && normable.length > 0 ? (
            <p className="mt-2 text-sm text-olive">
              Bible craft locked — go to <strong>Pages</strong>, lock E01 house,
              drop your 167 stills.
            </p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={members.length === 0 || settingUp || busy}
            onClick={clearCast}
          >
            <Trash2 />
            Clear bible
          </Button>
        </div>
        <p className="mt-2 tabular-nums text-xs text-ink-soft">
          {members.length} rows · {aCount} A · {rooted} roots · {normDone}{" "}
          normalized
          {aMissing > 0 ? ` · ${aMissing} A missing roots` : ""}
          {settingUp || hydrating ? " · Working…" : ""}
        </p>
      </div>

      <DropZone
        label="Drop extra character stills"
        hint="Optional. New rows start as raw — normalize after."
        multiple
        className="min-h-24 rounded-xl bg-paper-2 px-5 py-6 shadow-[var(--shadow-border)]"
        onFiles={(files) => {
          void (async () => {
            for (const file of files) {
              await addMember(file);
            }
          })();
        }}
      />

      {hydrating && members.length === 0 ? (
        <p className="text-sm text-muted">Restoring cast bible…</p>
      ) : members.length === 0 ? (
        <div className="rounded-xl bg-paper-2 px-5 py-12 text-center shadow-[var(--shadow-border)]">
          <p className="font-display text-lg tracking-display">Empty bible</p>
          <p className="mt-1 text-sm text-muted">
            Tap Set up Living Worlds, then Proof normalize.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {members.map((member) => {
            const canNorm =
              Boolean(member.sourceBlob) && member.tier !== "C";
            return (
              <li
                key={member.id}
                className="overflow-hidden rounded-xl bg-paper-2 shadow-[var(--shadow-border)]"
              >
                <div className="grid gap-3 p-3 sm:grid-cols-[112px_minmax(0,1fr)]">
                  <div className="relative aspect-square overflow-hidden rounded-md bg-fog">
                    {member.url ? (
                      <img
                        src={member.url}
                        alt=""
                        className="size-full object-cover outline outline-1 -outline-offset-1 outline-ink/10"
                        draggable={false}
                      />
                    ) : (
                      <button
                        type="button"
                        className="flex size-full min-h-28 flex-col items-center justify-center gap-1 px-2 text-center text-xs text-muted hover:bg-paper"
                        onClick={() => fileRefs.current[member.id]?.click()}
                      >
                        <Upload className="size-5 text-olive" strokeWidth={1.5} />
                        Attach root
                      </button>
                    )}
                    {member.normStatus === "running" ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-ink/40">
                        <span className="text-sm font-medium text-moss-fg">
                          Normalizing…
                        </span>
                      </div>
                    ) : null}
                    <input
                      ref={(el) => {
                        fileRefs.current[member.id] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/*"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void attachRoot(member.id, file);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) =>
                          updateMember(member.id, { name: e.target.value })
                        }
                        className="min-h-11 min-w-0 flex-1 rounded-md bg-paper px-3 text-base font-medium shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-moss/40"
                        aria-label="Character name"
                      />
                      <Badge
                        variant={
                          member.tier === "A"
                            ? "default"
                            : member.tier === "B"
                              ? "outline"
                              : "muted"
                        }
                      >
                        {member.tier}
                      </Badge>
                      {member.e01 ? (
                        <Badge variant="muted">E01</Badge>
                      ) : (
                        <Badge variant="outline">later</Badge>
                      )}
                      {member.tier === "C" ? (
                        <Badge variant="muted">skip norm</Badge>
                      ) : member.normStatus === "done" ? (
                        <Badge variant="default">normalized</Badge>
                      ) : member.normStatus === "failed" ? (
                        <Badge variant="outline">failed</Badge>
                      ) : member.sourceBlob ? (
                        <Badge variant="outline">raw</Badge>
                      ) : (
                        <Badge variant="outline">no root</Badge>
                      )}
                    </div>

                    {member.normError ? (
                      <p className="text-xs text-umber">{member.normError}</p>
                    ) : null}

                    <div
                      className="grid grid-cols-3 gap-1 rounded-md bg-paper p-1 shadow-[var(--shadow-border)]"
                      role="group"
                      aria-label="Tier"
                    >
                      {TIERS.map((tier) => (
                        <Button
                          key={tier}
                          type="button"
                          variant={member.tier === tier ? "default" : "ghost"}
                          className={cn(
                            "min-h-11",
                            member.tier !== tier && "shadow-none",
                          )}
                          aria-pressed={member.tier === tier}
                          disabled={busy}
                          onClick={() => updateMember(member.id, { tier })}
                        >
                          {tier}
                        </Button>
                      ))}
                    </div>

                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="size-5 accent-[var(--color-moss)]"
                        checked={member.e01}
                        disabled={busy}
                        onChange={(e) =>
                          updateMember(member.id, { e01: e.target.checked })
                        }
                      />
                      Appears in E01
                    </label>

                    <textarea
                      value={member.costumeNotes}
                      onChange={(e) =>
                        updateMember(member.id, {
                          costumeNotes: e.target.value,
                        })
                      }
                      rows={2}
                      placeholder="Costume lock"
                      className="min-h-16 w-full resize-y rounded-md bg-paper px-3 py-2 text-sm shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-moss/40"
                      aria-label="Costume notes"
                    />
                    <textarea
                      value={member.notes}
                      onChange={(e) =>
                        updateMember(member.id, { notes: e.target.value })
                      }
                      rows={2}
                      placeholder="Production notes"
                      className="min-h-14 w-full resize-y rounded-md bg-paper px-3 py-2 text-sm text-muted shadow-[var(--shadow-border)] outline-none focus-visible:ring-2 focus-visible:ring-moss/40"
                      aria-label="Notes"
                    />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => fileRefs.current[member.id]?.click()}
                      >
                        <Upload />
                        {member.sourceBlob ? "Replace root" : "Attach root"}
                      </Button>
                      {canNorm ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={busy || !aiAvailable}
                          onClick={() => void redoNormalize(member.id)}
                        >
                          <RotateCcw />
                          Redo normalize
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => removeMember(member.id)}
                      >
                        <Trash2 />
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
