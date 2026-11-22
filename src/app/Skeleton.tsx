// What stands while a part of a screen is read: the shapes of what will stand there, grey, a light
// sweeping across them (the mockup's `Glavnaya-zagruzka`; R168 spec). The screen's own words,
// headings and pictures stand as they will; only what the read brings is a shape. A screen reader
// hears "Loading" once for the part, and the part is busy; under "Reduce motion" the light stands
// still.
import type { CSSProperties, ReactNode } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** A shape of the content to come: its size and its corners, as the content will have them. */
export function Sk({
  width,
  height,
  radius,
  className,
  style,
}: {
  readonly width?: string | number;
  readonly height: string | number;
  readonly radius?: string | number;
  readonly className?: string;
  readonly style?: CSSProperties;
}) {
  return (
    <i
      className={className === undefined ? "nt-sk" : `nt-sk ${className}`}
      aria-hidden="true"
      style={{
        ...(width === undefined ? {} : { inlineSize: width }),
        blockSize: height,
        ...(radius === undefined ? {} : { borderRadius: radius }),
        ...style,
      }}
    />
  );
}

/** A part of a screen being read: busy, its shapes inside, and "Loading" said once. */
export function Loading({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const { words } = useLanguage();
  return (
    <div
      className={className === undefined ? "nt-loading" : `nt-loading ${className}`}
      aria-busy="true"
    >
      <span role="status" className="nt-hidden-label">
        {words.text("wait.label")}
      </span>
      {children}
    </div>
  );
}
