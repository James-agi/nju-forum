-- Preserve legacy section IDs when possible so existing post links stay stable.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Section" WHERE "name" = '求助')
     AND NOT EXISTS (SELECT 1 FROM "Section" WHERE "name" = '办事') THEN
    UPDATE "Section"
    SET "name" = '办事'
    WHERE "name" = '求助';
  END IF;

  IF EXISTS (SELECT 1 FROM "Section" WHERE "name" = '吐槽')
     AND NOT EXISTS (SELECT 1 FROM "Section" WHERE "name" = '其他') THEN
    UPDATE "Section"
    SET "name" = '其他'
    WHERE "name" = '吐槽';
  END IF;
END $$;

INSERT INTO "Section" ("id", "name", "description", "icon", "order") VALUES
  ('default-section-study', '学习', '课程、考试、作业、学习方法', '📚', 1),
  ('default-section-life', '生活', '宿舍、食堂、二手、校园日常', '🏫', 2),
  ('default-section-services', '办事', '校园卡、证明、报修、医保、系统流程', '🧾', 3),
  ('default-section-development', '发展', '保研、转专业、升学、就业、竞赛科研', '🚀', 4),
  ('default-section-resources', '资源', '资料、工具、社群、经验合集', '🗂️', 5),
  ('default-section-hot', '热点', '近期讨论、校园新鲜事、临时话题', '🔥', 6),
  ('default-section-other', '其他', '放不进以上分类的内容', '💬', 7)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "icon" = EXCLUDED."icon",
  "order" = EXCLUDED."order";

-- Consolidate old categories by meaning before removing their now-empty rows.
UPDATE "Post"
SET "sectionId" = (SELECT "id" FROM "Section" WHERE "name" = '生活')
WHERE "sectionId" IN (SELECT "id" FROM "Section" WHERE "name" = '二手');

UPDATE "Post"
SET "sectionId" = (SELECT "id" FROM "Section" WHERE "name" = '办事')
WHERE "sectionId" IN (SELECT "id" FROM "Section" WHERE "name" = '求助');

UPDATE "Post"
SET "sectionId" = (SELECT "id" FROM "Section" WHERE "name" = '其他')
WHERE "sectionId" IN (SELECT "id" FROM "Section" WHERE "name" = '吐槽');

DELETE FROM "Section" WHERE "name" IN ('二手', '求助', '吐槽');
