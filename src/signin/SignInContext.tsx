// The sign-in service for every screen below Boot (section 3.7 of docs/architecture.md; R19 in
// docs/decisions.md): Boot makes it once the storage's start has compared the project of the
// sign-in service, and only then.
import { createContext, useContext } from "react";
import type { SignInService } from "./service.ts";

const SignInContext = createContext<SignInService | undefined>(undefined);

export const SignInProvider = SignInContext.Provider;

export function useSignIn(): SignInService {
  const service = useContext(SignInContext);
  if (service === undefined) throw new Error("useSignIn outside SignInProvider");
  return service;
}
