import * as React from "react";
import { cn } from "../lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-border bg-card px-4 py-2.5 font-body text-sm text-foreground shadow-kebi-app-sm transition-all duration-200",
          "placeholder:text-muted-foreground/60",
          "focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary focus:shadow-kebi-app-md",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
