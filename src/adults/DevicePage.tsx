// The page This device in the section for adults (R04 with its 2026-11-12 amendment; section 3.2 of
// docs/architecture.md): what app keeps on this device, by profile — its unfinished work and about
// how much space its data takes — and for the whole site — the browser's estimate, whether it agreed
// to keep the data, and what the browser and Safari may erase by themselves, with the Home Screen
// for advice. A profile's data and everything are erased here, each asked first (WCAG 3.3.4);
// everything signs out too. While api keeps no copy of a profile's work, the page says that the
// work is on this device alone (R113 in spec). After the profiles, the voices of the device and on
// Android and Linux the leave for voicing (R07; ../voice/DeviceVoices.tsx). The places of what comes
// later are marked: the essays (T47) and the own key (T46).
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Screen } from "../app/Screen.tsx";
import { sizeText } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { type SiteStorage, siteStorage } from "../storage/browser.ts";
import type { Device } from "../storage/device.ts";
import { eraseProfile } from "../storage/erase.ts";
import { profileUsage, type Usage } from "../storage/profile.ts";
import { DeviceVoices } from "../voice/DeviceVoices.tsx";
import { inOrder } from "./order.ts";

/**
 * What this device keeps of a profile: its usage, nothing, a database whose erasure waits for the
 * browser, or one that could not be read.
 */
type OnDevice =
  | { readonly kind: "kept"; readonly usage: Usage }
  | { readonly kind: "none" }
  | { readonly kind: "erasing" }
  | { readonly kind: "unreadable" };

/**
 * Whether api keeps a copy of the profile's work. None yet, whatever `work_storage` says: api writes
 * the consent and keeps no copy, and the contract has no request that would send one (Д12 api; В53
 * and Д16 in RUN.md), so the warning of its loss stands for every profile, its storage switched on
 * too (R30). The words of the profile's page that say so change with this.
 */
function copiedOnServer(_profile: Profile): boolean {
  return false;
}

async function onDevice(device: Device, profileId: string): Promise<OnDevice> {
  try {
    const usage = await profileUsage(device, profileId);
    if (usage === undefined) return { kind: "none" };
    return usage === "erasing" ? { kind: "erasing" } : { kind: "kept", usage };
  } catch {
    return { kind: "unreadable" };
  }
}

/**
 * A button that erases, and the question it asks first: the question takes the focus, and gives it
 * back when it is answered no, or yes and the button is still there.
 */
function Erase({
  label,
  question,
  onErase,
}: {
  readonly label: string;
  readonly question: string;
  readonly onErase: () => Promise<void>;
}) {
  const { words } = useLanguage();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const yes = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (confirming) yes.current?.focus();
    else if (asked.current) button.current?.focus();
    asked.current = confirming;
  }, [confirming]);
  if (!confirming) {
    return (
      <div className="nt-buttons">
        <button
          ref={button}
          type="button"
          className="nt-secondary"
          onClick={() => setConfirming(true)}
        >
          {label}
        </button>
      </div>
    );
  }
  return (
    <fieldset className="nt-buttons">
      <legend>{question}</legend>
      {/* Not disabled while it is under way: a disabled button would drop the focus. */}
      <button
        ref={yes}
        type="button"
        aria-disabled={pending}
        onClick={() => {
          if (pending) return;
          setPending(true);
          void onErase().finally(() => {
            setPending(false);
            setConfirming(false);
          });
        }}
      >
        {words.text("device.erase")}
      </button>
      <button type="button" className="nt-secondary" onClick={() => setConfirming(false)}>
        {words.text("common.cancel")}
      </button>
    </fieldset>
  );
}

/** What the page has read of the device: each profile, and the browser's estimate for the site. */
interface Read {
  readonly kept: ReadonlyMap<string, OnDevice>;
  readonly estimate: Awaited<ReturnType<SiteStorage["estimate"]>>;
}

/** What the page says once an erasure is done: what came of it, or that it did not go through. */
type Said = { readonly status: string } | { readonly alert: string };

function Saying({ said }: { readonly said: Said | undefined }) {
  return (
    <>
      <p role="status">{said !== undefined && "status" in said ? said.status : null}</p>
      {said !== undefined && "alert" in said ? (
        <p role="alert" className="nt-error">
          {said.alert}
        </p>
      ) : null}
    </>
  );
}

