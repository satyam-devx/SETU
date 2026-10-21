import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

const buttonVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline",
}

// Heights come from the Design System Studio token (--setu-button-height).
// The fallback equals the pre-token size, so defaults render identically.
const sizeVariants = {
  default: "h-[var(--setu-button-height,2.75rem)] px-4 py-2",
  sm: "h-[var(--setu-button-height,2.75rem)] rounded-md px-3",
  lg: "h-[calc(var(--setu-button-height,2.75rem)+0.25rem)] rounded-md px-8",
  icon: "h-[var(--setu-button-height,2.75rem)] w-[var(--setu-button-height,2.75rem)]",
}

const Button = React.forwardRef(({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50", buttonVariants[variant], sizeVariants[size], className)}
      ref={ref}
      {...props}
    />
  )
})
Button.displayName = "Button"

export { Button, buttonVariants }
