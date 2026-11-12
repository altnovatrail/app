// The share of the quota of platform AI, "Tutor time", on a profile's page in the section for adults
// (section 15 of the text of the contracts, "The quota"; concepts 14 in spec; R11 in api): read by
// an adult's action when the page opens, the share of the profile's cap and of the account's that
// today's spending takes — in percent, never a sum in dollars and never the cap —, that no work of
// the profile goes to platform AI once a cap is reached, and when the next family day begins, by
// the device's calendar (R37). An account whose tariff has no caps gets no share: platform AI is
// closed to it, and the section says so in one line. An api with no `GetQuota` yet shows no
// section at all, as the legal texts of one that has none are no text (R27). In the device's
// language, as the section is (R10).
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { type ReactNode, useCallback, useId } from "react";
import { adultQuotaTexts, readQuota } from "../account/quota.ts";
import { useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";

export function QuotaSection({ profile }: { readonly profile: Profile }) {
  const { words } = useLanguage();
  const id = useId();
  const profileId = profile.profileId;
  const read = useCallback((api: Api) => readQuota(api, profileId, Action.ADULT), [profileId]);
  const share = useRequest(read);
  let shown: ReactNode;
  if (share.status === "failed") {
    shown = <ReadFailure failure={share.failure} onRetry={share.retry} />;
  } else if (share.status === "done" && share.value !== undefined) {
    // Each line a phrase of its own, and no two alike.
    shown = adultQuotaTexts(share.value, words).map((line) => <p key={line}>{line}</p>);
  }
  // Nothing while it comes, and nothing from an api that has no share to give.
  if (shown === undefined) return null;
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{words.text("quota.title")}</h2>
      <p>{words.text("quota.hint")}</p>
      {shown}
    </section>
  );
}
