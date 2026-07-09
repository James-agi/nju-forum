export interface KnowledgeTrace {
  normalizedQuestion: string;
  termExtraction?: {
    terms: string[];
    sources: Array<{
      term: string;
      source: "SPEC" | "TOKENIZER" | "ALIAS";
      detail?: string;
    }>;
    aliases: Array<{
      triggers: string[];
      matchedTriggers: string[];
      targets: string[];
      status: "APPLIED" | "REJECTED";
      reason?: "MISSING_CONTEXT" | "BLOCKED";
      requireAny?: string[];
      blockAny?: string[];
    }>;
    durationMs: number;
  };
  scope: {
    inScope: boolean;
    code?: string;
    label?: string;
    durationMs: number;
  };
  expansion: {
    terms: string[];
    durationMs: number;
  };
  retrieval: {
    candidates: Array<{
      id: string;
      summary?: string;
      score: number;
      terms: string[];
      verificationStatus?: "VERIFIED" | "UNVERIFIED" | "NEEDS_REVIEW";
    }>;
    durationMs: number;
  };
  evidence: {
    sufficient: boolean;
    reason?: string;
    cardsCount: number;
    selectedCards?: Array<{
      id: string;
      summary: string;
      score: number;
      terms: string[];
      verificationStatus: "VERIFIED" | "UNVERIFIED" | "NEEDS_REVIEW";
    }>;
  };
  answer: {
    mode?: "LLM" | "FALLBACK";
    durationMs: number;
  };
}

export class TraceBuilder {
  private trace: Partial<KnowledgeTrace> = {};
  private marks: Map<string, number> = new Map();

  mark(name: string) {
    this.marks.set(name, performance.now());
  }

  elapsedMs(from: string): number {
    const start = this.marks.get(from);
    return start !== undefined ? Math.round(performance.now() - start) : 0;
  }

  setNormalizedQuestion(q: string) {
    this.trace.normalizedQuestion = q;
  }

  setScope(data: KnowledgeTrace["scope"]) {
    this.trace.scope = data;
  }

  setTermExtraction(data: NonNullable<KnowledgeTrace["termExtraction"]>) {
    this.trace.termExtraction = data;
  }

  setExpansion(data: KnowledgeTrace["expansion"]) {
    this.trace.expansion = data;
  }

  setRetrieval(data: KnowledgeTrace["retrieval"]) {
    this.trace.retrieval = data;
  }

  setEvidence(data: KnowledgeTrace["evidence"]) {
    this.trace.evidence = data;
  }

  setAnswer(data: KnowledgeTrace["answer"]) {
    this.trace.answer = data;
  }

  build(): KnowledgeTrace {
    return this.trace as KnowledgeTrace;
  }

  toJSON(): string {
    return JSON.stringify(this.trace);
  }
}
