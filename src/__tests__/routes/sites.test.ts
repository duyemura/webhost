import { describe, it, expect } from "vitest";
import { DOMAIN_RE } from "../../routes/sites.js";

describe("DOMAIN_RE", () => {
  const valid = [
    "www.mygym.com",
    "mygym.com",
    "sub.mygym.co.uk",
    "my-gym.io",
    "xn--nxasmq6b.com", // punycode
    "gym123.fitness",
  ];

  const invalid = [
    "notadomain",        // no TLD dot
    "nodot",
    ".startwithdot.com",
    "-startwithhyphen.com",
    "domain.",           // trailing dot / empty TLD
    "domain.c",          // TLD too short (1 char)
    "domain with spaces.com",
    "",
    "http://www.mygym.com", // with scheme
    "@mygym.com",
  ];

  for (const d of valid) {
    it(`accepts "${d}"`, () => expect(DOMAIN_RE.test(d)).toBe(true));
  }

  for (const d of invalid) {
    it(`rejects "${d}"`, () => expect(DOMAIN_RE.test(d)).toBe(false));
  }
});
