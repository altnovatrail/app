// The owner's own profile as a learner, as the mockup's `owner` (R19 and R61 in docs/decisions.md;
// R98 and R148 in spec; section 3.10 of docs/architecture.md): a pseudonym, the country and an
// avatar of the set, of the category `adult`. The avatar may stay unchosen, and the profile then
// shows the set's own (R98 in spec keeps the field optional); the avatars and the countries are each
// a choice in a pop-over (R59). "Continue" looks off until a pseudonym and a country are given but
// keeps the focus (R20): pressed, it says what is missing and focuses it.
import { type FormEvent, useId, useMemo, useRef, useState } from "react";
import type { Failure } from "../api/failure.ts";
import { Brand } from "../app/Brand.tsx";
import { described } from "../app/described.ts";
import { Icon } from "../app/Icon.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Avatar } from "./Avatar.tsx";
import { AVATARS, type AvatarCode } from "./avatars.ts";
import { countryNames } from "./countries.ts";
import { FormFailure } from "./FormFailure.tsx";
import { pseudonymOf } from "./session.ts";

export interface OwnerProfileScreenProps {
  readonly onCreate: (
    pseudonym: string,
    country: string,
    avatar: AvatarCode | undefined,
  ) => Promise<"done" | "country-not-accepted" | Failure>;
}

export function OwnerProfileScreen({ onCreate }: OwnerProfileScreenProps) {
  const { language, words } = useLanguage();
  const id = useId();
  const pseudonymField = useRef<HTMLInputElement>(null);
  const countryButton = useRef<HTMLButtonElement>(null);
  const countries = useMemo(() => countryNames(language), [language]);
  const [pseudonym, setPseudonym] = useState("");
  const [country, setCountry] = useState("");
  const [avatar, setAvatar] = useState<AvatarCode | undefined>(undefined);
  const [pseudonymError, setPseudonymError] = useState(false);
  const [countryError, setCountryError] = useState<
    "country-choose" | "country-not-accepted" | undefined
  >(undefined);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const countryName = countries.find(({ code }) => code === country)?.name;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const name = pseudonymOf(pseudonym);
    setPseudonymError(name === undefined);
    setCountryError(country === "" ? "country-choose" : undefined);
    setFailure(undefined);
    if (name === undefined) return pseudonymField.current?.focus();
    if (country === "") return countryButton.current?.focus();
    setPending(true);
    const result = await onCreate(name, country, avatar);
    setPending(false);
    if (result === "country-not-accepted") {
      setCountryError("country-not-accepted");
      countryButton.current?.focus();
    } else if (result !== "done") {
      setFailure(result);
    }
  }

  return (
    <Screen
      title={words.text("profile.title")}
      layout="profiles"
      before={<Brand className="nt-brand" />}
    >
      <p className="nt-lead">{words.text("profile.intro")}</p>
      <Avatar code={avatar} size="profile" />
      <PopOver
        label={words.text(avatar === undefined ? "profile.avatar-choose" : "profile.avatar-change")}
        className="nt-link"
        centred
        popClassName="nt-pop-avatars"
      >
        {(close) => (
          <ul className="nt-avatars">
            {AVATARS.map(({ code }) => (
              <li key={code}>
                <button
                  type="button"
                  className="nt-avatar-option"
                  aria-pressed={code === avatar}
                  onClick={() => {
                    setAvatar(code);
                    close();
                  }}
                >
                  <Avatar code={code} size="choice" />
                  <span>{words.text(`avatar.${code}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopOver>
      <form noValidate onSubmit={(event) => void submit(event)}>
        <div className="nt-rows">
          <div className="nt-row">
            <label htmlFor={`${id}-pseudonym`}>{words.text("profile.pseudonym")}</label>
            <input
              ref={pseudonymField}
              id={`${id}-pseudonym`}
              type="text"
              autoComplete="off"
              value={pseudonym}
              aria-invalid={pseudonymError}
              aria-describedby={described(
                `${id}-pseudonym-hint`,
                pseudonymError && `${id}-pseudonym-error`,
              )}
              onChange={(event) => setPseudonym(event.target.value)}
            />
          </div>
          <PopOver
            label={words.text("profile.country")}
            buttonRef={countryButton}
            className="nt-row"
            describedBy={described(countryError !== undefined && `${id}-country-error`)}
            caption={
              <>
                <span className="nt-row-name">{words.text("profile.country")}</span>{" "}
                <span className={countryName === undefined ? "nt-row-choose" : "nt-row-value"}>
                  {countryName ?? words.text("profile.country-choose")}
                </span>
                <Icon value="more" />
              </>
            }
          >
            {(close) => (
              <ul className="nt-choice-list">
                {countries.map(({ code, name }) => (
                  <li key={code}>
                    <button
                      type="button"
                      aria-pressed={code === country}
                      onClick={() => {
                        setCountry(code);
                        setCountryError(undefined);
                        close();
                      }}
                    >
                      {name}
                      {code === country ? <Icon value="ticked" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PopOver>
        </div>
        {pseudonymError ? (
          <p id={`${id}-pseudonym-error`} className="nt-error">
            {words.text("profile.pseudonym-length")}
          </p>
        ) : null}
        {countryError === undefined ? null : (
          <p id={`${id}-country-error`} className="nt-error">
            {words.text(`profile.${countryError}`)}
          </p>
        )}
        <p id={`${id}-pseudonym-hint`} className="nt-hint">
          {words.text("profile.owner-hint")}
        </p>
        <button
          type="submit"
          className="nt-main"
          disabled={pending}
          aria-disabled={pseudonym.trim() === "" || country === ""}
        >
          {words.text("profile.create")}
        </button>
        <FormFailure failure={failure} />
      </form>
    </Screen>
  );
}
