import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type DropZoneProps = {
  label: string;
  hint?: string;
  className?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
};

export function DropZone({
  label,
  hint,
  className,
  accept = "image/jpeg,image/png,image/webp",
  multiple = false,
  disabled,
  onFiles,
  children,
}: DropZoneProps) {
  const [mounted, setMounted] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  function take(list: FileList | File[] | null) {
    if (!list) return;
    const files = Array.from(list);
    if (files.length) onFiles(files);
  }

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center text-center",
        over && "bg-fog",
        disabled && "opacity-40 pointer-events-none",
        className,
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files);
      }}
    >
      {children}
      <p className="font-medium text-ink">{label}</p>
      {hint ? <p className="mt-1 max-w-xs text-sm text-muted">{hint}</p> : null}
      {mounted ? (
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="absolute inset-0 cursor-pointer opacity-0"
          aria-label={label}
          onChange={(e) => {
            take(e.target.files);
            e.currentTarget.value = "";
          }}
        />
      ) : (
        <span className="absolute inset-0" aria-hidden />
      )}
    </div>
  );
}
