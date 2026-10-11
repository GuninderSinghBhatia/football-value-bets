import { FavouritesPanel } from "./favourites";

/**
 * Left (favourites) / main / right (per-page summary) columns.
 * Below 1280px the right column moves under the main one; below 900px the left one lives in the top-bar drawer.
 */
export function PageColumns({ right, children }: { right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[900px]:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_300px]">
      <aside className="hidden animate-fade-up min-[900px]:row-span-2 min-[900px]:block xl:row-span-1">
        <FavouritesPanel />
      </aside>
      <div className="stagger min-w-0 space-y-4">{children}</div>
      {right && <aside className="stagger min-w-0 space-y-4 min-[900px]:col-start-2 xl:col-start-3">{right}</aside>}
    </div>
  );
}
