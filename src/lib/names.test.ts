import { describe, expect, it } from "vitest";
import { firstName, shortNames } from "./names";

describe("firstName", () => {
  it("takes the first word", () => {
    expect(firstName("Pete Smith")).toBe("Pete");
    expect(firstName("  Dan   Jones ")).toBe("Dan");
    expect(firstName("Cher")).toBe("Cher");
  });
});

describe("shortNames", () => {
  it("uses first names when they're unique", () => {
    const names = shortNames([
      { id: "a", name: "Pete Smith" },
      { id: "b", name: "Dan Jones" },
    ]);
    expect(names.get("a")).toBe("Pete");
    expect(names.get("b")).toBe("Dan");
  });

  it("uses full names for people sharing a first name", () => {
    const names = shortNames([
      { id: "a", name: "Pete Smith" },
      { id: "b", name: "pete Brown" },
      { id: "c", name: "Dan Jones" },
    ]);
    expect(names.get("a")).toBe("Pete Smith");
    expect(names.get("b")).toBe("pete Brown");
    expect(names.get("c")).toBe("Dan");
  });

  it("counts each person once", () => {
    const names = shortNames([
      { id: "a", name: "Pete Smith" },
      { id: "a", name: "Pete Smith" },
    ]);
    expect(names.get("a")).toBe("Pete");
  });
});
