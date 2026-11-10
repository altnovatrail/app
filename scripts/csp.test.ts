import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { header, lowerLayer, type Template, templateProblems } from "./csp.ts";

const template = JSON.parse(readFileSync("csp.json", "utf8")) as Template;
const places = { api: "https://api.example.org", authDomain: "example-project.firebaseapp.com" };

describe("csp.json", () => {
  it("is a template the rollout takes", () => {
    expect(templateProblems(template)).toEqual([]);
  });

  it("gives the lower layer of section 3.7: https: for a place, no frame-ancestors", () => {
    expect(lowerLayer(template)).toBe(
      [
        "default-src 'none'",
        "script-src 'self' https://apis.google.com",
        "style-src 'self'",
        "img-src 'self' blob:",
        "connect-src 'self' https:",
        "frame-src https:",
        "font-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
    );
  });

  it("gives the header with the file's values in the places", () => {
    expect(header(template, places)).toBe(
      [
        "default-src 'none'",
        "script-src 'self' https://apis.google.com",
        "style-src 'self'",
        "img-src 'self' blob:",
        "connect-src 'self' https://api.example.org https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
        "frame-src https://example-project.firebaseapp.com",
        "font-src 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
      ].join("; "),
    );
  });
});

describe("header", () => {
  it("adds frame-ancestors 'none' to a template without it", () => {
    expect(header({ "default-src": "'self'" }, places)).toBe(
      "default-src 'self'; frame-ancestors 'none'",
    );
  });
});

describe("lowerLayer", () => {
  it("takes every source with a place, one after another", () => {
    expect(lowerLayer({ a: "{api} {authDomain}", b: "https://{api} 'self'" })).toBe(
      "a https:; b https: 'self'",
    );
  });
});

describe("templateProblems", () => {
  it("refuses what the rollout refuses", () => {
    expect(templateProblems([])).toEqual(["csp.json is not an object of directives"]);
    expect(templateProblems(null)).toEqual(["csp.json is not an object of directives"]);
    expect(
      templateProblems({
        "Script-Src": "'self'",
        "img-src": ["'self'"],
        "style-src": "'self'; img-src *",
        "font-src": "a, b",
        "frame-src": "",
        "connect-src": "{origin}",
        "frame-ancestors": "'self'",
        "media-src": '\'self" onload="x',
      }),
    ).toEqual([
      "Script-Src is no directive's name",
      "img-src is not one string of sources",
      "style-src is not one string of sources",
      "font-src is not one string of sources",
      "frame-src is not one string of sources",
      "connect-src has the place {origin}",
      "frame-ancestors is not 'none'",
      "media-src is not one string of sources",
    ]);
  });
});
