import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { checkAiAvailable } from "@/lib/restyle";
import { useCast } from "@/lib/cast-store";

type Props = {
  onReadyForEpisode?: () => void;
};

export function CastPanel({ onReadyForEpisode }: Props) {
  const hydrate = useCast((s) => s.hydrate);
  const settingUp = useCast((s) => s.settingUp);
  const members = useCast((s) => s.members);
  const normRun = useCast((s) => s.normRun);
  const setupLivingWorlds = useCast((s) => s.setupLivingWorlds);
  const proofNormalize = useCast((s) => s.proofNormalize);
  const normalizeRemaining = useCast((s) => s.normalizeRemaining);
  const pauseNormalize = useCast((s) => s.pauseNormalize);
  const resumeNormalize = useCast((s) => s.resumeNormalize);
  const retryNormalizeFailed = useCast((s) => s.retryNormalizeFailed);
  const redoNormalize = useCast((s) => s.redoNormalize);
  const [aiAvailable, setAiAvailable] = useState(true);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    void checkAiAvailable().then((r) => setAiAvailable(r.available));
  }, []);

  const list = members.filter((m) => m.tier !== "C");
  const need = list.filter((m) => m.sourceBlob);
  const done = need.filter((m) => m.normStatus === "done").length;
  const failed = need.filter((m) => m.normStatus === "failed").length;
  const total = need.length;
  const busy = normRun === "proof" || normRun === "remaining";
  const active = members.find((m) => m.normStatus === "running");
  const empty = members.length === 0;
  const allReady = total > 0 && done >= total;

  // One action at a time
  let primaryLabel = "Load my characters";
  let primaryAction: (() => void) | null = () =>
    void setupLivingWorlds({ force: false });
  let help = "This loads Mara, Kael, Tamsin, and the rest.";

  if (!empty && done === 0 && !busy) {
    primaryLabel = "Fix one test photo";
    primaryAction = () => void proofNormalize();
    help = "Runs on one character first so you can check the look. Usually Mara.";
  } else if (!empty && done > 0 && !allReady && !busy) {
    primaryLabel = `Fix the rest (${done}/${total})`;
    primaryAction = () => void normalizeRemaining();
    help = "Cleans every main cast photo to match. Pause anytime.";
  } else if (busy) {
    primaryLabel = active ? `Working on ${active.name}…` : "Working…";
    primaryAction = null;
    help = "Wait. Or press Pause.";
  } else if (allReady) {
    primaryLabel = "Characters done — go to Episode";
    primaryAction = () => onReadyForEpisode?.();
    help = "Next: lock house look, drop your 167 pictures, restyle them.";
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl bg-paper-2 p-5 shadow-[var(--shadow-border)]">
        <p className="text-sm text-muted">{help}</p>

        <Button
          type="button"
          className="mt-4 min-h-14 w-full text-base"
          disabled={
            settingUp ||
            primaryAction === null ||
            (!aiAvailable && !allReady && primaryLabel !== "Load my characters")
          }
          onClick={() => primaryAction?.()}
        >
          {primaryLabel.startsWith("Load") ? <Sparkles /> : null}
          {primaryLabel.startsWith("Fix one") ? <Play /> : null}
          {primaryLabel.startsWith("Fix the rest") ? <Wand2 /> : null}
          {settingUp ? "Loading…" : primaryLabel}
        </Button>

        {busy ? (
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full"
            onClick={pauseNormalize}
          >
            <Pause />
            Pause
          </Button>
        ) : null}

        {normRun === "paused" ? (
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => void resumeNormalize()}
          >
            <Play />
            Resume
          </Button>
        ) : null}

        {failed > 0 && !busy ? (
          <Button
            type="button"
            variant="outline"
            className="mt-2 w-full"
            onClick={() => void retryNormalizeFailed()}
          >
            <RotateCcw />
            Retry failed ({failed})
          </Button>
        ) : null}

        {!aiAvailable ? (
          <p className="mt-3 text-sm text-umber">AI not available in this run.</p>
        ) : null}

        {total > 0 ? (
          <>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-fog">
              <div
                className="h-full bg-moss transition-[width]"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-center text-sm tabular-nums text-ink-soft">
              {done} / {total} ready
            </p>
          </>
        ) : null}
      </div>

      {list.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3">
          {list.map((m) => (
            <li
              key={m.id}
              className="overflow-hidden rounded-xl bg-paper-2 shadow-[var(--shadow-border)]"
            >
              <div className="relative aspect-square bg-fog">
                {m.url ? (
                  <img
                    src={m.url}
                    alt={m.name}
                    className="size-full object-cover"
                    draggable={false}
                  />
                ) : null}
                {m.normStatus === "running" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-ink/40 text-sm text-moss-fg">
                    Working…
                  </div>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-1 p-2">
                <span className="truncate text-sm font-medium">{m.name}</span>
                <Badge
                  variant={
                    m.normStatus === "done"
                      ? "default"
                      : m.normStatus === "failed"
                        ? "outline"
                        : "muted"
                  }
                >
                  {m.normStatus === "done"
                    ? "Ready"
                    : m.normStatus === "failed"
                      ? "Failed"
                      : "…"}
                </Badge>
              </div>
              {(m.normStatus === "failed" || m.normStatus === "done") &&
              !busy ? (
                <button
                  type="button"
                  className="w-full border-t border-ink/10 py-2 text-xs text-muted hover:bg-fog"
                  onClick={() => void redoNormalize(m.id)}
                >
                  Redo this one
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!empty ? (
        <button
          type="button"
          className="text-center text-xs text-muted underline"
          disabled={busy || settingUp}
          onClick={() => void setupLivingWorlds({ force: true })}
        >
          Start cast over
        </button>
      ) : null}
    </div>
  );
}
