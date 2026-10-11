"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type Option<T extends string> = { value: T; label: string; icon?: React.ReactNode; hint?: string };

/** Custom dropdown (listbox) with icons, keyboard support and an animated menu. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [alignRight, setAlignRight] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];

  const openMenu = () => {
    // Menus size to their content; open leftwards when there is no room on the right.
    const rect = trigger.current?.getBoundingClientRect();
    setAlignRight(Boolean(rect && rect.left + 260 > window.innerWidth));
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = (focusTrigger = true) => {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  };
  const choose = (i: number) => {
    onChange(options[i].value);
    close();
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.focus();
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((i) => Math.min(options.length - 1, i + 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(options.length - 1);
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Escape") close();
    else if (e.key === "Tab") setOpen(false);
    else return;
    if (e.key !== "Tab") e.preventDefault();
  };

  return (
    <div ref={root} className="relative flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-xs text-muted">
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            openMenu();
          }
        }}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-xl border bg-surface-2 px-3 text-left text-sm transition-all duration-200",
          open ? "border-accent bg-surface-2" : "border-transparent hover:bg-surface-hover",
        )}
      >
        {selected.icon && <span className="shrink-0">{selected.icon}</span>}
        <span id={`${id}-value`} className="min-w-0 flex-1 truncate font-medium">
          {selected.label}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform duration-300", open && "rotate-180 text-text")} />
      </button>

      {open && (
        <ul
          ref={list}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={`${id}-label`}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={onListKey}
          className={cn(
            "absolute top-full z-30 mt-2 max-h-72 w-max max-w-[16rem] min-w-full overflow-y-auto rounded-xl border bg-surface p-1 shadow-[0_16px_40px_rgb(0_0_0/0.45)] outline-none",
            alignRight ? "right-0 origin-top-right" : "left-0 origin-top-left",
          )}
          style={{ animation: "menu-in 0.22s cubic-bezier(0.16, 1, 0.3, 1) both" }}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${id}-opt-${i}`}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150",
                  i === active && "bg-surface-2",
                  isSelected ? "font-medium text-text" : "text-muted",
                )}
              >
                {o.icon && <span className="shrink-0">{o.icon}</span>}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {o.hint && <span className="text-xs text-muted">{o.hint}</span>}
                <Check className={cn("size-4 shrink-0 text-accent-text transition-opacity", isSelected ? "opacity-100" : "opacity-0")} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Segmented control for a few mutually exclusive options; the highlight slides between them. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="relative grid h-10 rounded-full bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        <span
          aria-hidden
          className="absolute top-1 bottom-1 left-1 rounded-full bg-line-strong transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        />
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 rounded-full px-2 text-sm font-medium whitespace-nowrap transition-colors duration-200",
              o.value === value ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
