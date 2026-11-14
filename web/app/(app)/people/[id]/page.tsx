"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { ageOf, type Profile } from "@/lib/profile";

export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [person, setPerson] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState({ title: "", description: "", category: "other" });

  useEffect(() => {
    api<Profile & { profile?: Profile }>(`/v1/profiles/${id}`)
      .then((data) => setPerson(data.profile ?? data))
      .catch((err: Error) => setError(err.message));
    api("/v1/views", { method: "POST", body: { viewed_id: id } }).catch(() => undefined);
  }, [id]);

  async function like() {
    setError("");
    try {
      const result = await api<{ interaction?: { status?: string } }>("/v1/interactions", {
        method: "POST",
        body: { to_profile_id: id, action: "like" },
      });
      setNote(result.interaction?.status === "mutual" ? "It's a match. They moved to Matches." : "Liked. They are in your Shortlisted tab.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not like this profile.");
    }
  }

  async function reveal(channel: "phone" | "whatsapp") {
    setError("");
    try {
      let result = await api<{ needs_confirm?: boolean; phone?: string; whatsapp_number?: string; value?: string; credit_cost?: number }>(
        `/v1/profiles/${id}/reveal-contact`,
        { method: "POST", body: { channel, confirm: false } },
      );
      if (result.needs_confirm) {
        const cost = result.credit_cost ?? 0;
        if (!window.confirm(cost > 0 ? `This uses ${cost} credits.` : "Show this contact?")) return;
        result = await api(`/v1/profiles/${id}/reveal-contact`, { method: "POST", body: { channel, confirm: true } });
      }
      const shown = result.value || (channel === "phone" ? result.phone : result.whatsapp_number);
      setPerson((current) => current ? {
        ...current,
        phone: channel === "phone" && shown ? shown : current.phone,
        whatsapp_number: channel === "whatsapp" && shown ? shown : current.whatsapp_number,
        phone_revealed: channel === "phone" || current.phone_revealed,
        whatsapp_revealed: channel === "whatsapp" || current.whatsapp_revealed,
      } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not show this contact.");
    }
  }

  if (!person && !error) return <p className="text-muted">Loading profile…</p>;
  if (!person) return <p className="text-maroon">{error}</p>;
  const photos = person.photo_urls ?? [];
  const age = ageOf(person.date_of_birth, person.age);
  const facts = [
    ["City", [person.city, person.state].filter(Boolean).join(", ")],
    ["Religion", person.religion],
    ["Community", person.community],
    ["Mother tongue", person.mother_tongue],
    ["Diet", person.diet],
    ["Marital status", person.marital_status],
    ["Education", person.education_level],
    ["Occupation", person.occupation],
    ["Height", person.height_cm ? `${person.height_cm} cm` : ""],
  ].filter(([, value]) => value);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="overflow-hidden rounded-3xl border border-line bg-white">
        {photos[photo] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photos[photo]} alt="" className={`aspect-[3/4] w-full object-cover ${person.photos_locked ? "blur-xl" : ""}`} />
        ) : <div className="grid aspect-[3/4] place-items-center text-muted">No photo</div>}
        {photos.length > 1 ? (
          <div className="flex gap-2 p-3">
            {photos.map((url, index) => (
              <button key={url} onClick={() => setPhoto(index)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-14 w-12 rounded-xl object-cover" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div>
        <h1 className="display text-5xl">{person.display_name}{age ? `, ${age}` : ""}</h1>
        {person.is_verified ? <p className="mt-2 text-sm font-medium text-maroon">Verified</p> : null}
        {person.bio ? <p className="mt-4 max-w-2xl leading-7 text-muted">{person.bio}</p> : null}
        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white px-4 py-3">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="mt-1">{value}</dd>
            </div>
          ))}
        </dl>
        {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
        {note ? <p className="mt-4 text-sm text-maroon">{note}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="rounded-full bg-maroon px-5 py-2.5 text-sm text-white" onClick={like}>Like</button>
          <button className="rounded-full border border-line bg-white px-5 py-2.5 text-sm" onClick={() => router.push(`/chats?with=${id}`)}>Message</button>
          <button className="rounded-full border border-line bg-white px-5 py-2.5 text-sm" onClick={() => reveal("phone")}>
            {person.phone_revealed && person.phone ? person.phone : "Phone"}
          </button>
          <button className="rounded-full border border-line bg-white px-5 py-2.5 text-sm" onClick={() => reveal("whatsapp")}>
            {person.whatsapp_revealed && person.whatsapp_number ? person.whatsapp_number : "WhatsApp"}
          </button>
          <button className="rounded-full px-5 py-2.5 text-sm text-muted" onClick={() => setReportOpen(true)}>Report</button>
          <button
            className="rounded-full px-5 py-2.5 text-sm text-muted"
            onClick={async () => {
              await api("/v1/blocks", { method: "POST", body: { blocked_id: id } });
              setNote("This member is blocked.");
            }}
          >
            Block
          </button>
        </div>
        {person.contact_needs_verification ? <p className="mt-4 text-sm text-muted">Verify your identity to view contact details.</p> : null}
        {reportOpen ? (
          <form
            className="mt-6 max-w-lg space-y-3 rounded-2xl border border-line bg-white p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await api("/v1/reports", {
                  method: "POST",
                  body: { reported_profile_id: id, title: report.title, description: report.description, category: report.category },
                });
                setReportOpen(false);
                setNote("Report submitted. Our team will review it.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not send the report.");
              }
            }}
          >
            <p className="font-medium">Report this profile</p>
            <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="Title" value={report.title} onChange={(e) => setReport({ ...report, title: e.target.value })} required />
            <select className="w-full rounded-xl border border-line px-3 py-2 text-sm" value={report.category} onChange={(e) => setReport({ ...report, category: e.target.value })}>
              <option value="scam_fraud">Scam / Fraud</option>
              <option value="harassment">Harassment</option>
              <option value="fake_profile">Fake profile</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="illegal">Illegal / Harmful</option>
              <option value="other">Other</option>
            </select>
            <textarea className="min-h-24 w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder="What happened?" value={report.description} onChange={(e) => setReport({ ...report, description: e.target.value })} required />
            <button className="rounded-md bg-maroon px-4 py-2 text-sm text-white">Submit report</button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
