// Runs once when the Next.js server starts. The Node-only part lives in its own file so the edge build never sees it.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
