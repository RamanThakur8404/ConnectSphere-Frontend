import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("combines class names and removes conflicting Tailwind classes", () => {
    expect(cn("px-2 text-sm", false && "hidden", "px-4", ["font-bold"]))
      .toBe("text-sm px-4 font-bold");
  });
});
