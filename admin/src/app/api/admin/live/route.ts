import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getAdminSession } from "@/lib/admin-session-server";
import type { LivePayload, LiveScope } from "@/lib/admin-live-types";
import { readSectionCounts } from "@/lib/section-counts";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NOISE = new Set(["last_active_at", "updated_at"]);

type Row = Record<string, unknown>;

/** Skip heartbeats such as last-active. A missing old row means we cannot tell, so we keep the event. */
function rowMatters(payload: RealtimePostgresChangesPayload<Row>): boolean {
  if (payload.eventType !== "UPDATE") return true;
  const previous = (payload.old ?? {}) as Row;
  const next = (payload.new ?? {}) as Row;
  if (Object.keys(previous).length <= 1) return true;
  return Object.keys(next).some((key) => !NOISE.has(key) && previous[key] !== next[key]);
}

/**
 * One server-sent stream per open admin tab.
 * The database pushes row changes. This route does not query on a timer.
 * A comment line every 25s only keeps the socket from being closed by the host.
 */
export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  const pending = new Set<LiveScope>();
  const sb = supabaseAdmin();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: LivePayload) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: counts\ndata: ${JSON.stringify(payload)}\n\n`));
      };

      const flush = async () => {
        timer = null;
        if (closed) return;
        const changed = [...pending];
        pending.clear();
        try {
          const snapshot = await readSectionCounts(session);
          send({ counts: snapshot.counts, settingsStamp: snapshot.settingsStamp, changed });
        } catch {
          /* The next real change sends a fresh snapshot. */
        }
      };

      const note = (scopes: readonly LiveScope[], payload: RealtimePostgresChangesPayload<Row>) => {
        if (closed || !rowMatters(payload)) return;
        for (const scope of scopes) pending.add(scope);
        if (timer) return;
        timer = setTimeout(() => void flush(), 200);
      };

      const id = crypto.randomUUID();
      const channels = (
        [
          ["profiles", ["overview", "verifications", "users", "reports"]],
          ["reports", ["overview", "reports"]],
          ["wallets", ["overview", "users"]],
          ["razorpay_payment_credits", ["overview", "payments"]],
          ["member_subscriptions", ["payments"]],
          ["app_settings", ["settings"]],
          ["plans", ["settings"]],
          ["coupons", ["settings"]],
          ["payment_methods", ["settings"]],
          ["legal_pages", ["settings"]],
          ["admins", ["settings"]],
          ["support_tickets", ["support"]],
          ["support_messages", ["support"]],
        ] as const
      ).map(([table, scopes]) =>
        sb
          .channel(`admin-live-${table}-${id}`)
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table },
            (payload) => note(scopes, payload as RealtimePostgresChangesPayload<Row>)
          )
          .subscribe()
      );

      try {
        const snapshot = await readSectionCounts(session);
        send({ counts: snapshot.counts, settingsStamp: snapshot.settingsStamp, changed: [] });
      } catch {
        send({ counts: {}, settingsStamp: "", changed: [] });
      }

      ping = setInterval(() => {
        if (!closed) controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 25_000);

      const stop = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        if (ping) clearInterval(ping);
        for (const channel of channels) void sb.removeChannel(channel);
        try {
          controller.close();
        } catch {
          /* The client already went away. */
        }
      };
      request.signal.addEventListener("abort", stop);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
