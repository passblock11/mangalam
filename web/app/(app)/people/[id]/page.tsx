"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhotoPicker } from "@/components/photo-picker";
import { PhotoViewer } from "@/components/photo-viewer";
import { Icon } from "@/components/icons";
import { api } from "@/lib/api";
import { t, tValue, useLocale } from "@/lib/i18n";
import { ageOf, type Profile } from "@/lib/profile";

export default function PersonPage() {
  useLocale();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [person, setPerson] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState({ title: "", description: "", category: "other" });
  const [shots, setShots] = useState<string[]>([]);
  const [viewer, setViewer] = useState<number | null>(null);
  const [bioOpen, setBioOpen] = useState(false);
  const [menu, setMenu] = useState(false);

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
  const facts: [string, string][] = [
    ["Caste", person.community || "—"],
    ["Mother tongue", person.mother_tongue || "—"],
    ["Diet", person.diet || "—"],
    ["Height", person.height_cm ? `${person.height_cm} cm` : "—"],
    ["Profile for", person.profile_for || "—"],
    ["Marital status", person.marital_status || "—"],
  ];

  const bio = person.bio || "";
  const partner = person.partner_preferences ?? {};
  const canContact = !person.contact_locked && !person.contact_owner_disabled && (person.phone_available || person.whatsapp_available);

  return (
    <div className="pb-28">
      <div className="relative -mx-4 -mt-4">
        <button type="button" className="block w-full" disabled={!photos[photo] || Boolean(person.photos_locked)} onClick={() => setViewer(photo)}>
          {photos[photo] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos[photo]} alt="" className={`aspect-[0.95] w-full object-cover ${person.photos_locked ? "scale-110 blur-xl" : ""}`} />
          ) : <span className="grid aspect-[0.95] place-items-center bg-[#f3e9df] text-muted">{t("No photo")}</span>}
        </button>
        <button type="button" className="absolute top-3 right-3 grid h-10 w-10 place-items-center rounded-full bg-black/35 text-white" aria-label={t("More")} onClick={() => setMenu((open) => !open)}>
          <Icon name="more" className="h-5 w-5" />
        </button>
        {menu ? (
          <div className="absolute top-14 right-3 overflow-hidden rounded-xl bg-white shadow-lg">
            <button className="block w-full px-4 py-2.5 text-left text-sm" onClick={() => { setMenu(false); setReportOpen(true); }}>{t("Report")}</button>
            <button className="block w-full px-4 py-2.5 text-left text-sm" onClick={async () => { setMenu(false); await api("/v1/blocks", { method: "POST", body: { blocked_id: id } }); setNote(t("This member is blocked.")); }}>{t("Block")}</button>
          </div>
        ) : null}
        {photos.length > 1 ? (
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {photos.map((url, index) => (
              <button key={url} className={`h-1.5 w-6 rounded-full ${index === photo ? "bg-white" : "bg-white/50"}`} onClick={() => setPhoto(index)} aria-label={`${index + 1}`} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">{person.display_name || t("Member")}</h1>
        {person.is_verified ? <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-white">{t("Verified")}</span> : null}
      </div>
      {person.phone ? <p className="mt-3 text-sm font-bold">{t("Phone")}: {person.phone}</p> : null}
      {person.whatsapp_number && person.whatsapp_number !== person.phone ? <p className="mt-1 text-sm font-bold">{t("WhatsApp")}: {person.whatsapp_number}</p> : null}
      {bio ? (
        <div className="mt-3.5 rounded-[14px] border border-[#e8ddcf] bg-cream p-3.5">
          <p className="text-sm font-bold text-maroon">{t("About")}</p>
          <p className="mt-2 text-sm leading-6">{bioOpen || bio.length <= 180 ? bio : `${bio.slice(0, 180).trim()}…`}</p>
          {bio.length > 180 ? <button className="mt-1 text-sm font-semibold text-maroon" onClick={() => setBioOpen((open) => !open)}>{bioOpen ? t("Show less") : t("Show more")}</button> : null}
        </div>
      ) : null}
      <p className="mt-3.5 text-sm">{[person.city, person.state ? tValue(person.state) : ""].filter(Boolean).join(", ") || "—"}</p>
      <p className="mt-1.5 text-sm">{age ? `${age} years` : "—"}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white px-3 py-2.5">
            <p className="text-xs text-muted">{t(label)}</p>
            <p className="mt-0.5 text-sm font-semibold">{tValue(String(value))}</p>
          </div>
        ))}
      </div>
      <Section title={t("Occupation")}>
        <Pair label={t("Occupation")} value={person.occupation} />
        <Pair label={t("Education level")} value={person.education_level} />
        <Pair label={t("Monthly salary")} value={person.monthly_salary} />
      </Section>
      <Section title={t("Astrology")}>
        <Pair label={t("Mangal Dosh")} value={person.mangal_dosh} />
        <Pair label={t("Date of Birth")} value={person.date_of_birth} />
        <Pair label={t("Birth time")} value={person.birth_time} />
        <Pair label={t("Place of birth")} value={person.birth_place} />
      </Section>
      <Section title={t("Partner preference")}>
        <Pair label={t("Age limit")} value={ageRange(partner)} />
        {["location", "height", "diet", "marital_status", "mother_tongue", "mangal_dosh", "occupation", "monthly_salary", "education_level"].map((key) => (
          <Pair key={key} label={t(labelFor(key))} value={pref(partner, key)} />
        ))}
      </Section>
      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      {note ? <p className="mt-4 text-sm text-maroon">{note}</p> : null}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button className="h-12 rounded-xl bg-maroon text-sm font-semibold text-white" onClick={like}>{t("Like")}</button>
        <button className="h-12 rounded-xl bg-maroon/10 text-sm font-semibold text-maroon" onClick={() => router.push(`/chats?with=${id}`)}>{t("Message")}</button>
      </div>
      {reportOpen ? (
        <form
          className="mt-6 space-y-3 rounded-2xl border border-line bg-white p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              await api("/v1/reports", {
                method: "POST",
                body: { reported_profile_id: id, title: report.title, description: report.description, category: report.category, ...(shots.length ? { screenshot_urls: shots.slice(0, 4) } : {}) },
              });
              setReportOpen(false);
              setNote(t("Report submitted. Our team will review it."));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not send the report.");
            }
          }}
        >
          <p className="font-medium">{t("Report this profile")}</p>
          <input className="w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("Title")} value={report.title} onChange={(e) => setReport({ ...report, title: e.target.value })} required />
          <select className="w-full rounded-xl border border-line px-3 py-2 text-sm" value={report.category} onChange={(e) => setReport({ ...report, category: e.target.value })}>
            <option value="scam_fraud">{t("Scam / Fraud")}</option>
            <option value="harassment">{t("Harassment")}</option>
            <option value="fake_profile">{t("Fake profile")}</option>
            <option value="inappropriate">{t("Inappropriate content")}</option>
            <option value="illegal">{t("Illegal / Harmful")}</option>
            <option value="other">{t("Other")}</option>
          </select>
          <textarea className="min-h-24 w-full rounded-xl border border-line px-3 py-2 text-sm" placeholder={t("What happened?")} value={report.description} onChange={(e) => setReport({ ...report, description: e.target.value })} required />
          <PhotoPicker urls={shots} onChange={setShots} maxPhotos={4} kind="report" bucket="report-screenshots" />
          <button className="inline-flex items-center gap-2 rounded-md bg-maroon px-4 py-2 text-sm text-white"><Icon name="send" className="h-4 w-4" /> {t("Submit report")}</button>
        </form>
      ) : null}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#eee6de] bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          {canContact ? (
            <>
              {person.whatsapp_available ? <button className="h-11 flex-1 rounded-xl bg-maroon text-sm font-semibold text-white" onClick={() => reveal("whatsapp")}>{person.whatsapp_revealed && person.whatsapp_number ? person.whatsapp_number : t("WhatsApp")}</button> : null}
              <button className="grid h-11 w-11 place-items-center rounded-xl border border-maroon text-maroon" aria-label={t("Message")} onClick={() => router.push(`/chats?with=${id}`)}><Icon name="message" className="h-5 w-5" /></button>
              {person.phone_available ? <button className="grid h-11 w-11 place-items-center rounded-xl border border-maroon text-maroon" aria-label={t("Call")} onClick={() => reveal("phone")}><Icon name="phone" className="h-5 w-5" /></button> : null}
            </>
          ) : (
            <>
              <p className="flex-1 text-[12.5px] font-semibold leading-5 text-maroon">{t(person.contact_owner_disabled ? "This member hasn't shared contact details. Chat to request." : person.contact_needs_verification ? "Verify your identity to view contact details." : person.contact_locked ? "Verify your identity & upgrade to Premium to view contact details." : "Contact details are not available right now.")}</p>
              <button className="grid h-11 w-11 place-items-center rounded-xl border border-maroon text-maroon" aria-label={t("Chat")} onClick={() => router.push(`/chats?with=${id}`)}><Icon name="message" className="h-5 w-5" /></button>
            </>
          )}
        </div>
      </div>
      {viewer != null && !person.photos_locked ? <PhotoViewer urls={photos} index={viewer} onClose={() => setViewer(null)} /> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded-2xl bg-white p-3.5">
      <p className="text-sm font-bold text-maroon">{title}</p>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function Pair({ label, value }: { label: string; value?: string | number | null }) {
  const shown = value == null || value === "" ? "—" : tValue(String(value));
  return (
    <p className="flex justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-right font-semibold">{shown}</span>
    </p>
  );
}

function pref(partner: Record<string, unknown>, key: string): string {
  const value = partner[key];
  if (value == null) return "All Ok";
  if (Array.isArray(value)) {
    const text = value.map((item) => String(item).trim()).filter(Boolean).join(", ");
    return text || "All Ok";
  }
  const text = String(value).trim();
  return !text || text === "—" || text === "-" ? "All Ok" : text;
}

function ageRange(partner: Record<string, unknown>): string {
  const min = String(partner.age_min ?? "").trim();
  const max = String(partner.age_max ?? "").trim();
  if (min && max) return `${min} - ${max}`;
  return min || max || "All Ok";
}

function labelFor(key: string): string {
  const labels: Record<string, string> = {
    location: "Location", height: "Height", diet: "Diet", marital_status: "Marital status",
    mother_tongue: "Mother tongue", mangal_dosh: "Mangal Dosh", occupation: "Occupation",
    monthly_salary: "Monthly salary", education_level: "Education level",
  };
  return labels[key] || key;
}
