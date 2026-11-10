import { useState } from "react";
import { Download, RotateCcw, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { restyleFilename } from "@/lib/image";
import { useStudio, type Page } from "@/lib/studio-store";

export function PageCard({ page }: { page: Page }) {
  const retryPage = useStudio((s) => s.retryPage);
  const removePage = useStudio((s) => s.removePage);
  const run = useStudio((s) => s.run);
  const [open, setOpen] = useState(false);
  const busy = run === "proof" || run === "remaining";
  const shown = page.status === "done" && page.restyleUrl ? page.restyleUrl : page.croppedUrl;
  const filename = restyleFilename(page.name, page.order);
  const idx = String(page.order).padStart(2, "0");

  return (
    <>
      <article className="flex flex-col overflow-hidden rounded-xl bg-paper-2 shadow-[var(--shadow-border)]">
        <button
          type="button"
          className="relative aspect-square overflow-hidden bg-fog"
          onClick={() => {
            if (page.status === "done" && page.restyleUrl) setOpen(true);
          }}
          aria-label={`Page ${idx}`}
        >
          <img
            src={shown}
            alt=""
            className="size-full object-cover outline outline-1 -outline-offset-1 outline-ink/10"
            draggable={false}
          />
          {page.status === "restyling" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/35">
              <span className="text-sm font-medium text-moss-fg">Restyling…</span>
            </div>
          ) : null}
        </button>
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="tabular-nums text-xs text-ink-soft">{idx}</span>
          <Badge
            variant={
              page.status === "done"
                ? "default"
                : page.status === "failed"
                  ? "outline"
                  : "muted"
            }
          >
            {page.status === "done"
              ? "Final"
              : page.status === "failed"
                ? "Failed"
                : page.status === "restyling"
                  ? "Busy"
                  : "Queued"}
          </Badge>
          <span className="min-w-0 flex-1 truncate text-xs text-muted">{page.name}</span>
          {page.status === "done" && page.restyleUrl ? (
            <Button asChild variant="ghost" size="icon" className="size-11 shrink-0">
              <a href={page.restyleUrl} download={filename} aria-label="Save restyle">
                <Download />
              </a>
            </Button>
          ) : null}
          {page.status === "queued" || page.status === "failed" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              disabled={busy}
              onClick={() => removePage(page.id)}
              aria-label="Remove page"
            >
              <Trash2 />
            </Button>
          ) : null}
          {page.status === "done" || page.status === "failed" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              disabled={busy}
              onClick={() => void retryPage(page.id)}
              aria-label="Redo"
            >
              <RotateCcw />
            </Button>
          ) : null}
        </div>
        {page.error ? (
          <p className="px-3 pb-3 text-xs text-umber">{page.error}</p>
        ) : null}
      </article>

      {open && page.restyleUrl ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Restyle preview"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[90dvh] max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={page.restyleUrl}
              alt=""
              className="max-h-[80dvh] w-auto rounded-md object-contain outline outline-1 -outline-offset-1 outline-ink/10"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button asChild>
                <a href={page.restyleUrl} download={filename}>
                  <Download />
                  Save
                </a>
              </Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                <X />
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
