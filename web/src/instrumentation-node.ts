// Schedules the settlement job (bet-tracker.md section 4): shortly after start, then every 15 minutes.
import { settlePending } from "@/lib/server/picks-service";

const run = () =>
  settlePending()
    .then((r) => r.settled && console.log(`[settle] settled ${r.settled} pick(s), ${r.stillPending} still pending`))
    .catch((e) => console.error("[settle] failed:", e));

setTimeout(run, 10_000);
setInterval(run, 15 * 60_000);
