import type { ReactNode } from "react";

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  function flush(key: string) {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="list-disc space-y-1 pl-5">
        {list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>,
    );
    list = [];
  }

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) {
      flush(`list-${index}`);
      return;
    }
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      return;
    }
    flush(`list-${index}`);
    if (line.startsWith("# ")) {
      blocks.push(<h1 key={index} className="display text-5xl font-semibold text-ink">{line.slice(2)}</h1>);
    } else if (line.startsWith("## ")) {
      blocks.push(<h2 key={index} className="display pt-4 text-3xl font-semibold text-maroon">{line.slice(3)}</h2>);
    } else {
      blocks.push(<p key={index}>{line}</p>);
    }
  });
  flush("list-end");

  return <div className="space-y-4 text-[15px] leading-7 text-ink/90">{blocks}</div>;
}
