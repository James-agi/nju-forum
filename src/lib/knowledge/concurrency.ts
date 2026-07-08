import { ASK_GLOBAL_CONCURRENCY } from "@/lib/knowledge/config";

let activeAskRequests = 0;

export function tryAcquireAskSlot(): (() => void) | null {
  if (activeAskRequests >= ASK_GLOBAL_CONCURRENCY) {
    return null;
  }

  activeAskRequests += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeAskRequests = Math.max(0, activeAskRequests - 1);
  };
}

export function getAskConcurrencyStats() {
  return {
    active: activeAskRequests,
    limit: ASK_GLOBAL_CONCURRENCY,
  };
}
