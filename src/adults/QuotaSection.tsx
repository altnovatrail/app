// The share of the quota of platform AI, "Tutor time", on a profile's page in the section for
// adults (the contract's quota): read by an adult's action when the page opens, the share
// of the profile's cap and of the account's that today's spending takes — in percent, never a sum
// in dollars and never the cap —, that no work of the profile goes to platform AI once a cap is
// reached, and when the next family day begins, by the device's calendar. An account whose
// tariff has no caps gets no share: platform AI is closed to it, and the section says so in one
// line. While the share is read, the section stands with the shapes of its lines; an
// api with no `GetQuota` yet then takes the section away, as the legal texts of one that has none
// are no text. In the device's language, as the section is.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { type ReactNode, useCallback, useId } from "react";
import { adultQuotaTexts, readQuota } from "../account/quota.ts";
import { useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";

export function QuotaSection({ profile }: { readonly profile: Profile }) {
  const { words } = useLanguage();
  const id = useId();
  const profileId = profile.profileId;
  const read = useCallback((api: Api) => readQuota(api, profileId, Action.ADULT), [profileId]);
  const share = useRequest(read);
  let shown: ReactNode;
  if (share.status === "loading") {
    shown = (
      <Loading>
        <Sk width="16rem" height="0.875rem" radius="0.3125rem" />
        <Sk width="11rem" height="0.875rem" radius="0.3125rem" />
      </Loading>
    );
  } else if (share.status === "failed") {
    shown = <ReadFailure failure={share.failure} onRetry={share.retry} />;
  } else if (share.status === "done" && share.value !== undefined) {
    // Each line a phrase of its own, and no two alike.
    shown = adultQuotaTexts(share.value, words).map((line) => <p key={line}>{line}</p>);
  }
  // Nothing from an api that has no share to give.
  if (shown === undefined) return null;
  return (
    <section className="nt-group" aria-labelledby={id}>
      <h2 id={id}>{words.text("quota.title")}</h2>
      <p className="nt-hint">{words.text("quota.hint")}</p>
      {shown}
    </section>
  );
}
