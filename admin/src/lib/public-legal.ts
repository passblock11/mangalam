/** Minimal Markdown → HTML for public legal pages. Input is escaped first. */
export function markdownToHtml(src: string): string {
  const escaped = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(
        /\[(.+?)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" rel="noopener noreferrer">$1</a>'
      );
  const lines = escaped.split(/\n/);
  let html = "";
  let inList = false;
  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      closeList();
      continue;
    }
    if (t.startsWith("- ") || t.startsWith("* ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${inline(t.slice(2))}</li>`;
      continue;
    }
    closeList();
    if (t.startsWith("### ")) html += `<h3>${inline(t.slice(4))}</h3>`;
    else if (t.startsWith("## ")) html += `<h2>${inline(t.slice(3))}</h2>`;
    else if (t.startsWith("# ")) html += `<h2>${inline(t.slice(2))}</h2>`;
    else html += `<p>${inline(t)}</p>`;
  }
  closeList();
  return html;
}

export type PublicLegalPage = {
  slug: string;
  title: string;
  body?: string;
  updated_at?: string;
};

function apiBase() {
  return (process.env.BACKEND_URL ?? "https://mangalam-api.vercel.app").replace(/\/$/, "");
}

export async function fetchPublishedLegalPages(): Promise<PublicLegalPage[]> {
  const res = await fetch(`${apiBase()}/v1/config/legal`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { pages?: PublicLegalPage[] };
  return json.pages ?? [];
}

export async function fetchPublishedLegalPage(
  slug: string
): Promise<PublicLegalPage | null> {
  const res = await fetch(`${apiBase()}/v1/config/legal/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { page?: PublicLegalPage };
  return json.page ?? null;
}
