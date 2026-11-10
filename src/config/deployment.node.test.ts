// The reading of /deployment.json held to spec's part deployment/, from the file of spec's release
// in parts/: its schema's patterns, its examples and its vectors of reading (section 3.7 of
// docs/architecture.md).
import type { ReadingVector } from "@altnovatrail/spec/deploymentv1";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { deploymentPart, partText } from "../../scripts/archive.ts";
import {
  API_PATTERN,
  AUTH_DOMAIN_PATTERN,
  FORMAT,
  isLoopback,
  readDeployment,
  schemaRefusals,
} from "./deployment.ts";

const part = deploymentPart();
const read = (path: string) => partText(part, path);
/** The YAML files right in a folder of the part, by their names. */
const files = (folder: string) =>
  [...part.keys()]
    .filter((path) => path.startsWith(`${folder}/`) && path.endsWith(".yaml"))
    .map((path) => path.slice(folder.length + 1))
    .filter((name) => !name.includes("/"));

describe("the part deployment/ of spec", () => {
  it("is the version this build reads, with the schema's own patterns", () => {
    expect(Number(read("VERSION").trim())).toBe(FORMAT);
    const schema = JSON.parse(read("schemas/deployment.schema.json"));
    expect(schema.properties.api.pattern).toBe(API_PATTERN);
    expect(schema.$defs.sign_in.properties.authDomain.pattern).toBe(AUTH_DOMAIN_PATTERN);
    expect(schema.properties.format.const).toBe(FORMAT);
  });

  it.each(files("examples/deployment/valid"))("accepts the valid example %s", (name) => {
    expect(schemaRefusals(parse(read(`examples/deployment/valid/${name}`)))).toEqual([]);
  });

  it.each(files("examples/deployment/invalid"))("refuses the invalid example %s", (name) => {
    expect(schemaRefusals(parse(read(`examples/deployment/invalid/${name}`)))).not.toEqual([]);
  });

  const cases = files("vectors/reading").flatMap((name) =>
    (parse(read(`vectors/reading/${name}`)) as ReadingVector).cases.map(
      (c, index) => [`${name} #${index + 1}`, c] as const,
    ),
  );

  it("has vectors that accept and refuse at each step", () => {
    const steps = new Set(cases.map(([, c]) => c.refused_by ?? "accepted"));
    expect([...steps].sort()).toEqual([
      "accepted",
      "deployment.api-origin",
      "deployment.loopback",
      "schema",
    ]);
  });

  it.each(cases)("reads the vector %s as the part says", (_, c) => {
    const reading = readDeployment(c.file, c.origin);
    if (c.refused_by === undefined) {
      expect(reading).toEqual({ ok: true, deployment: c.file });
    } else {
      expect(reading).toEqual({ ok: false, refusedBy: c.refused_by, fields: c.fields });
    }
  });
});

describe("readDeployment", () => {
  const file = {
    format: 1,
    api: "https://api.example.org",
    signIn: {
      service: "firebase",
      apiKey: "synthetic-web-api-key",
      authDomain: "example-project.firebaseapp.com",
      projectId: "example-project",
      appId: "synthetic-web-app-id",
    },
  };

  it("names every field the schema refuses, the root's and signIn's, in order", () => {
    expect(schemaRefusals(null)).toEqual([""]);
    expect(schemaRefusals([])).toEqual([""]);
    expect(schemaRefusals({ ...file, signIn: "firebase", extra: true })).toEqual([
      "extra",
      "signIn",
    ]);
    expect(
      schemaRefusals({ ...file, format: 2, signIn: { ...file.signIn, service: "other" } }),
    ).toEqual(["format", "signIn.service"]);
  });

  it("refuses an api the schema's pattern passes but the URL Standard does not parse", () => {
    for (const api of ["https://api.example.org:99999", "https://256.1.1.1", "https://1.2.3.4.5"]) {
      expect(readDeployment({ ...file, api }, "https://app.example.org")).toEqual({
        ok: false,
        refusedBy: "deployment.api-origin",
        fields: ["api"],
      });
    }
  });

  it("refuses http while app is open on a host that is no loopback host", () => {
    const local = { ...file, api: "http://127.0.0.1:8080" };
    expect(readDeployment(local, "http://127.0.0.1:5173").ok).toBe(true);
    expect(readDeployment(local, "https://app.example.org")).toEqual({
      ok: false,
      refusedBy: "deployment.loopback",
      fields: ["api"],
    });
  });
});

describe("isLoopback", () => {
  it("takes 127.0.0.1, localhost and [::1] as they are written, and nothing else", () => {
    expect(["http://127.0.0.1:5173", "http://localhost", "http://[::1]:1"].map(isLoopback)).toEqual(
      [true, true, true],
    );
    expect(
      ["http://127.0.0.2", "http://dev.localhost", "https://app.example.org", "nonsense"].map(
        isLoopback,
      ),
    ).toEqual([false, false, false, false]);
  });
});
