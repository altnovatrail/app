// The page of a module's license (R32 in docs/decisions.md; R62 in spec; sections 3.2 and 3.10 of
// docs/architecture.md): LICENSE and NOTICE of the device part of a version, as they are, each in
// `<pre lang="en">`, and the module by its manifest — its title in its explanation language, its
// version and its license by name. The files come from api by the digest of the package
// (files.ts), and nothing on the page leads out of app (privacy 7 in spec). The page shows at
// `#/license/<digest>` at any step, as the legal pages do, opened from a card of My subjects below
// a bar that closes it home; and in the section for adults as one of its pages (ModulesPage.tsx).
import type * as open from "@altnovatrail/spec/formatv0/open";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useRequest } from "../api/ApiContext.tsx";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { PageBar } from "../app/PageBar.tsx";
import { HOME, MODULE_LICENSE, type Route, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { isDigest } from "./files.ts";
import { type LicenseRead, readLicense } from "./license.ts";
import { usePackages } from "./PackagesContext.tsx";

/** The route of the license of a version, by the digest of its package. */
export function licenseRoute(digest: string): Route {
  return { screen: MODULE_LICENSE.screen, parts: [digest] };
}

/** The digest a route of a license names: its one part, a package digest; none for another. */
export function digestOf(parts: readonly string[]): string | undefined {
  const [digest] = parts;
  return parts.length === 1 && digest !== undefined && isDigest(digest) ? digest : undefined;
}

/**
 * What the page shows of a license read: the module, once its manifest has come, then LICENSE and
 * NOTICE, or that the version is gone.
 */
function Texts({
  read,
  manifest,
}: {
  readonly read: LicenseRead;
  readonly manifest: open.Manifest | undefined;
}) {
  const { words } = useLanguage();
  if (read.withdrawn) return <p>{words.text("api.version-gone")}</p>;
  const { license, notice } = read;
  return (
    <>
      {manifest === undefined ? null : (
        <dl className="nt-terms">
          <dt>{words.text("license.module")}</dt>
          <dd lang={manifest.languages.explanation}>{manifest.title}</dd>
          <dt>{words.text("license.version")}</dt>
          <dd>{manifest.version}</dd>
          <dt>{words.text("license.name")}</dt>
          <dd>{manifest.license}</dd>
        </dl>
      )}
      <h2>{words.text("legal.license-file")}</h2>
      {license === undefined ? (
        <p>{words.text("license.no-license")}</p>
      ) : (
        <pre lang="en" className="nt-notice">
          {license}
        </pre>
      )}
      <h2>{words.text("legal.notice-file")}</h2>
      {notice === undefined ? (
        <p>{words.text("license.no-notice")}</p>
      ) : (
        <pre lang="en" className="nt-notice">
          {notice}
        </pre>
      )}
    </>
  );
}

/**
 * The page itself, for the version of a digest, read each time it opens: through the HTTP cache,
 * which keeps the files (section 3.2). `back` is what the page leads back to below its heading.
 */
export function ModuleLicense({
  digest,
  back,
}: {
  readonly digest: string;
  readonly back?: ReactNode;
}) {
  const { words } = useLanguage();
  const { files, views } = usePackages();
  const read = useCallback(() => readLicense(files, digest), [files, digest]);
  const license = useRequest(read);
  // The manifest apart from the files: one slow to come, or that never does, holds no text back.
  const [manifest, setManifest] = useState<open.Manifest | undefined>(undefined);
  useEffect(() => {
    let current = true;
    setManifest(undefined);
    views.get(digest, "manifest").then(
      (opened) => {
        if (current) setManifest(opened?.view);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [views, digest]);
  let shown: ReactNode = null;
  if (license.status === "failed") {
    shown = <ReadFailure failure={license.failure} onRetry={license.retry} />;
  } else if (license.status === "done") {
    shown = <Texts read={license.value} manifest={manifest} />;
  }
  return (
    <Screen title={words.text("license.title")}>
      {back}
      <p>{words.text("license.intro")}</p>
      {shown}
    </Screen>
  );
}

/**
 * The license of a version at `#/license/<digest>`, below a bar that closes it home: a route that
 * names no digest goes home in place of itself.
 */
export function LicensePages({ route }: { readonly route: Route }) {
  const { words } = useLanguage();
  const digest = digestOf(route.parts);
  useEffect(() => {
    if (digest === undefined) redirect(HOME);
  }, [digest]);
  if (digest === undefined) return null;
  return (
    <>
      <PageBar
        title={words.text("license.bar")}
        close={{ text: words.text("license.close"), to: HOME }}
      />
      <ModuleLicense key={digest} digest={digest} />
    </>
  );
}
