"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { api } from "@/lib/api";
import { t, tf, tValue, useLocale } from "@/lib/i18n";
import { ageOf, type Profile } from "@/lib/profile";

const tabs = [
  ["liked", "Like"],
  ["mutual", "Matches"],
  ["views", "Views"],
  ["contacts", "Contacts"],
] as const;

type Item = { profile?: Profile; liked_at?: string; matched_at?: string; viewed_at?: string; contacted_at?: string };

const emptyCopy: Record<(typeof tabs)[number][0], [string, string]> = {
  liked: ["No likes yet", "People who liked you are here. Like them back and they move to Matches."],
  mutual: ["No matches yet", "Your mutual matches will appear here."],
  views: ["No views yet", "Profiles that viewed you will show up here."],
  contacts: ["No contacts yet", "Profiles you contacted will appear here."],
};

export default function ConnectionsPage() {
  useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("liked");
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let stop = false;
    api<{ items?: Array<Profile | Item> }>("/v1/likes", { query: { tab } })
      .then((data) => {
        if (stop) return;
        setItems(
          (data.items ?? []).map((item) => ("profile" in item && item.profile ? item : { profile: item as Profile })),
        );
      })
      .catch((err: Error) => {
        if (!stop) setError(err.message);
      });
    return () => {
      stop = true;
    };
  }, [tab]);

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto border-b border-[#e8ddcf]">
        {tabs.map(([value, label]) => (
          <button key={value} className={`shrink-0 px-4 py-3 text-sm font-semibold ${tab === value ? "border-b-2 border-maroon text-maroon" : "text-muted"}`} onClick={() => setTab(value)}>
            {t(label)}
          </button>
        ))}
      </div>
      {error ? <p className="mt-4 text-sm text-maroon">{error}</p> : null}
      {items.length === 0 && !error ? (
        <div className="px-6 py-16 text-center">
          <p className="text-lg font-semibold">{t(emptyCopy[tab][0])}</p>
          <p className="mt-2 text-sm leading-6 text-muted">{t(emptyCopy[tab][1])}</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {items.map((item) => item.profile?.id ? <ConnectionRow key={item.profile.id} item={item} tab={tab} onMessage={() => message(item.profile as Profile, router)} /> : null)}
        </div>
      )}
    </div>
  );
}

function when(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return t("Just now");
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

async function message(person: Profile, router: ReturnType<typeof useRouter>) {
  const name = person.display_name || t("Member");
  const data = await api<{ conversation_id?: string }>("/v1/conversations", {
    method: "POST",
    body: { other_profile_id: person.id, first_message: tf("Hi {name}, I saw your profile and wanted to connect.", { name }) },
  });
  if (data.conversation_id) router.push(`/chats/${data.conversation_id}`);
}

function ConnectionRow({ item, tab, onMessage }: { item: Item; tab: (typeof tabs)[number][0]; onMessage: () => void }) {
  const person = item.profile as Profile;
  const name = person.display_name || t("Member");
  const photo = person.photo_urls?.[0];
  const age = ageOf(person.date_of_birth, person.age);
  const detail = [age ? tf("{n} yrs", { n: String(age) }) : "", person.community, person.mother_tongue ? tValue(person.mother_tongue) : ""].filter(Boolean).join(" · ");
  const place = [person.city, person.state ? tValue(person.state) : ""].filter(Boolean).join(", ");
  const stamp = tab === "liked" ? item.liked_at : tab === "mutual" ? item.matched_at : tab === "views" ? item.viewed_at : item.contacted_at;
  const stampLabel = tab === "liked" ? "Liked {when}" : tab === "mutual" ? "Matched {when}" : tab === "views" ? "Seen {when}" : "Contacted {when}";
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-2.5">
      <Link href={`/people/${person.id}`} className="grid h-[60px] w-[60px] shrink-0 place-items-center overflow-hidden rounded-[14px] bg-[#f3e9df] text-lg font-semibold text-maroon">
        {photo && !person.photos_locked ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="h-full w-full object-cover" />
        ) : name[0]}
      </Link>
      <Link href={`/people/${person.id}`} className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-base font-bold">{name}</span>
          {person.is_verified ? <span className="text-xs text-maroon">✓</span> : null}
        </span>
        {detail ? <span className="mt-0.5 block truncate text-[12.5px] text-muted">{detail}</span> : null}
        {place ? <span className="mt-0.5 block truncate text-xs text-muted">{place}</span> : null}
        {stamp ? <span className="mt-1 block text-[11.5px] font-semibold text-maroon">{tf(stampLabel, { when: when(stamp) })}</span> : null}
      </Link>
      <button className="grid h-10 w-10 place-items-center rounded-full bg-maroon/10 text-maroon" aria-label={t("Message")} onClick={onMessage}>
        <Icon name="message" className="h-5 w-5" />
      </button>
      {person.phone ? (
        <a className="grid h-10 w-10 place-items-center rounded-full bg-gold/15 text-gold" aria-label={t("Call")} href={`tel:${person.phone.replace(/\s/g, "")}`}>
          <Icon name="phone" className="h-5 w-5" />
        </a>
      ) : (
        <Link href={`/people/${person.id}`} className="grid h-10 w-10 place-items-center rounded-full bg-gold/15 text-gold" aria-label={t("Call")}>
          <Icon name="phone" className="h-5 w-5" />
        </Link>
      )}
    </div>
  );
}
