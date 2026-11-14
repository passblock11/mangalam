export function PageHero({
  image,
  alt,
  title,
  subtitle,
}: {
  image: string;
  alt: string;
  title: string;
  subtitle: string;
}) {
  return (
    <section className="relative h-72 md:h-80">
      <img src={image} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/25" />
      <div className="relative mx-auto flex h-full max-w-6xl items-end px-5 pb-10 text-white">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-2 max-w-xl text-base text-white/90 md:text-lg">{subtitle}</p>
        </div>
      </div>
    </section>
  );
}
