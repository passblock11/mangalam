import Link from "next/link";
import { SearchLink } from "@/components/search-link";
import { supportEmail } from "@/lib/config";
import { motherTongues, religions } from "@/lib/options";

const featured = ["Agarwal", "Brahmin", "Maratha", "Reddy", "Nadar", "Yadav", "Rajput", "Kamma", "Kapu", "Vanniyar"];

export function SiteHeader({ solid = true }: { solid?: boolean }) {
  return (
    <header className={`sticky top-0 z-40 ${solid ? "border-b border-[#eceff3] bg-white" : "bg-white"}`}>
      <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-5">
        <Link href="/" className="text-[26px] font-semibold tracking-tight text-maroon">
          Mangalam
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/help" className="px-2 text-sm font-medium text-[#3d4451] hover:text-maroon">
            Help
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[#d5d9e2] px-5 py-2 text-sm font-medium text-[#2c313a] hover:border-maroon hover:text-maroon"
          >
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const columns = [
    ["Need help", [
      ["Member login", "/login"],
      ["Create a profile", "/login"],
      ["Partner search", "/search"],
      ["How Mangalam works", "/how-it-works"],
      ["Membership", "/pricing"],
      ["Customer support", "/help"],
      ["Be safe online", "/safety"],
    ]],
    ["Company", [
      ["About", "/about"],
      ["Stories", "/stories"],
      ["Communities", "/communities"],
      ["Contact", "/contact"],
    ]],
    ["Policies", [
      ["Privacy policy", "/privacy"],
      ["Terms of service", "/terms"],
      ["Refund and cancellation", "/refund"],
      ["Report misuse", "/login"],
    ]],
  ] as const;

  return (
    <footer className="border-t border-[#eceff3] bg-white">
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <p className="text-2xl font-semibold text-maroon">Mangalam</p>
            <p className="mt-3 text-sm leading-6 text-muted">
              A matrimonial platform for adults looking for a verified life partner. The same account works on the phone and on this website.
            </p>
            <a href={`mailto:${supportEmail}`} className="mt-4 block text-sm text-maroon">{supportEmail}</a>
          </div>
          {columns.map(([title, links]) => (
            <div key={title}>
              <p className="text-sm font-semibold">{title}</p>
              <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
                {links.map(([label, href]) => (
                  <Link key={label} href={href} className="hover:text-maroon">{label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <p className="text-sm font-semibold">Browse by community</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
            {featured.map((name) => (
              <SearchLink key={name} label={`${name} matrimony`} patch={{ community: name }} className="hover:text-maroon" />
            ))}
            <Link href="/communities" className="font-medium text-maroon">More communities</Link>
          </div>
        </div>
        <div className="mt-8">
          <p className="text-sm font-semibold">Browse by religion</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
            {religions.filter((item) => item !== "Other").map((name) => (
              <SearchLink key={name} label={`${name} matches`} patch={{ religion: name }} className="hover:text-maroon" />
            ))}
          </div>
        </div>
        <div className="mt-8">
          <p className="text-sm font-semibold">Browse by mother tongue</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
            {motherTongues.filter((item) => item !== "Other").map((name) => (
              <SearchLink key={name} label={name} patch={{ mother_tongue: name }} className="hover:text-maroon" />
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-[#eceff3] px-5 py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} Mangalam. Photographs on this website are illustrations, not photos of members.
      </div>
    </footer>
  );
}
