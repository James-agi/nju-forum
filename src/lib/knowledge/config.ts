// Scoring thresholds
export const MIN_SUFFICIENT_SCORE = 12;
export const MIN_STRONG_TERM_COUNT = 2;
export const MIN_SINGLE_ANCHOR_SCORE = 10;
export const RRF_K = 60;

// Timeouts (ms)
export const LLM_ANSWER_TIMEOUT = 25_000;
export const QUERY_EXPANSION_TIMEOUT = 8_000;
export const EMBEDDING_TIMEOUT = 5_000;
export const EMBEDDING_CONCURRENCY = 5;

// Rate limiting
export const GUEST_MAX_TOKENS = 5;
export const GUEST_REFILL_RATE = 5 / 60;
export const USER_MAX_TOKENS = 6;
export const USER_REFILL_RATE = 6 / 60;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const ASK_GLOBAL_CONCURRENCY = 10;

// Retrieval
export const KEYWORD_TOP_CUT = 20;
export const MAX_TERMS = 15;
export const MAX_MERGED_TERMS = 20;
export const RETRIEVAL_MIN_STRONG_GATE_TERMS = 2;
export const RETRIEVAL_CANDIDATE_MIN_COUNT = 30;
export const RETRIEVAL_CANDIDATE_MAX_COUNT = 300;
export const SEMANTIC_TOP_K = 20;
export const SEMANTIC_SIMILARITY_THRESHOLD = 0.5;
export const EVIDENCE_MAX_USABLE = 3;
export const EVIDENCE_SCORE_DIFF = 2;

// LLM
export const LLM_MAX_TOKENS = 1024;
export const LLM_TEMPERATURE = 0.1;
export const QUERY_EXPANSION_MAX_TOKENS = 100;
export const QUERY_EXPANSION_TEMPERATURE = 0;
export const QUERY_EXPANSION_MAX_TERMS = 5;

// Tokenizer
export const MIN_NGRAM = 2;
export const MAX_NGRAM = 5;

// Cache
export const CACHE_TTL_MS = 3600_000;
export const CACHE_MAX_ENTRIES = 500;
