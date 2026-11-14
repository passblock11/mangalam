import Link from "next/link";
import { ageOf, photoOf, type Profile } from "@/lib/profile";

export function PersonCard({ person }: { person: Profile }) {
  const photo = photoOf(person);
  const age = ageOf(person.date_of_birth, person.age);
  const place = [person.city, person.state].filter(Boolean).join(", ");
  const detail = [person.religion, person.education_level || person.occupation].filter(Boolean).join(" · ");
  return (
    <Link href={`/people/${person.id}`} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[3/4] bg-[#f3f4f6]">
        {photo ? (
          // Photos may be intentionally blurred by the product when sharing is off.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className={`h-full w-full object-cover ${person.photos_locked ? "scale-110 blur-xl" : ""}`} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted">No photo</div>
        )}
        {person.is_verified ? (
          <span className="absolute top-3 left-3 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-maroon shadow-sm">Verified</span>
        ) : null}
      </div>
      <div className="p-3.5">
        <p className="truncate font-semibold">{person.display_name || "Member"}{age ? `, ${age}` : ""}</p>
        <p className="mt-1 truncate text-sm text-muted">{place || "India"}</p>
        {detail ? <p className="mt-0.5 truncate text-xs text-muted">{detail}</p> : null}
      </div>
    </Link>
  );
}
