import type { SVGProps } from "react";

/**
 * The approved icon set, transcribed verbatim from the `<symbol>` sprite at the
 * top of `design-handoff/ODM Supplier Visit.dc.html`.
 *
 * Every icon is a 24×24 line drawing rendered at `stroke-width: 1.5` (README
 * §2, §4). Size is passed in px and applied to both axes; colour is always
 * inherited via `currentColor`.
 */
export const ICON_PATHS = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="8" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="11" width="7" height="10" />
      <rect x="3" y="14" width="7" height="7" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
  factory: (
    <>
      <path d="M3 21h18M5 21V9l6 4V9l6 4V5h3v16" />
      <path d="M8 17h2M14 17h2" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3l1.8 4.5L18.3 9.3l-4.5 1.8L12 15.6l-1.8-4.5L5.7 9.3l4.5-1.8z" />
      <path d="M18.5 15.3l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  template: (
    <>
      <rect x="3" y="3" width="18" height="6" />
      <rect x="3" y="13" width="7" height="8" />
      <rect x="14" y="13" width="7" height="8" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.2-4.2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M20 6L9 17l-5-5" />,
  circle: <circle cx="12" cy="12" r="7" />,
  upload: (
    <>
      <path d="M12 16V4m0 0L8 8m4-4l4 4" />
      <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 15l-5-5L5 20" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12m0 0l4-4m-4 4l-4-4" />
      <path d="M4 18v1a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  x: <path d="M18 6L6 18M6 6l12 12" />,
  alert: (
    <>
      <path d="M10.3 4L2.5 17.2A1.8 1.8 0 0 0 4 20h16a1.8 1.8 0 0 0 1.5-2.8L13.7 4a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  trash: <path d="M3.5 6.5h17M9 6.5V4h6v2.5M18.5 6.5L17.4 20H6.6L5.5 6.5" />,
  pencil: (
    <>
      <path d="M12.5 20H21" />
      <path d="M16.2 3.8a2 2 0 0 1 2.8 2.8L7 18.6l-4 1 1-4z" />
    </>
  ),
  grip: (
    <>
      <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5.2l3.2 2" />
    </>
  ),
  right: <path d="M9 5l7 7-7 7" />,
  left: <path d="M15 5l-7 7 7 7" />,
  down: <path d="M5 9l7 7 7-7" />,
  users: (
    <>
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M2.5 20.5v-1.5a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1.5" />
      <path d="M17 4.2a3.6 3.6 0 0 1 0 6.8M21.5 20.5V19a4.8 4.8 0 0 0-3.5-4.6" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8.5" r="5.5" />
      <path d="M8.4 13.4L7 21.5l5-2.8 5 2.8-1.4-8.1" />
    </>
  ),
  package: (
    <>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
      <path d="M3 8l9 5 9-5M12 13v9" />
    </>
  ),
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" />
      <path d="M10.5 19h3" />
    </>
  ),
  logout: (
    <>
      <path d="M9.5 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.5" />
      <path d="M16 16.5l4.5-4.5L16 7.5M20.5 12H9.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 3.5V9H15" />
    </>
  ),
  link: (
    <>
      <path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2-2a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0l-2 2a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </>
  ),
  camera: (
    <>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.8-2.5h6.4L17 7h3a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13.5" r="3.6" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" />
    </>
  ),
  note: (
    <>
      <path d="M14.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9l5-5V5a2 2 0 0 0-2-2z" />
      <path d="M20 16h-5v5M8 8h7M8 12h5" />
    </>
  ),
  filter: <path d="M3.5 5.5h17l-6.6 7.8v6.2l-3.8-2v-4.2z" />,
  eye: (
    <>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12.5" height="12.5" />
      <path d="M5.5 15H4a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 4 2.5h9.5A1.5 1.5 0 0 1 15 4v1.5" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="4" width="18" height="4" />
      <path d="M5 8v12h14V8M10 12h4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5.5" width="18" height="15" />
      <path d="M8 2.5v5M16 2.5v5M3 11h18" />
    </>
  ),
  "wifi-off": (
    <>
      <path d="M2 4l20 16" />
      <path d="M8.8 13.3a5 5 0 0 1 6 0M5.5 9.8a10 10 0 0 1 4-2.2M12 17.5h.01" />
    </>
  ),
  save: (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M7 3v6h8M8 21v-6h8v6" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </>
  ),
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "title"> {
  name: IconName;
  /** Edge length in px. Defaults to the 14px used across toolbars and buttons. */
  size?: number;
  /** Overrides the 1.5 stroke weight; navigator ticks use 1.8. */
  strokeWidth?: number;
  /**
   * An accessible name for an icon that carries meaning on its own — a warning
   * marker in a list row, say. Renders an SVG `<title>` and drops the
   * `aria-hidden` that decorative icons carry. Icons sitting beside their own
   * label must leave this unset.
   */
  title?: string;
}

export function Icon({
  name,
  size = 14,
  strokeWidth = 1.5,
  title,
  ...props
}: IconProps) {
  const titleId = title ? `icon-${name}-${title.replace(/\W+/g, "-")}` : undefined;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-labelledby={titleId}
      focusable="false"
      {...props}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      {ICON_PATHS[name]}
    </svg>
  );
}
