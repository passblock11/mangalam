import type { ReactNode } from "react";

export type IconName =
  | "add"
  | "arrow-left"
  | "arrow-right"
  | "bell"
  | "briefcase"
  | "cake"
  | "camera"
  | "chat"
  | "check"
  | "chevron-left"
  | "chevron-right"
  | "clock"
  | "close"
  | "compass"
  | "cup"
  | "document"
  | "edit"
  | "eye"
  | "gallery"
  | "globe"
  | "heart"
  | "image"
  | "info"
  | "location"
  | "lock"
  | "logout"
  | "message"
  | "more"
  | "phone"
  | "refresh"
  | "search"
  | "send"
  | "settings"
  | "shield"
  | "translate"
  | "user"
  | "users"
  | "warning"
  | "crown";

const paths: Record<IconName, ReactNode> = {
  add: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  "arrow-left": <path d="M19 12H5M5 12l6-6M5 12l6 6" />,
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  bell: <path d="M6 9a6 6 0 1 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9M10 20a2 2 0 0 0 4 0" />,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
  cake: <><path d="M4 13h16v7H4zM4 17h16" /><path d="M8 13V9m4 4V7m4 6v-3M8 9c.5-1 1.5-1 2 0M12 7c.5-1 1.5-1 2 0M16 10c.5-1 1.5-1 2 0" /></>,
  camera: <><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3.2" /></>,
  chat: <path d="M5 6h14v9H8l-3 3z" />,
  check: <path d="M5 12.5 9.5 17 19 7" />,
  "chevron-left": <path d="M14.5 6 8.5 12l6 6" />,
  "chevron-right": <path d="M9.5 6 15.5 12l-6 6" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4.5l3 2" /></>,
  close: <path d="M7 7l10 10M17 7 7 17" />,
  compass: <><circle cx="12" cy="12" r="8" /><path d="m14.5 9.5-1.2 4.8-4.8 1.2 1.2-4.8z" /></>,
  cup: <path d="M6 8h9v5a4.5 4.5 0 0 1-9 0zM15 9h2.5a2 2 0 0 1 0 4H15M8 20h6" />,
  document: <><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  edit: <path d="M4 20h4l11-11-4-4L4 16zM13 7l4 4" />,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></>,
  gallery: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m7 15 3-3 3 3 2-2 3 3" /><circle cx="8.5" cy="9" r="1" /></>,
  globe: <><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4c2.5 2.4 2.5 13.6 0 16M12 4c-2.5 2.4-2.5 13.6 0 16" /></>,
  heart: <path d="M12 19s-7-4.4-7-8.5A3.5 3.5 0 0 1 12 8a3.5 3.5 0 0 1 7 2.5C19 14.6 12 19 12 19z" />,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m7 15 3-3 7 6" /></>,
  info: <><circle cx="12" cy="12" r="8" /><path d="M12 11v5M12 8h.01" /></>,
  location: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.2" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  logout: <><path d="M10 7V5h9v14h-9v-2" /><path d="M13 12H4m0 0 3-3m-3 3 3 3" /></>,
  message: <path d="M5 6h14v10H8l-3 3z" />,
  more: <><circle cx="6" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  phone: <path d="M8 4h3l1 4-2 1a12 12 0 0 0 5 5l1-2 4 1v3a2 2 0 0 1-2 2A14 14 0 0 1 6 6a2 2 0 0 1 2-2z" />,
  refresh: <path d="M20 12a8 8 0 1 1-2.3-5.6M20 5v5h-5" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  send: <path d="M4 12 20 4l-6 16-2.5-6.5z" />,
  settings: <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2.2" fill="#fff8f3" /><circle cx="15" cy="12" r="2.2" fill="#fff8f3" /><circle cx="8" cy="17" r="2.2" fill="#fff8f3" /></>,
  shield: <path d="M12 3 5 6v6c0 4.5 3 6.8 7 8 4-1.2 7-3.5 7-8V6z" />,
  translate: <path d="M4 6h8M8 6c0 6-3 8-5 9m5-3c1 2 3 3.5 5 4M13 18l4-9 4 9M15 15h4" />,
  user: <><circle cx="12" cy="8" r="3" /><path d="M5 19c1.5-3 3.8-4.5 7-4.5S17.5 16 19 19" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 19c1.2-2.6 3-4 6-4s4.8 1.4 6 4" /><circle cx="17" cy="9" r="2.2" /><path d="M16 15c2 .4 3.4 1.5 4.2 4" /></>,
  warning: <><path d="M12 4 3 19h18z" /><path d="M12 10v4M12 16.5h.01" /></>,
  crown: <path d="M4 17h16l-1.2-8-4.2 3.2L12 6l-2.6 6.2L5.2 9z" />,
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const sized = /(?:^|\s)(?:h-|w-|size-)/.test(className);
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${sized ? "" : "h-5 w-5"} shrink-0 ${className}`.trim()}
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
