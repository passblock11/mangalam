import { Hono } from "hono";
import { requireAuth } from "../auth.js";
import { getSupabaseAdmin } from "../supabase.js";

function profileSelectDetailed() {
  return [
    "id",
    "display_name",
    "date_of_birth",
    "phone",
    "phone_visible",
    "community",
    "mother_tongue",
    "city",
    "state",
    "is_verified",
    "last_active_at",
    "updated_at",
    "photo_urls",
  ].join(",");
}

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

// Strip direct contact fields from list responses — contact is only exposed
// via the gated /v1/profiles/:id endpoint (verified + paid + owner opt-in).
function stripContact<T extends Record<string, unknown>>(p: T): T {
  const { phone: _ph, whatsapp_number: _wa, phone_visible: _pv, ...rest } = p;
  return rest as T;
}

type ProfileRow = {
  id: string;
  date_of_birth?: string | null;
  phone?: string | null;
  phone_visible?: boolean;
  [key: string]: unknown;
};

export const likesRouter = new Hono();

likesRouter.use("*", requireAuth);

/** tab=mutual|views|contacts */
likesRouter.get("/", async (c) => {
  const uid = c.get("userId");
  const tab = c.req.query("tab") ?? "mutual";
  const sb = getSupabaseAdmin();

  if (tab === "views") {
    const { data, error } = await sb
      .from("profile_views")
      .select("viewer_id,viewed_at")
      .eq("viewed_id", uid)
      .order("viewed_at", { ascending: false })
      .limit(50);
    if (error) return c.json({ error: error.message }, 500);
    const ids = [...new Set((data ?? []).map((r) => r.viewer_id))];
    if (ids.length === 0) return c.json({ items: [] });
    const { data: profiles } = await sb
      .from("profiles")
      .select(profileSelectDetailed())
      .in("id", ids);
    const list = (profiles ?? []) as unknown as ProfileRow[];
    return c.json({
      items: list.map((p) => ({
        profile: {
          ...stripContact(p),
          age: ageFromDob(p.date_of_birth ?? null),
        },
        viewed_at: (data ?? []).find((d) => d.viewer_id === p.id)?.viewed_at,
      })),
    });
  }

  if (tab === "contacts") {
    const { data: fromMe, error: e1 } = await sb
      .from("messages")
      .select("conversation_id,sender_id,created_at")
      .eq("sender_id", uid)
      .order("created_at", { ascending: false })
      .limit(200);
    if (e1) return c.json({ error: e1.message }, 500);

    const convIds = [...new Set((fromMe ?? []).map((m) => m.conversation_id))];
    const otherByConv = new Map<string, string>();
    for (const cid of convIds) {
      const { data: mems } = await sb
        .from("conversation_members")
        .select("profile_id")
        .eq("conversation_id", cid);
      const other = (mems ?? []).map((m) => m.profile_id).find((pid) => pid !== uid);
      if (other) otherByConv.set(cid, other);
    }

    const latestByOther = new Map<string, string>();
    for (const row of fromMe ?? []) {
      const other = otherByConv.get(row.conversation_id);
      if (!other) continue;
      if (!latestByOther.has(other)) {
        latestByOther.set(other, row.created_at);
      }
    }

    const otherIds = [...latestByOther.keys()];
    if (otherIds.length === 0) return c.json({ items: [] });

    const { data: profiles } = await sb
      .from("profiles")
      .select(profileSelectDetailed())
      .in("id", otherIds);
    const contactList = (profiles ?? []) as unknown as ProfileRow[];
    return c.json({
      items: contactList.map((p) => ({
        profile: {
          ...stripContact(p),
          age: ageFromDob(p.date_of_birth ?? null),
        },
        contacted_at: latestByOther.get(p.id),
      })),
    });
  }

  // mutual (default)
  const { data: mutualRows, error: mErr } = await sb
    .from("interactions")
    .select("from_profile_id,to_profile_id,updated_at")
    .eq("status", "mutual")
    .or(`from_profile_id.eq.${uid},to_profile_id.eq.${uid}`);
  if (mErr) return c.json({ error: mErr.message }, 500);

  const otherIds = [
    ...new Set(
      (mutualRows ?? []).map((r) =>
        r.from_profile_id === uid ? r.to_profile_id : r.from_profile_id
      )
    ),
  ];

  if (otherIds.length === 0) return c.json({ items: [] });

  const { data: profiles, error: pErr } = await sb
    .from("profiles")
    .select(profileSelectDetailed())
    .in("id", otherIds);
  if (pErr) return c.json({ error: pErr.message }, 500);

  const mutualList = (profiles ?? []) as unknown as ProfileRow[];
  const items = mutualList.map((p) => ({
    profile: {
      ...stripContact(p),
      age: ageFromDob(p.date_of_birth ?? null),
    },
    matched_at: (mutualRows ?? []).find(
      (r) =>
        (r.from_profile_id === uid ? r.to_profile_id : r.from_profile_id) ===
        p.id
    )?.updated_at,
  }));

  return c.json({ items });
});
