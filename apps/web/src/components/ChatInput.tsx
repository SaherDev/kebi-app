"use client";

import { Camera, Paperclip, Plus, Send, Square } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@kebi-app/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@kebi-app/ui";
import { useRef, useState, useEffect } from "react";

import { cn } from "@kebi-app/ui";
import { useTranslations } from "next-intl";

interface ChatInputProps {
  onSubmit: (message: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function ChatInput({ onSubmit, onStop, isStreaming, disabled, placeholder, className }: ChatInputProps) {
  const t = useTranslations("chat");
  const [hasContent, setHasContent] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const trimmed = inputRef.current?.value.trim() ?? "";
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "auto";
    }
    setHasContent(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Clear textarea whenever loading starts (e.g. from external submit buttons)
  useEffect(() => {
    if (disabled && inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.style.height = "auto";
      setHasContent(false);
    }
  }, [disabled]);

  const handleInput = () => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height =
        Math.min(inputRef.current.scrollHeight, 240) + "px";
      setHasContent(inputRef.current.value.trim().length > 0);
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-col gap-3 p-1">
        <textarea
          ref={inputRef}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onChange={handleInput}
          placeholder={placeholder || t("placeholder")}
          disabled={disabled}
          rows={1}
          suppressHydrationWarning
          className="w-full resize-none bg-transparent px-3 py-2.5 font-body text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
        />

        <div className="flex items-center gap-2">
          {/* Plus button */}
          <div suppressHydrationWarning>
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground transition-all duration-200 hover:bg-muted/80"
                      suppressHydrationWarning
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="rounded-lg bg-foreground text-background font-body text-xs px-3 py-1.5"
                >
                  {t("attach")}
                </TooltipContent>
              </Tooltip>
              <PopoverContent
                side="top"
                align="start"
                className="w-auto p-1.5 rounded-2xl border-border/50 bg-popover shadow-lg"
              >
                <div className="flex flex-col gap-0.5">
                  <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body text-foreground hover:bg-muted transition-colors">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    {t("attachFile")}
                  </button>
                  <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-body text-foreground hover:bg-muted transition-colors">
                    <Camera className="h-4 w-4 text-muted-foreground" />
                    {t("takePhoto")}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex-1" />

          {/* Stop (during streaming) or Send */}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background shadow-kebi-app-sm hover:bg-foreground/80 active:scale-95 transition-all duration-200"
            >
              <Square className="h-4 w-4 fill-current" />
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSubmit}
                  disabled={disabled || !hasContent}
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition-all duration-200",
                    hasContent
                      ? "bg-primary text-primary-foreground shadow-kebi-app-sm hover:shadow-kebi-app-md active:scale-95"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="rounded-lg bg-foreground text-background font-body text-xs px-3 py-1.5"
              >
                {t("send")}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

export { ChatInput };
