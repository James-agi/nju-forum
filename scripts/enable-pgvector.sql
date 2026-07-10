-- 可选：启用 pgvector 扩展并添加 embedding 列
-- 在 PostgreSQL 已安装 pgvector 扩展的环境中执行
-- 用法: psql -f scripts/enable-pgvector.sql

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "KnowledgeCard" ADD COLUMN IF NOT EXISTS "embedding" vector(1024);
CREATE INDEX IF NOT EXISTS "KnowledgeCard_embedding_idx" ON "KnowledgeCard" USING hnsw ("embedding" vector_cosine_ops);
