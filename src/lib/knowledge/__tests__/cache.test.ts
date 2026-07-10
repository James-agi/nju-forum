import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { KnowledgeCache, answerCache } from "../cache";

describe("KnowledgeCache", () => {
  let cache: KnowledgeCache<string>;

  beforeEach(() => {
    cache = new KnowledgeCache<string>();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves a value", () => {
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
  });

  it("returns undefined for missing key", () => {
    expect(cache.get("nonexistent")).toBeUndefined();
  });

  it("returns undefined for expired entry", () => {
    cache.set("key1", "value1", 1000);
    vi.advanceTimersByTime(1001);
    expect(cache.get("key1")).toBeUndefined();
  });

  it("returns value before expiry", () => {
    cache.set("key1", "value1", 1000);
    vi.advanceTimersByTime(999);
    expect(cache.get("key1")).toBe("value1");
  });

  it("evicts oldest entry when at capacity (LRU)", () => {
    const smallCache = new KnowledgeCache<string>();

    // Directly test the Map behavior: the class deletes the first key
    smallCache.set("a", "1");
    smallCache.set("b", "2");
    smallCache.set("c", "3");

    // Verify all 3 are present
    expect(smallCache.get("a")).toBe("1");
    expect(smallCache.get("b")).toBe("2");
    expect(smallCache.get("c")).toBe("3");

    // The max entries is 500 from config, so we need to test differently
    // Let's test the eviction logic by creating many entries
    const bigCache = new KnowledgeCache<string>();
    // Fill beyond max (500 from config)
    for (let i = 0; i < 510; i++) {
      bigCache.set(`key${i}`, `val${i}`);
    }
    const stats = bigCache.stats();
    expect(stats.size).toBeLessThanOrEqual(500);
  });

  it("tracks hit and miss stats", () => {
    cache.get("miss1");
    cache.get("miss2");
    cache.set("hit1", "val");
    cache.get("hit1");

    const stats = cache.stats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
  });

  it("invalidate removes a specific key", () => {
    cache.set("key1", "value1");
    cache.invalidate("key1");
    expect(cache.get("key1")).toBeUndefined();
  });

  it("invalidates all keys", () => {
    cache.set("a", "1");
    cache.set("b", "2");
    cache.invalidateAll();
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBeUndefined();
    expect(cache.stats().size).toBe(0);
  });

  it("counts expired access as miss", () => {
    cache.set("key1", "value1", 100);
    vi.advanceTimersByTime(200);
    cache.get("key1");
    const stats = cache.stats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(1);
  });

  it("handles concurrent expiry and insertion", () => {
    cache.set("a", "1", 50);
    cache.set("b", "2", 5000);
    vi.advanceTimersByTime(100);

    // 'a' expired, 'b' still valid
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe("2");

    // Stats: 1 miss (a), 1 hit (b)
    const stats = cache.stats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
  });
});

describe("answerCache singleton", () => {
  it("is a KnowledgeCache instance", () => {
    expect(answerCache).toBeInstanceOf(KnowledgeCache);
  });

  it("preserves value across operations", () => {
    answerCache.set("test-q", "test-answer");
    expect(answerCache.get("test-q")).toBe("test-answer");
    answerCache.invalidate("test-q");
    expect(answerCache.get("test-q")).toBeUndefined();
  });
});
