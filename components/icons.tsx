import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function ArrowUpRight(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export function Check(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <path d="m5 12 4.2 4.2L19 6.5" />
    </svg>
  );
}

export function ChevronDown(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <path d="m7 9.5 5 5 5-5" />
    </svg>
  );
}

export function Clock(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 1.8" />
    </svg>
  );
}

export function Close(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}

export function Network(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <rect x="4" y="4" width="6" height="5" rx="1" />
      <rect x="14" y="15" width="6" height="5" rx="1" />
      <path d="M10 6.5h4a3 3 0 0 1 3 3V15M7 9v5a3 3 0 0 0 3 3h4" />
    </svg>
  );
}

export function Refresh(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <path d="M19 8a7.5 7.5 0 1 0 .4 7M19 4v4h-4" />
    </svg>
  );
}

export function Spark(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...base} {...props}>
      <path d="M12 3c.5 5 3 7.5 8 8-5 .5-7.5 3-8 8-.5-5-3-7.5-8-8 5-.5 7.5-3 8-8Z" />
    </svg>
  );
}
