// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import * as RadixToast from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { create } from "zustand";

import { cn } from "../cn";

export type ToastKind = "info" | "error" | "success";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts.slice(-4), { ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** Show a toast from anywhere (an error of a request, a finished job). */
export function toast(
  title: string,
  options: { kind?: ToastKind; description?: string; duration?: number } = {},
): number {
  return useToasts.getState().push({
    title,
    kind: options.kind ?? "info",
    description: options.description,
    duration: options.duration ?? (options.kind === "error" ? 8000 : 4000),
  });
}

/** Renders the toasts; put one at the root of the app. */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <RadixToast.Provider swipeDirection="right">
      {toasts.map((item) => (
        <RadixToast.Root
          key={item.id}
          duration={item.duration}
          onOpenChange={(open) => {
            if (!open) dismiss(item.id);
          }}
          className={cn(
            "flex items-start gap-2 rounded-md border bg-surface px-3 py-2 text-[13px] shadow-md",
            item.kind === "error" && "border-danger/40",
            item.kind === "success" && "border-ok/40",
            item.kind === "info" && "border-line-2",
          )}
        >
          <div className="min-w-0 flex-1">
            <RadixToast.Title className={cn("font-medium", item.kind === "error" && "text-danger")}>
              {item.title}
            </RadixToast.Title>
            {item.description ? (
              <RadixToast.Description className="mt-0.5 text-xs text-muted">
                {item.description}
              </RadixToast.Description>
            ) : null}
          </div>
          <RadixToast.Close aria-label="dismiss" className="text-muted hover:text-ink">
            <X size={14} />
          </RadixToast.Close>
        </RadixToast.Root>
      ))}
      <RadixToast.Viewport className="fixed right-3 bottom-3 z-50 flex w-80 max-w-[calc(100vw-24px)] flex-col gap-2 outline-none" />
    </RadixToast.Provider>
  );
}
