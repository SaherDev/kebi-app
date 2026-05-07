import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const cardVariants = cva(
  "bg-card text-card-foreground transition-all duration-300",
  {
    variants: {
      elevation: {
        flat: "shadow-none border border-border rounded-2xl",
        sm: "shadow-kebi-app-sm border border-border/60 rounded-2xl",
        md: "shadow-kebi-app-md border-0 rounded-3xl",
        lg: "shadow-kebi-app-lg border-0 rounded-3xl",
        floating: "shadow-kebi-app-lg border-0 rounded-[1.75rem]",
      },
      interactive: {
        true: "cursor-pointer hover:shadow-kebi-app-lg hover:-translate-y-1 active:translate-y-0 active:shadow-kebi-app-md",
        false: "",
      },
    },
    defaultVariants: {
      elevation: "md",
      interactive: false,
    },
  }
);

export interface KebiCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const KebiCard = React.forwardRef<HTMLDivElement, KebiCardProps>(
  ({ className, elevation, interactive, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ elevation, interactive, className }))}
      {...props}
    />
  )
);
KebiCard.displayName = "KebiCard";

const KebiCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 pt-6 pb-2", className)} {...props} />
));
KebiCardHeader.displayName = "KebiCardHeader";

const KebiCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 pb-6", className)} {...props} />
));
KebiCardContent.displayName = "KebiCardContent";

export { KebiCard, KebiCardHeader, KebiCardContent, cardVariants };
