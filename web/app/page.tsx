import Link from "next/link";
import { FaqList, homeFaqs } from "@/components/faq-list";
import { HomeSearch } from "@/components/home-search";
import { SiteFooter, SiteHeader } from "@/components/chrome";
import { SearchLink } from "@/components/search-link";
import { publicConfig } from "@/lib/config";
import { inr } from "@/lib/profile";

type Plan = {
  code: string;
  name: string;
  description?: string | null;
  plan_type?: string;
  price_paise: number;
  is_active?: boolean | null;
};

const communities = ["Agarwal", "Brahmin", "Maratha", "Reddy", "Nadar", "Yadav", "Rajput", "Kamma", "Kapu", "Vanniyar"];

const experiences = [
  {
    image: "/photos/experience-profile.jpg",
    alt: "A woman reading a profile on her phone by a bright window",
    title: "A profile your family can read",
    copy: "Community, city, education, and photos sit on one page, so a family can understand who someone is before anyone writes.",
  },
  {
    image: "/photos/experience-verify.jpg",
    alt: "A closed identity booklet beside a phone on a wooden desk",
    title: "Identity is reviewed",
    copy: "A selfie and a government ID are checked before contact details can be shared. A verified profile is marked on the card.",
  },
  {
    image: "/photos/experience-family.jpg",
    alt: "A couple sitting with parents over tea in a bright living room",
    title: "Room for the family",
    copy: "Likes, messages, and phone requests stay in your control. You decide when a conversation becomes a family introduction.",
  },
];

const stories = [
  {
    href: "/stories",
    image: "/photos/story-cafe.jpg",
    alt: "A couple talking over coffee in daylight",
    title: "A first conversation",
    copy: "Two people match, then write when they are both ready.",
  },
  {
    href: "/stories",
    image: "/photos/story-garden.jpg",
    alt: "A couple standing together in a garden at dusk",
    title: "A meeting you choose",
    copy: "Phone numbers stay hidden until a verified member is allowed to ask.",
  },
  {
    href: "/stories",
    image: "/photos/story-wedding.jpg",
    alt: "A couple in wedding clothes walking through a palace corridor",
    title: "A beginning with family",
    copy: "The profile is built so parents can read it with you.",
  },
];

async function loadPlans(): Promise<Plan[]> {
  try {
    const res = await fetch(`${publicConfig.apiBase}/v1/config/plans`, { next: { revalidate: 120 } });
    if (!res.ok) return [];
    const data = (await res.json()) as { plans?: Plan[] };
    return (data.plans ?? []).filter((plan) => plan.is_active !== false);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const plans = await loadPlans();
  const memberships = plans.filter((plan) => plan.plan_type === "subscription" || plan.plan_type === "one_time");
  const shown = (memberships.length ? memberships : plans).slice(0, 3);

  return (
    <div className="bg-white">
      <SiteHeader />
      <section className="relative min-h-[760px]">
        <img
          src="/photos/hero-couple.jpg"
          alt="A couple in a sandstone courtyard, looking at each other"
          className="absolute inset-0 h-full w-full object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/45 to-black/70" />
        <div className="relative mx-auto flex min-h-[760px] max-w-3xl flex-col justify-center px-5 py-16 text-center text-white">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">Find a partner for life.</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-white/95 md:text-xl">
            Search by age, religion, and mother tongue. Verify your identity. Keep your number private.
          </p>
          <div className="mt-8">
            <HomeSearch tone="overlay" />
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-white">
            <span>Profiles are reviewed</span>
            <span>Numbers stay hidden</span>
            <span>One account on phone and web</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-3xl font-semibold tracking-tight">The Mangalam experience</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {experiences.map((item) => (
            <article key={item.title} className="overflow-hidden rounded-2xl border border-[#eceff3] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.05)]">
              <img src={item.image} alt={item.alt} className="h-52 w-full object-cover" />
              <div className="p-5">
                <h3 className="text-xl font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#f7f8fa] py-16">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">How a match begins</h2>
              <p className="mt-2 text-sm text-muted">Illustrated scenes. These are not photographs of Mangalam members.</p>
            </div>
            <Link href="/stories" className="hidden text-sm font-medium text-maroon sm:inline">See the journey</Link>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {stories.map((item) => (
              <Link key={item.title} href={item.href} className="group relative block h-[440px] overflow-hidden rounded-2xl">
                <img src={item.image} alt={item.alt} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-xl font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-white/90">{item.copy}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="flex items-end justify-between">
          <h2 className="text-3xl font-semibold tracking-tight">Browse by community</h2>
          <Link href="/communities" className="text-sm font-medium text-maroon">More communities</Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {communities.map((name) => (
            <SearchLink
              key={name}
              label={`${name} matrimony`}
              patch={{ community: name }}
              className="rounded-full border border-[#e4e7ee] bg-white px-4 py-2 text-sm hover:border-maroon hover:text-maroon"
            />
          ))}
        </div>
      </section>

      {shown.length ? (
        <section className="bg-[#f7f8fa] py-16">
          <div className="mx-auto max-w-6xl px-5">
            <div className="flex items-end justify-between">
              <h2 className="text-3xl font-semibold tracking-tight">Membership</h2>
              <Link href="/pricing" className="text-sm font-medium text-maroon">View all</Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {shown.map((plan) => (
                <article key={plan.code} className="rounded-2xl border border-[#eceff3] bg-white p-6">
                  <p className="text-xs font-medium tracking-wide text-muted uppercase">Membership</p>
                  <h3 className="mt-2 text-2xl font-semibold">{plan.name}</h3>
                  <p className="mt-3 text-3xl font-semibold text-maroon">{inr(plan.price_paise)}</p>
                  <p className="mt-3 min-h-12 text-sm leading-6 text-muted">{plan.description || "Available after you sign in."}</p>
                  <Link href="/login" className="mt-5 inline-flex h-11 items-center rounded-md bg-maroon px-5 text-sm font-medium text-white">Continue</Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-3xl px-5 py-16">
        <h2 className="text-center text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-8">
          <FaqList items={homeFaqs} />
        </div>
        <div className="mt-10 space-y-4 text-sm leading-7 text-muted">
          <p>
            Mangalam is a matrimonial platform for adults who are looking for marriage. You create one profile, add your community and photos, and search people by age, religion, mother tongue, and community. The same profile opens in the Mangalam phone app and on this website.
          </p>
          <p>
            Contact details stay private until identity is reviewed and you allow a request. Memberships and contact-credit packs are optional. Prices shown here are the prices charged in Indian rupees through Razorpay after you sign in.
          </p>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
