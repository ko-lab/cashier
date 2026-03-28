import { describe, expect, it } from "vitest";
import { toStructuredCommunication } from "./structuredCommunication";

describe("toStructuredCommunication", () => {
  it("returns the expected Belgian formatted message", () => {
    const value = toStructuredCommunication("123e4567-e89b-12d3-a456-426614174000");

    expect(value).toMatch(/^\+\+\+\d{3}\/\d{4}\/\d{5}\+\+\+$/);
  });

  it("is deterministic for the same transaction id", () => {
    const id = "tx-same";
    expect(toStructuredCommunication(id)).toBe(toStructuredCommunication(id));
  });

  it("changes when transaction id changes", () => {
    expect(toStructuredCommunication("tx-a")).not.toBe(
      toStructuredCommunication("tx-b")
    );
  });
});
