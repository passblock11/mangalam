import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/chrome";

export const metadata: Metadata = { title: "Stories" };

const scenes = [
  {
    image: "/photos/story-cafe.jpg",
    alt: "A couple talking over coffee in daylight",
    title: "A first conversation",
    copy: "After two people like each other, they can write inside Mangalam. The first message is the start of the match. Nothing is sent to a phone number at this step.",
  },
  {
    image: "/photos/story-garden.jpg",
    alt: "A couple standing together in a garden at dusk",
    title: "A meeting you choose",
    copy: "Contact stays inside the app until a member is verified and you have allowed your number to be requested. You can decline, block, or report at any point.",
  },
  {
    image: "/photos/story-wedding.jpg",
    alt: "A couple in wedding clothes walking through a palace corridor",
    title: "A beginning families can follow",
    copy: "Profiles carry community, city, education, and photos so a conversation can move to a family introduction when both people want that. Mangalam does not arrange the wedding.",
  },
];

export default function StoriesPage() {
  return (
    <div className="bg-white">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-3xl px-5 py-16 text-center">
          <p className="text-sm font-medium text-maroon">Illustrated scenes</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">How a match begins</h1>
          <p className="mt-4 text-base leading-7 text-muted">
            These photographs show the kind of moments members look for. They are illustrations. They are not photos, names, or stories of Mangalam members.
          </p>
        </section>
        <div className="mx-auto max-w-6xl space-y-20 px-5 pb-16">
          {scenes.map((scene) => (
            <article key={scene.title} className="grid items-center gap-8 md:grid-cols-2">
              <img src={scene.image} alt={scene.alt} className="h-[520px] w-full rounded-2xl object-cover" />
              <div>
                <h2 className="text-3xl font-semibold">{scene.title}</h2>
                <p className="mt-4 text-base leading-7 text-muted">{scene.copy}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="bg-[#f7f8fa] py-14 text-center">
          <h2 className="text-2xl font-semibold">Create your profile</h2>
          <Link href="/login" className="mt-5 inline-flex h-12 items-center rounded-md bg-maroon px-6 text-sm font-medium text-white">Continue with Google</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
