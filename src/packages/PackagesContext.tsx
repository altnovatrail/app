// The packages for every screen below Boot: their open views, the files of their device parts, and
// the check that erases what api no longer gives (T21).
import { createContext, useContext } from "react";
import type { PackageChecks } from "./checks.ts";
import type { DeviceFiles } from "./files.ts";
import type { OpenViews } from "./views.ts";

export interface Packages {
  readonly views: OpenViews;
  readonly files: DeviceFiles;
  readonly checks: PackageChecks;
}

const PackagesContext = createContext<Packages | undefined>(undefined);

export const PackagesProvider = PackagesContext.Provider;

export function usePackages(): Packages {
  const packages = useContext(PackagesContext);
  if (packages === undefined) throw new Error("usePackages outside PackagesProvider");
  return packages;
}

/** The packages, where a screen can do without them: none outside PackagesProvider. */
export function useOptionalPackages(): Packages | undefined {
  return useContext(PackagesContext);
}
