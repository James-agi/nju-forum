import { beforeEach, describe, expect, it } from "vitest";
import {
  getAskConcurrencyStats,
  resetAskConcurrencyForTests,
  tryAcquireAskSlot,
} from "../concurrency";
import {
  ASK_CARDS_CONCURRENCY,
  ASK_GLOBAL_CONCURRENCY,
  ASK_THINK_CONCURRENCY,
} from "../config";

describe("ask concurrency guards", () => {
  beforeEach(() => {
    resetAskConcurrencyForTests();
  });

  it("limits think requests separately", () => {
    const releases: Array<() => void> = [];

    for (let i = 0; i < ASK_THINK_CONCURRENCY; i++) {
      const slot = tryAcquireAskSlot("think");
      expect(slot.ok).toBe(true);
      if (slot.ok) releases.push(slot.release);
    }

    expect(tryAcquireAskSlot("think")).toEqual({ ok: false, reason: "think" });

    releases.forEach((release) => release());
    expect(getAskConcurrencyStats().think.active).toBe(0);
  });

  it("limits cards requests separately", () => {
    const releases: Array<() => void> = [];

    for (let i = 0; i < ASK_CARDS_CONCURRENCY; i++) {
      const slot = tryAcquireAskSlot("cards");
      expect(slot.ok).toBe(true);
      if (slot.ok) releases.push(slot.release);
    }

    expect(tryAcquireAskSlot("cards")).toEqual({ ok: false, reason: "cards" });

    releases.forEach((release) => release());
    expect(getAskConcurrencyStats().cards.active).toBe(0);
  });

  it("keeps a global cap across modes", () => {
    const releases: Array<() => void> = [];

    for (let i = 0; i < ASK_THINK_CONCURRENCY; i++) {
      const slot = tryAcquireAskSlot("think");
      expect(slot.ok).toBe(true);
      if (slot.ok) releases.push(slot.release);
    }

    for (let i = ASK_THINK_CONCURRENCY; i < ASK_GLOBAL_CONCURRENCY; i++) {
      const slot = tryAcquireAskSlot("cards");
      expect(slot.ok).toBe(true);
      if (slot.ok) releases.push(slot.release);
    }

    expect(tryAcquireAskSlot("cards")).toEqual({ ok: false, reason: "global" });
    expect(getAskConcurrencyStats().global.active).toBe(ASK_GLOBAL_CONCURRENCY);

    releases.forEach((release) => release());
    expect(getAskConcurrencyStats().global.active).toBe(0);
  });

  it("releases a slot only once", () => {
    const slot = tryAcquireAskSlot("think");
    expect(slot.ok).toBe(true);
    if (!slot.ok) return;

    slot.release();
    slot.release();

    expect(getAskConcurrencyStats()).toMatchObject({
      global: { active: 0 },
      think: { active: 0 },
      cards: { active: 0 },
    });
  });
});
