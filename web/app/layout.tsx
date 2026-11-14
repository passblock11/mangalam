import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://mangalam-web-beta.vercel.app"),
  title: {
    default: "Mangalam — Find a verified life partner",
    template: "%s · Mangalam",
  },
  description:
    "Mangalam is a matrimonial platform for adults seeking marriage. Create a verified profile, discover matches, and connect through the app or the website.",
  openGraph: {
    title: "Mangalam — Find a verified life partner",
    description:
      "A matrimonial platform built on identity verification, privacy, and meaningful connections.",
    type: "website",
    images: [{ url: "/photos/hero-couple.jpg", width: 1200, height: 675, alt: "A couple in a sandstone courtyard" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
