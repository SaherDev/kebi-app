import { COUNTRIES, countryByCode, countryFlag } from "./countries";

describe("countryFlag", () => {
  it("composes the flag from the code's regional indicators", () => {
    expect(countryFlag("AE")).toBe("🇦🇪");
    expect(countryFlag("GB")).toBe("🇬🇧");
  });

  it("accepts a lowercase code — the same country either way", () => {
    expect(countryFlag("ae")).toBe(countryFlag("AE"));
  });

  it("returns nothing for anything that is not two letters", () => {
    expect(countryFlag("ARE")).toBe("");
    expect(countryFlag("")).toBe("");
    expect(countryFlag("1A")).toBe("");
  });
});

describe("COUNTRIES", () => {
  it("is every alpha-2 country, sorted by name so the picker never sorts", () => {
    const names = COUNTRIES.map((c) => c.name);

    expect(COUNTRIES.length).toBeGreaterThan(240);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("carries only uppercase alpha-2 codes — the gateway rejects anything else", () => {
    expect(COUNTRIES.every((c) => /^[A-Z]{2}$/.test(c.code))).toBe(true);
  });

  it("has no duplicate codes", () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
  });
});

describe("countryByCode", () => {
  it("finds a country case-insensitively", () => {
    expect(countryByCode("ae")?.name).toBe("United Arab Emirates");
    expect(countryByCode("AE")?.name).toBe("United Arab Emirates");
  });

  it("returns null for unset or unknown", () => {
    expect(countryByCode(null)).toBeNull();
    expect(countryByCode("")).toBeNull();
    expect(countryByCode("ZZ")).toBeNull();
  });
});
