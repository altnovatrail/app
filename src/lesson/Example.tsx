// A worked example of a lesson (section 3.4 of docs/architecture.md; R06 in docs/decisions.md): a
// new <novatrail-canvas> for the segment, by its own `key`, given `lang`, the manifest, `media`,
// `workedExample` and then the demo state of this run, if the device keeps one — in this order, for a
// state before the example is a TypeError (the second amendment of 2026-11-01 to R36 in spec). The
// element opens the demo's parts and hides the demo by its own Next and Demo (R42 in canvas), and
// sends `demochange` only on the learner's press: the player keeps its detail, and gives the element
// that same object back. A kept state the element would refuse is not given (run.ts, `demoOf`).
// "Read aloud" above it reads the statement, the lines and the parts of the demo open (R07).
import type { DemoChangeEvent, DemoState, Media } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ReadAloud } from "../voice/ReadAloud.tsx";
import { examplePhrases } from "../voice/texts.ts";

export function Example({
  example,
  manifest,
  media,
  demo,
  onDemo,
}: {
  readonly example: open.WorkedExample;
  readonly manifest: open.Manifest | undefined;
  readonly media: Media;
  /** The demo state of this run, checked; none for a demo from its beginning. */
  readonly demo: DemoState | undefined;
  readonly onDemo: (state: DemoState) => void;
}) {
  const { language } = useLanguage();
  const explanation = manifest?.languages.explanation;
  return (
    <div className="nt-example">
      <ReadAloud
        phrases={examplePhrases(example, demo?.opened ?? 0, demo?.hidden ?? false, explanation)}
        language={explanation}
      />
      {/* The order of the properties is the order React gives them (section 3.1). */}
      <novatrail-canvas
        lang={language}
        {...(manifest === undefined ? {} : { manifest })}
        media={media}
        workedExample={example}
        {...(demo === undefined ? {} : { demoState: demo })}
        ondemochange={(event: DemoChangeEvent) => onDemo(event.detail)}
      />
    </div>
  );
}
