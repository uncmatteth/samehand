import { useEffect, useState } from "react";
import { Archive, Pause, Play, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/lib/studio-store";
import { zipFinals } from "@/lib/zip";
import { toast } from "sonner";

export function StudioToolbar({ aiAvailable }: { aiAvailable: boolean }) {
  const house = useStudio((s) => s.house);
  const pages = useStudio((s) => s.pages);
  const run = useStudio((s) => s.run);
  const restyleStartedAt = useStudio((s) => s.restyleStartedAt);
  const preparing = useStudio((s) => s.preparing);
  const preparingTotal = useStudio((s) => s.preparingTotal);
  const proofFirst = useStudio((s) => s.proofFirst);
  const restyleRemaining = useStudio((s) => s.restyleRemaining);
  const pause = useStudio((s) => s.pause);
  const resume = useStudio((s) => s.resume);
  const retryFailed = useStudio((s) => s.retryFailed);
  const startOver = useStudio((s) => s.startOver);
  const [zipHref, setZipHref] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!restyleStartedAt) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - restyleStartedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [restyleStartedAt]);

  useEffect(() => {
    return () => {
      if (zipHref) URL.revokeObjectURL(zipHref);
    };
  }, [zipHref]);

  const done = pages.filter((page) => page.status === "done").length;
  const failed = pages.filter((page) => page.status === "failed").length;
  const busy = run === "proof" || run === "remaining";
  const firstQueued = pages[0]?.status === "queued" || pages[0]?.status === "failed";
  const canRemaining =
    pages[0]?.status === "done" && pages.some((page) => page.status === "queued");
  const canZip = done > 0 && !busy;
  const active = pages.find((page) => page.status === "restyling");

  async function prepareZip() {
    try {
      const blob = await zipFinals(pages);
      const href = URL.createObjectURL(blob);
      setZipHref((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return href;
      });
      toast.success("Zip ready — tap Save zip");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not zip finals";
      toast.error(message);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="tabular-nums text-sm text-muted">
          {pages.length === 0
            ? "No pages yet"
            : `${done} of ${pages.length} restyled`}
        </p>
        {preparingTotal > 0 ? (
          <p className="tabular-nums text-sm text-muted">
            Cropping {preparing}/{preparingTotal}
          </p>
        ) : null}
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-fog"
        role="progressbar"
        aria-valuenow={pages.length ? done : 0}
        aria-valuemax={pages.length || 1}
      >
        <div
          className="h-full bg-moss transition-[width] duration-200 ease-out"
          style={{ width: pages.length ? `${(done / pages.length) * 100}%` : "0%" }}
        />
      </div>
      {busy && active ? (
        <p className="tabular-nums text-sm text-ink-soft">
          {run === "proof" ? "Proofing" : "Restyling"} page{" "}
          {String(active.order).padStart(2, "0")} · {elapsed}s
        </p>
      ) : null}
      {!aiAvailable ? (
        <p className="text-sm text-umber">AI is not available in this environment.</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void proofFirst()}
          disabled={!house || !firstQueued || busy || !aiAvailable}
        >
          <Play className="ml-0.5" />
          Proof 1
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void restyleRemaining()}
          disabled={!canRemaining || busy || !aiAvailable}
        >
          Restyle remaining
        </Button>
        {busy ? (
          <Button type="button" variant="outline" onClick={pause}>
            <Pause />
            Pause
          </Button>
        ) : null}
        {run === "paused" ? (
          <Button type="button" variant="outline" onClick={() => void resume()}>
            <Play />
            Resume
          </Button>
        ) : null}
        {failed > 0 && !busy ? (
          <Button type="button" variant="outline" onClick={() => void retryFailed()}>
            <RotateCcw />
            Retry failed
          </Button>
        ) : null}
        {zipHref ? (
          <Button asChild variant="outline">
            <a href={zipHref} download="samehand-finals.zip">
              <Archive />
              Save zip
            </a>
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => void prepareZip()} disabled={!canZip}>
            <Archive />
            Zip finals
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={startOver}
          disabled={!house && pages.length === 0}
        >
          <Trash2 />
          Start over
        </Button>
      </div>
      <p className="text-xs text-muted">
        Save and Zip finals only export restyles already in the cards. No originals.
      </p>
    </div>
  );
}
