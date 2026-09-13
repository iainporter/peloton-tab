import { describe, expect, it } from "vitest";
import {
  convertToBase,
  currencySymbol,
  deriveRate,
  formatBalance,
  formatMoney,
  fromMinor,
  isCurrencyCode,
  parseRate,
  toMinor,
} from "./money";

describe("toMinor", () => {
  it("parses whole and decimal amounts", () => {
    expect(toMinor("12", "GBP")).toBe(1200);
    expect(toMinor("12.5", "GBP")).toBe(1250);
    expect(toMinor("12.50", "GBP")).toBe(1250);
    expect(toMinor(".5", "GBP")).toBe(50);
    expect(toMinor(" 3.07 ", "EUR")).toBe(307);
  });

  it("avoids floating point rounding errors", () => {
    // parseFloat("19.99") * 100 === 1998.9999999999998
    expect(toMinor("19.99", "GBP")).toBe(1999);
    expect(toMinor("0.29", "GBP")).toBe(29);
  });

  it("respects currencies without a minor unit", () => {
    expect(toMinor("1500", "JPY")).toBe(1500);
    expect(toMinor("1500.5", "JPY")).toBeNull();
  });

  it("rejects invalid input", () => {
    expect(toMinor("", "GBP")).toBeNull();
    expect(toMinor(".", "GBP")).toBeNull();
    expect(toMinor("-5", "GBP")).toBeNull();
    expect(toMinor("12.345", "GBP")).toBeNull();
    expect(toMinor("12,50", "GBP")).toBeNull();
    expect(toMinor("abc", "GBP")).toBeNull();
    expect(toMinor("1e3", "GBP")).toBeNull();
  });

  it("rejects amounts too large for an integer column", () => {
    expect(toMinor("21474836.47", "GBP")).toBe(2147483647);
    expect(toMinor("21474836.48", "GBP")).toBeNull();
  });
});

describe("fromMinor", () => {
  it("formats minor units as a plain decimal string", () => {
    expect(fromMinor(1250, "GBP")).toBe("12.50");
    expect(fromMinor(5, "EUR")).toBe("0.05");
    expect(fromMinor(1500, "JPY")).toBe("1500");
  });
});

describe("formatMoney", () => {
  it("formats with the currency symbol", () => {
    expect(formatMoney(1250, "GBP")).toBe("£12.50");
    expect(formatMoney(4200, "EUR")).toBe("€42.00");
    expect(formatMoney(999, "USD")).toBe("$9.99");
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
  });

  it("formats negative amounts", () => {
    expect(formatMoney(-1250, "GBP")).toBe("-£12.50");
  });
});

describe("formatBalance", () => {
  it("adds an explicit sign", () => {
    expect(formatBalance(1250, "GBP")).toBe("+£12.50");
    expect(formatBalance(-1250, "EUR")).toBe("-€12.50");
    expect(formatBalance(0, "GBP")).toBe("even");
  });
});

describe("currencySymbol", () => {
  it("returns the narrow symbol", () => {
    expect(currencySymbol("GBP")).toBe("£");
    expect(currencySymbol("EUR")).toBe("€");
  });
});

describe("isCurrencyCode", () => {
  it("only accepts supported currencies", () => {
    expect(isCurrencyCode("GBP")).toBe(true);
    expect(isCurrencyCode("XYZ")).toBe(false);
    expect(isCurrencyCode("toString")).toBe(false);
  });
});

describe("parseRate", () => {
  it("normalises valid rates", () => {
    expect(parseRate("0.8600")).toBe("0.86");
    expect(parseRate("0.86000000")).toBe("0.86");
    expect(parseRate("1")).toBe("1");
    expect(parseRate("207.93")).toBe("207.93");
    expect(parseRate(".5")).toBe("0.5");
    expect(parseRate("0.00000001")).toBe("0.00000001");
    expect(parseRate("9999999999.99999999")).toBe("9999999999.99999999");
  });

  it("rejects invalid rates", () => {
    expect(parseRate("")).toBeNull();
    expect(parseRate("0")).toBeNull();
    expect(parseRate("0.000000001")).toBeNull();
    expect(parseRate("-1")).toBeNull();
    expect(parseRate("abc")).toBeNull();
    expect(parseRate("1,2")).toBeNull();
    expect(parseRate("10000000000")).toBeNull();
  });
});

describe("convertToBase", () => {
  it("converts between currencies", () => {
    expect(convertToBase(4200, "EUR", "0.86", "GBP")).toBe(3612);
    expect(convertToBase(4200, "GBP", "1", "GBP")).toBe(4200);
  });

  it("handles currencies with different minor units", () => {
    // ¥1,000,000 at 0.00481 = £4,810.00
    expect(convertToBase(1_000_000, "JPY", "0.00481", "GBP")).toBe(481000);
    // £12.50 at 207.93 = ¥2,599.125
    expect(convertToBase(1250, "GBP", "207.93", "JPY")).toBe(2599);
  });

  it("rounds half up", () => {
    expect(convertToBase(1, "EUR", "0.5", "GBP")).toBe(1);
    expect(convertToBase(3, "EUR", "0.5", "GBP")).toBe(2);
    expect(convertToBase(1, "EUR", "0.49", "GBP")).toBe(0);
  });

  it("avoids floating point errors", () => {
    // 0.1 * 3 !== 0.3 in floating point
    expect(convertToBase(30000, "USD", "0.1", "GBP")).toBe(3000);
    expect(convertToBase(1999, "EUR", "1.15", "USD")).toBe(2299);
  });

  it("throws on an invalid rate", () => {
    expect(() => convertToBase(100, "EUR", "abc", "GBP")).toThrow();
  });
});

describe("deriveRate", () => {
  it("derives the rate from an amount charged", () => {
    expect(deriveRate(4200, "EUR", 3690, "GBP")).toBe("0.87857143");
    expect(deriveRate(1_000_000, "JPY", 481000, "GBP")).toBe("0.00481");
    expect(deriveRate(1250, "GBP", 2599, "JPY")).toBe("207.92");
  });

  it("converts back to the amount charged", () => {
    const rate = deriveRate(4200, "EUR", 3690, "GBP")!;
    expect(convertToBase(4200, "EUR", rate, "GBP")).toBe(3690);
  });

  it("rejects amounts that don't produce a storable rate", () => {
    expect(deriveRate(4200, "EUR", 0, "GBP")).toBeNull();
    expect(deriveRate(0, "EUR", 100, "GBP")).toBeNull();
    expect(deriveRate(2_000_000_000, "JPY", 1, "GBP")).toBeNull();
  });
});
