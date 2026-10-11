import { PrimaryLink } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">That match or page doesn&apos;t exist.</p>
      <PrimaryLink href="/" className="mt-6">
        Back to top picks
      </PrimaryLink>
    </div>
  );
}
