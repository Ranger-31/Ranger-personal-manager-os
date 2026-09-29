"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-[2px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40 data-[state=checked]:bg-accent data-[state=unchecked]:bg-[#e3e5e9]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-[27px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.18)] transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
