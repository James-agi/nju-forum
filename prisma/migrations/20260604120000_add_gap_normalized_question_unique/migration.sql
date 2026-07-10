-- 清除已有的 normalizedQuestion 重复数据（保留最早的一条）
DELETE FROM "KnowledgeGap" a
USING "KnowledgeGap" b
WHERE a.id > b.id AND a."normalizedQuestion" = b."normalizedQuestion";

-- 添加唯一约束
CREATE UNIQUE INDEX "KnowledgeGap_normalizedQuestion_key" ON "KnowledgeGap"("normalizedQuestion");
