import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[transform,background-color,color,opacity] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-accent/40 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-accent text-white hover:bg-accent-strong",
        secondary: "bg-surface-muted text-foreground hover:bg-border",
        ghost: "text-foreground hover:bg-surface-muted",
        outline: "border border-border bg-surface text-foreground hover:bg-surface-muted",
      },
      size: {
        default: "h-12 px-6 text-[15px]",
        sm: "h-9 px-4 text-sm",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { Button, buttonVariants };
