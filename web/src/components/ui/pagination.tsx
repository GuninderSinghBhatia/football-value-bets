"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./primitives";

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-3 text-sm text-muted">
      <IconButton label="Previous page" disabled={page === 0} onClick={() => onChange(page - 1)} className="disabled:opacity-40">
        <ChevronLeft className="size-4" />
      </IconButton>
      <span className="tabular">
        Page {page + 1} of {pages}
      </span>
      <IconButton label="Next page" disabled={page >= pages - 1} onClick={() => onChange(page + 1)} className="disabled:opacity-40">
        <ChevronRight className="size-4" />
      </IconButton>
    </div>
  );
}
