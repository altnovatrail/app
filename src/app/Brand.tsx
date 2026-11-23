// The name of the app with its mark, a four-pointed spark: in the sign-in's sky, above the
// owner's profile and "Who is learning?".
// The mark is drawn, hidden from assistive technology; the name is text.
import { APP_NAME } from "./Screen.tsx";
import { SPARK } from "./spark.ts";

/** The mark alone, in the colour of the text, 1em square; with the dot of the sign-in's name. */
export function Spark({ dot = false }: { readonly dot?: boolean }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="1em" height="1em">
      <path d={SPARK} fill="currentColor" />
      {dot ? <circle cx="19" cy="20.5" r="1.6" fill="currentColor" /> : null}
    </svg>
  );
}

/** The mark and the name, in a line of their own. */
export function Brand({
  className,
  dot = false,
}: {
  readonly className: string;
  readonly dot?: boolean;
}) {
  return (
    <p className={className}>
      <Spark dot={dot} />
      <span>{APP_NAME}</span>
    </p>
  );
}
