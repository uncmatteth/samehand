import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium min-h-11 px-4 transition-[scale,background-color,color,opacity,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moss/40 disabled:pointer-events-none disabled:opacity-40 active:not-disabled:scale-[0.96] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-moss text-moss-fg shadow-[var(--shadow-border)] hover:bg-olive",
        secondary:
          "bg-paper-2 text-ink shadow-[var(--shadow-border)] hover:bg-fog",
        outline:
          "bg-transparent text-ink shadow-[var(--shadow-border)] hover:bg-paper-2",
        ghost: "bg-transparent text-ink hover:bg-fog",
        destructive: "bg-umber text-moss-fg shadow-[var(--shadow-border)] hover:opacity-90",
      },
      size: {
        default: "min-h-11 px-4",
        sm: "min-h-11 px-3 text-sm",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
