# GitHub 部署方案

本文档记录 `njuknow.xyz` 从手工上传部署切换到 GitHub 部署后的日常操作。

## 当前状态

- 本地仓库远端：`https://github.com/James-agi/nju-forum.git`
- 当前本地分支：`001-nju-knowledge-p0`
- 本地分支已推送到 GitHub，并应在部署前保持与远端同名分支对齐。
- 当前线上 PM2 运行目录：`/var/www/njuknow-releases/a3ea602`
- 当前线上代码版本：`c37af0d12960039fbfd2e65521a0f37f1dc9fc24`
- 旧目录 `/var/www/njuknow` 仍保留，用于保存旧部署和部分共享静态资源。
- 生产配置 `.env` 只保存在服务器，不提交到 GitHub。
- 服务器数据库的 `_prisma_migrations` 表目前不存在，但部分新字段已经手工补齐；不要默认自动执行 Prisma migration。

## 推荐方案

继续使用“服务器手动从 GitHub 拉取部署”，暂时不要上 GitHub Actions。

原因：

- 对新手更可控，不会每次 push 都自动影响线上网站。
- 服务器 `.env` 可以继续只保存在服务器，不需要放进 GitHub。
- 数据库迁移历史还没有整理干净，手动部署更容易控制风险。

部署流程：

```text
本地确认代码
-> 提交并推送到 GitHub
-> SSH 到服务器
-> 运行 scripts/deploy-production.sh
-> 服务器拉取 GitHub 最新代码、安装依赖、生成 Prisma client、构建、重启 PM2、做本机健康检查
```

## 部署前必须确认

1. 本地 `git status` 干净，确认哪些文件要进 GitHub。
2. 确认 `.env`、`.codex-run/`、私钥、备份文件、上传图片不会被提交。
3. 如果涉及数据库结构变化，先备份数据库，并单独确认迁移方案。
4. 如果只是前端、普通 API、文档、非数据库逻辑变更，不需要运行 Prisma migration。
5. 确认服务器当前 PM2、Nginx 和 HTTPS 都正常。

## 日常部署命令

服务器进入当前线上 Git 仓库目录后执行：

```bash
cd /var/www/njuknow-releases/a3ea602
APP_DIR=/var/www/njuknow-releases/a3ea602 bash scripts/deploy-production.sh
```

默认不会执行数据库迁移。只有在已经确认生产数据库 migration 状态安全后，才允许这样运行：

```bash
APP_DIR=/var/www/njuknow-releases/a3ea602 RUN_DB_MIGRATIONS=1 bash scripts/deploy-production.sh
```

脚本常用变量：

```bash
APP_DIR=/var/www/njuknow-releases/a3ea602
DEPLOY_BRANCH=001-nju-knowledge-p0
PM2_APP=njuknow
PORT=3000
APP_HOST=0.0.0.0
RUN_DB_MIGRATIONS=0
```

## 线上共享资源

- `public/knowledge-images` 当前软链接到 `/var/www/njuknow/public/knowledge-images`。
- `public/pdfs` 当前软链接到 `/var/www/njuknow/public/pdfs`。
- `public/forum-images` 还需要补成共享目录或软链接，否则用户上传的论坛图片会写入当前 release 目录，不利于后续发布。
- 长期建议把图片、PDF 迁移到对象存储，例如 OSS。

## 不能提交到 GitHub 的内容

- `.env`
- `.env.local`
- `.codex-run/`
- SSH 私钥
- `.env.bak-*`
- `.codex-backups/`
- `node_modules/`
- `.next/`
- 数据库备份文件
- 临时调试文件
- 线上上传的图片和 PDF

## 后续可选：GitHub Actions

等手动部署稳定后，再考虑 GitHub Actions。

GitHub Actions 需要额外配置仓库 Secrets：

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_SSH_KEY`
- `APP_DIR`

对当前阶段来说，手动从 GitHub 拉取部署更简单、安全。
