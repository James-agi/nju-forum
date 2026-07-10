import {
  ASK_CARDS_CONCURRENCY,
  ASK_GLOBAL_CONCURRENCY,
  ASK_THINK_CONCURRENCY,
} from "@/lib/knowledge/config";

export type AskConcurrencyMode = "think" | "cards";
export type AskConcurrencyBusyReason = "global" | AskConcurrencyMode;

export type AskSlotResult =
  | { ok: true; release: () => void }
  | { ok: false; reason: AskConcurrencyBusyReason };

let activeGlobalAskRequests = 0;
let activeThinkAskRequests = 0;
let activeCardsAskRequests = 0;

function getModeLimit(mode: AskConcurrencyMode) {
  return mode === "think" ? ASK_THINK_CONCURRENCY : ASK_CARDS_CONCURRENCY;
}

function getActiveModeCount(mode: AskConcurrencyMode) {
  return mode === "think" ? activeThinkAskRequests : activeCardsAskRequests;
}

function incrementMode(mode: AskConcurrencyMode) {
  if (mode === "think") {
    activeThinkAskRequests += 1;
  } else {
    activeCardsAskRequests += 1;
  }
}

function decrementMode(mode: AskConcurrencyMode) {
  if (mode === "think") {
    activeThinkAskRequests = Math.max(0, activeThinkAskRequests - 1);
  } else {
    activeCardsAskRequests = Math.max(0, activeCardsAskRequests - 1);
  }
}

export function tryAcquireAskSlot(mode: AskConcurrencyMode): AskSlotResult {
  if (activeGlobalAskRequests >= ASK_GLOBAL_CONCURRENCY) {
    return { ok: false, reason: "global" };
  }

  if (getActiveModeCount(mode) >= getModeLimit(mode)) {
    return { ok: false, reason: mode };
  }

  activeGlobalAskRequests += 1;
  incrementMode(mode);
  let released = false;

  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      activeGlobalAskRequests = Math.max(0, activeGlobalAskRequests - 1);
      decrementMode(mode);
    },
  };
}

export function getAskConcurrencyStats() {
  return {
    global: {
      active: activeGlobalAskRequests,
      limit: ASK_GLOBAL_CONCURRENCY,
    },
    think: {
      active: activeThinkAskRequests,
      limit: ASK_THINK_CONCURRENCY,
    },
    cards: {
      active: activeCardsAskRequests,
      limit: ASK_CARDS_CONCURRENCY,
    },
  };
}

export function resetAskConcurrencyForTests() {
  activeGlobalAskRequests = 0;
  activeThinkAskRequests = 0;
  activeCardsAskRequests = 0;
}
