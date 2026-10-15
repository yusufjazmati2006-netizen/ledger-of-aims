import type { SVGProps } from 'react';

/**
 * A small, consistent icon set drawn on a 20×20 grid with 1.5px strokes. Icons are
 * decorative by default (aria-hidden); pass `title` to make one meaningful.
 */
const paths = {
  today: (
    <>
      <circle cx="10" cy="10" r="3.25" />
      <path d="M10 2.75v1.5M10 15.75v1.5M2.75 10h1.5M15.75 10h1.5M4.87 4.87l1.06 1.06M14.07 14.07l1.06 1.06M4.87 15.13l1.06-1.06M14.07 5.93l1.06-1.06" />
    </>
  ),
  book: (
    <>
      <path d="M10 5.5c-1.6-1.2-3.7-1.75-6.25-1.75v11c2.55 0 4.65.55 6.25 1.75 1.6-1.2 3.7-1.75 6.25-1.75v-11c-2.55 0-4.65.55-6.25 1.75Z" />
      <path d="M10 5.5v11" />
    </>
  ),
  dumbbell: (
    <>
      <path d="M3 8v4M5.5 6v8M14.5 6v8M17 8v4M5.5 10h9" />
    </>
  ),
  cap: (
    <>
      <path d="m10 4 7.5 3.5L10 11 2.5 7.5 10 4Z" />
      <path d="M5.5 9v3.5c1.2 1 2.7 1.5 4.5 1.5s3.3-.5 4.5-1.5V9M17.5 7.5v4.5" />
    </>
  ),
  gamepad: (
    <>
      <path d="M6.5 6.25h7a3.75 3.75 0 0 1 3.66 4.57l-.62 2.77a1.9 1.9 0 0 1-3.3.8L12 13H8l-1.24 1.4a1.9 1.9 0 0 1-3.3-.8l-.62-2.78A3.75 3.75 0 0 1 6.5 6.25Z" />
      <path d="M6.75 9v2M5.75 10h2M12.75 9.5h.01M14.25 10.75h.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.25" y="4.5" width="13.5" height="12.25" rx="2" />
      <path d="M3.25 8.25h13.5M7 3v3M13 3v3" />
    </>
  ),
  review: (
    <>
      <path d="M16.25 10a6.25 6.25 0 1 1-1.83-4.42" />
      <path d="M16.5 3.75v3.5H13" />
      <path d="m7.5 10.25 1.75 1.75 3.25-3.5" />
    </>
  ),
  flag: (
    <>
      <path d="M5 17V3.75M5 4.25c3.5-1.5 6 1.5 10 0v7c-4 1.5-6.5-1.5-10 0" />
    </>
  ),
  search: (
    <>
      <circle cx="9" cy="9" r="5.25" />
      <path d="m13 13 4 4" />
    </>
  ),
  settings: (
    <>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 2.75v2M10 15.25v2M2.75 10h2M15.25 10h2M4.87 4.87l1.42 1.42M13.71 13.71l1.42 1.42M4.87 15.13l1.42-1.42M13.71 6.29l1.42-1.42" />
    </>
  ),
  plus: <path d="M10 4.5v11M4.5 10h11" />,
  minus: <path d="M4.5 10h11" />,
  check: <path d="m4.75 10.5 3.5 3.5 7-8" />,
  close: <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />,
  chevronRight: <path d="m8 5 5 5-5 5" />,
  chevronLeft: <path d="m12 5-5 5 5 5" />,
  chevronDown: <path d="m5 8 5 5 5-5" />,
  chevronUp: <path d="m5 12 5-5 5 5" />,
  clock: (
    <>
      <circle cx="10" cy="10" r="6.75" />
      <path d="M10 6.25V10l2.5 1.75" />
    </>
  ),
  play: <path d="M7 5.25v9.5L14.5 10 7 5.25Z" />,
  pause: <path d="M7.25 5.5v9M12.75 5.5v9" />,
  stop: <rect x="5.75" y="5.75" width="8.5" height="8.5" rx="1.25" />,
  trash: (
    <>
      <path d="M4.5 6h11M8 6V4.5h4V6M6 6l.75 10h6.5L14 6" />
    </>
  ),
  edit: (
    <>
      <path d="m12.75 4.5 2.75 2.75-8.25 8.25H4.5v-2.75l8.25-8.25Z" />
    </>
  ),
  grip: (
    <>
      <path
        d="M8 5.5h.01M12 5.5h.01M8 10h.01M12 10h.01M8 14.5h.01M12 14.5h.01"
        strokeWidth="2.25"
      />
    </>
  ),
  info: (
    <>
      <circle cx="10" cy="10" r="6.75" />
      <path d="M10 9v4.5M10 6.5h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10 3.5 17.25 16H2.75L10 3.5Z" />
      <path d="M10 8.5v3.25M10 13.75h.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4.75" y="8.75" width="10.5" height="8" rx="1.75" />
      <path d="M7 8.75V6.5a3 3 0 0 1 6 0v2.25" />
    </>
  ),
  folder: (
    <>
      <path d="M3 6.25a1.5 1.5 0 0 1 1.5-1.5h3.25l1.75 1.75h6a1.5 1.5 0 0 1 1.5 1.5v6.75a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.75v-8.5Z" />
    </>
  ),
  arrowRight: <path d="M4.5 10h11M11 5.5l4.5 4.5-4.5 4.5" />,
  sparkle: (
    <path d="M10 3.5c.4 2.9 1.75 4.6 4.75 5.5-3 .9-4.35 2.6-4.75 5.5-.4-2.9-1.75-4.6-4.75-5.5 3-.9 4.35-2.6 4.75-5.5Z" />
  ),
  moon: <path d="M15.5 12.5A6.25 6.25 0 0 1 7.5 4.5a6.25 6.25 0 1 0 8 8Z" />,
  layers: (
    <>
      <path d="m10 3.75 6.75 3.5L10 10.75 3.25 7.25 10 3.75Z" />
      <path d="m3.25 10.5 6.75 3.5 6.75-3.5M3.25 13.5 10 17l6.75-3.5" />
    </>
  ),
  camera: (
    <>
      <path d="M3.25 7.25a1.5 1.5 0 0 1 1.5-1.5h1.75L8 4h4l1.5 1.75h1.75a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5H4.75a1.5 1.5 0 0 1-1.5-1.5v-7.5Z" />
      <circle cx="10" cy="10.75" r="2.75" />
    </>
  ),
  link: (
    <>
      <path d="M8.5 11.5a3 3 0 0 0 4.24 0l2.5-2.5a3 3 0 1 0-4.24-4.24l-.75.74" />
      <path d="M11.5 8.5a3 3 0 0 0-4.24 0l-2.5 2.5a3 3 0 1 0 4.24 4.24l.74-.74" />
    </>
  ),
  download: <path d="M10 3.75v9M6.25 9 10 12.75 13.75 9M4 16.25h12" />,
  upload: <path d="M10 12.75v-9M6.25 7.5 10 3.75l3.75 3.75M4 16.25h12" />,
  bolt: <path d="M11 2.75 4.75 11.25H10L9 17.25l6.25-8.5H10l1-6Z" />,
} as const;

export type IconName = keyof typeof paths;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  title?: string;
}

export function Icon({ name, size = 18, title, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths[name]}
    </svg>
  );
}