/** A profile on this device: what it keeps here, and its erasure. */
function ProfileOnDevice({
  device,
  profile,
  kept,
  onErased,
}: {
  readonly device: Device;
  readonly profile: Profile;
  /** Not read yet when left out. */
  readonly kept: OnDevice | undefined;
  readonly onErased: () => void;
}) {
  const { language, words } = useLanguage();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [said, setSaid] = useState<Said | undefined>(undefined);
  // All of it erased: nothing is left to erase, its button goes, and the focus comes to the heading.
  // What the browser did not delete keeps the button, to erase again.
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (gone) heading.current?.focus();
  }, [gone]);
  return (
    <section aria-labelledby={id}>
      <h3 id={id} ref={heading} tabIndex={-1}>
        {words.text("adults.profile", { pseudonym: profile.pseudonym })}
      </h3>
      {kept?.kind === "kept" ? (
        <p>{words.text("device.unfinished", { count: kept.usage.unfinished })}</p>
      ) : null}
      {kept?.kind === "kept" && kept.usage.bytes !== undefined ? (
        <p>{words.text("device.size", { size: sizeText(language, kept.usage.bytes) })}</p>
      ) : null}
      {kept?.kind === "none" ? <p>{words.text("device.none")}</p> : null}
      {/* Erased, as far as the browser let it: the rest the next start erases. */}
      {kept?.kind === "erasing" ? <p>{words.text("device.left")}</p> : null}
      {kept?.kind === "unreadable" || (kept?.kind === "kept" && kept.usage.bytes === undefined) ? (
        <p>{words.text("device.unreadable")}</p>
      ) : null}
      {/* T47: the profile's essays, each with its own Erase (R04). */}
      {/* T46: on the owner's profile, the own key kept on this device and Remove key (R08). */}
      {copiedOnServer(profile) ? null : <p>{words.text("device.only-here")}</p>}
      {kept === undefined || kept.kind === "none" || gone ? null : (
        <Erase
          label={words.text("device.erase-profile")}
          question={words.text("device.erase-profile-confirm", { pseudonym: profile.pseudonym })}
          onErase={async () => {
            setSaid(undefined);
            try {
              const all = await eraseProfile(device, profile.profileId);
              setSaid({ status: words.text(all ? "device.erased" : "device.left") });
              if (all) setGone(true);
              onErased();
            } catch {
              setSaid({ alert: words.text("device.erase-failed") });
            }
          }}
        />
      )}
      <Saying said={said} />
    </section>
  );
}

/** Whether the browser agreed to keep the site's data, and the button that asks it to. */
function Keeping({ site }: { readonly site: SiteStorage }) {
  const { words } = useLanguage();
  // Not read yet, or a browser with nothing to tell: then nothing is said, and nothing asked.
  const [persisted, setPersisted] = useState<boolean | "unknown" | undefined>(undefined);
  const [asked, setAsked] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    let current = true;
    void site.persisted().then((kept) => {
      if (current) setPersisted(kept ?? "unknown");
    });
    return () => {
      current = false;
    };
  }, [site]);
  if (persisted === undefined || persisted === "unknown") return null;
  return (
    <>
      {/* Once asked, the answer below says it, and this line would contradict it. */}
      {asked === undefined ? (
        <p>{words.text(persisted ? "device.persisted" : "device.not-persisted")}</p>
      ) : null}
      {persisted || asked !== undefined ? null : (
        <div className="nt-buttons">
          <button
            type="button"
            className="nt-secondary"
            onClick={() => void site.persist().then(setAsked)}
          >
            {words.text("device.persist")}
          </button>
        </div>
      )}
      <p role="status">
        {asked === undefined ? null : words.text(asked ? "device.persisted" : "device.refused")}
      </p>
    </>
  );
}

export function DevicePage({
  device,
  profiles,
  onEraseAll,
  site = siteStorage,
}: {
  readonly device: Device;
  /** The profiles of the account, as the session has them now. */
  readonly profiles: readonly Profile[];
  /** "Erase everything on this device": the sign-out with the device's own data. */
  readonly onEraseAll: () => Promise<"erased" | "left" | "failed">;
  /** What the browser tells of the site's storage: its own when left out. */
  readonly site?: SiteStorage;
}) {
  const { language, words } = useLanguage();
  const sorted = useMemo(() => inOrder(profiles, language), [profiles, language]);
  const [read, setRead] = useState<Read | undefined>(undefined);
  const [said, setSaid] = useState<Said | undefined>(undefined);
  // What the device keeps: read when the page opens, and again after each erasure. Only the last
  // read asked is shown, and none once the page has gone.
  const reads = useRef(0);
  const reload = useCallback(() => {
    reads.current += 1;
    const asked = reads.current;
    void (async () => {
      const found = await Promise.all(
        profiles.map(
          async ({ profileId }) => [profileId, await onDevice(device, profileId)] as const,
        ),
      );
      const estimate = await site.estimate();
      if (reads.current === asked) setRead({ kept: new Map(found), estimate });
    })();
  }, [device, profiles, site]);
  useEffect(() => {
    reload();
    return () => {
      reads.current += 1;
    };
  }, [reload]);
  const { kept, estimate } = read ?? {};
  return (
    <Screen title={words.text("device.title")}>
      <h2>{words.text("adults.profiles")}</h2>
      {sorted.map((profile) => (
        <ProfileOnDevice
          key={profile.profileId}
          device={device}
          profile={profile}
          kept={kept?.get(profile.profileId)}
          onErased={reload}
        />
      ))}
      <DeviceVoices device={device} />
      {estimate === undefined ? null : (
        <>
          <h2>{words.text("device.space")}</h2>
          <p>
            {words.text("device.estimate", {
              usage: sizeText(language, estimate.usage),
              quota: sizeText(language, estimate.quota),
            })}
          </p>
        </>
      )}
      <h2>{words.text("device.keeping")}</h2>
      <Keeping site={site} />
      <p>{words.text("device.browser-erases")}</p>
      <p>{words.text("device.home-screen")}</p>
      <h2>{words.text("device.erase-all")}</h2>
      <Erase
        label={words.text("device.erase-all")}
        question={words.text("device.erase-all-confirm")}
        onErase={async () => {
          setSaid(undefined);
          // Done, the session signs out and the page goes; only a failure is the page's to say.
          if ((await onEraseAll()) === "failed") {
            setSaid({ alert: words.text("device.erase-all-failed") });
          }
        }}
      />
      <Saying said={said} />
    </Screen>
  );
}
