import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, orientation, ...props }, ref) => {
  const isVertical = orientation === "vertical";
  
  return (
    <SliderPrimitive.Root
      ref={ref}
      orientation={orientation}
      className={cn(
        "relative flex touch-none select-none",
        isVertical 
          ? "flex-col h-full w-4 items-center" 
          : "w-full items-center",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track 
        className={cn(
          "relative grow overflow-hidden rounded-full",
          isVertical 
            ? "w-1.5 h-full bg-gradient-to-t from-muted/80 to-muted/40 border border-border/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]" 
            : "h-2 w-full bg-secondary"
        )}
      >
        <SliderPrimitive.Range 
          className={cn(
            "absolute rounded-full transition-all duration-100",
            isVertical 
              ? "w-full bottom-0 bg-gradient-to-t from-primary/70 via-primary to-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)]" 
              : "h-full left-0 bg-primary"
          )}
        />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb 
        className={cn(
          "block transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          isVertical
            ? "h-2.5 w-6 rounded-sm bg-gradient-to-b from-foreground/90 to-foreground/70 border border-primary/50 shadow-[0_2px_6px_rgba(0,0,0,0.4),0_0_8px_hsl(var(--primary)/0.3)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.5),0_0_12px_hsl(var(--primary)/0.5)] hover:border-primary/80"
            : "h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      />
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
