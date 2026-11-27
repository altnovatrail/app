// Tutor time at the top right of Home, Subjects and the skill map, as the mockup's `home-quota`: a
// ring of the share of today's quota of platform AI the learner's profile has used — by the
// learner's action, so never the account's —, and its pop-over: what the share means, its number
// in the ring alone, when it renews, what spends it, and the way to the section for adults, where
// the account's share stands. While the share is read the ring is a shape; a share that did not
// come, or an api with no `GetQuota`, or a tariff with no caps, leaves no ring.
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { useCallback } from "react";
import { useLearner } from "../account/AccountGate.tsx";
import { type Ring, readQuota, ringOf } from "../account/quota.ts";
import { useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { BELOW_BAR } from "./hang.ts";
import { Icon } from "./Icon.tsx";
import { MenuRow } from "./LearnerMenu.tsx";
import { PopOver } from "./PopOver.tsx";
import { ADULTS, navigate } from "./router.ts";
import { Loading, Sk } from "./Skeleton.tsx";

/** The length of the ring's circle, r 15.5 in a box of 36: what its dashes are measured in. */
const AROUND = 97.4;

/** The ring itself, 32 in the button and 56 in the pop-over: its arc, and the number or the sign. */
export function RingMark({ ring, big = false }: { readonly ring: Ring; readonly big?: boolean }) {
  const dash =
    ring.level === "fresh"
      ? `0 ${AROUND}`
      : ring.level === "out"
        ? `${AROUND} 0`
        : `${((ring.fill * AROUND) / 100).toFixed(1)} ${AROUND}`;
  const sign = ring.level === "fresh" || ring.level === "out";
  return (
    <span
      className={big ? "nt-ring nt-ring-big" : "nt-ring"}
      data-level={ring.level}
      aria-hidden="true"
    >
      <svg className="nt-ring-face" viewBox="0 0 36 36" focusable="false" aria-hidden="true">
        <circle className="nt-ring-track" cx="18" cy="18" r="15.5" />
        <circle
          className="nt-ring-arc"
          cx="18"
          cy="18"
          r="15.5"
          strokeDasharray={dash}
          transform="rotate(-90 18 18)"
        />
      </svg>
      {sign ? (
        <span className="nt-ring-sign">
          <Icon value={ring.level === "out" ? "quota-out" : "quota-fresh"} chosen />
        </span>
      ) : (
        <b>{big ? ring.percent : ring.number}</b>
      )}
    </span>
  );
}

/** The ring's button and its pop-over, for the share read. */
export function TutorTimeRing({ ring }: { readonly ring: Ring }) {
  const { words } = useLanguage();
  return (
    <PopOver
      label={words.text("quota.title")}
      caption={<RingMark ring={ring} />}
      buttonLabel={ring.name}
      tip={{ words: words.text("quota.title"), needed: () => true }}
      className="nt-icon-only nt-top-round nt-ring-btn"
      popClassName="nt-pop-quota"
      gap={BELOW_BAR}
    >
      {(close) => (
        <>
          <h2 className="nt-pop-heading">{words.text("quota.title")}</h2>
          <div className="nt-q-head">
            <RingMark ring={ring} big />
            <p className="nt-q-say">
              <b>{ring.title}</b>
              <span>{ring.line}</span>
            </p>
          </div>
          {ring.renews === undefined ? null : (
            <p className="nt-q-renew">
              <Icon value="set-time" />
              {ring.renews}
            </p>
          )}
          <p className="nt-q-note">{words.text("quota.spends")}</p>
          <MenuRow
            icon="settings"
            text={words.text("quota.account-settings")}
            opens
            onPress={() => {
              close();
              navigate(ADULTS);
            }}
          />
        </>
      )}
    </PopOver>
  );
}

/** The ring of the learner chosen: none outside the gate. */
export function TutorTime() {
  const chosen = useLearner();
  const profileId = chosen?.learner.profileId;
  const { words } = useLanguage();
  const read = useCallback(
    (api: Api) =>
      profileId === undefined
        ? Promise.resolve(undefined)
        : readQuota(api, profileId, Action.LEARNING),
    [profileId],
  );
  const share = useRequest(read);
  if (profileId === undefined) return null;
  if (share.status === "loading") {
    return (
      <Loading className="nt-ring-wait">
        <Sk width="2rem" height="2rem" radius="50%" />
      </Loading>
    );
  }
  if (share.status === "failed" || share.value === undefined) return null;
  const ring = ringOf(share.value, words);
  return ring === undefined ? null : <TutorTimeRing ring={ring} />;
}
