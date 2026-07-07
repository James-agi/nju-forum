# GitHub 部署方案

本文档记录 `njuknow.xyz` 从手工上传部署切换到 GitHub 部署后的日常操作。

## 当前状态

- 本地仓库远端：`https://github.com/James-agi/nju-forum.git`
- 当前本地分支：`001-nju-knowledge-p0`
- 本地分支已推送到 GitHub，并应在部署前保持与远端同名分支对齐。
- 当前线上 PM2 运行目录：`/var/www/njuknow-releases/a3ea602`
- 当前线上代码版本：`7143a71`
- 旧目录 `/var/www/njuknow` 仍保留，用于保存旧部署和部分共享静态资源。
- 生产配置 `.env` 只保存在服务器，不提交到 GitHub。
- 服务器数据库的 `_prisma_migrations` 历史已经补齐，`prisma migrate status` 已显示最新；但生产迁移仍默认关闭，涉及数据库结构变更时必须单独备份和确认。
- 服务器已经配置 2G swap，但 2G 内存机器仍不适合承担 `next build`。
- 当前推荐改为 GitHub Actions 手动触发部署：GitHub 负责安装依赖和构建，服务器只接收已构建产物并切换 PM2。

## 推荐方案

使用“GitHub Actions 手动触发 + Next standalone 产物上传”的方式部署。

原因：

- GitHub Actions 是手动触发，不会每次 push 自动影响线上网站。
- 构建发生在 GitHub runner 上，不再占用服务器内存和 CPU。
- 服务器 `.env` 继续只保存在服务器，不提交到 GitHub。
- 数据库迁移仍然默认不执行，避免顺手改生产数据库。

部署流程：

```text
本地确认代码
-> 提交并推送到 GitHub
-> 在 GitHub Actions 手动运行 Deploy production
-> GitHub 安装依赖、生成 Prisma client、执行 next build
-> GitHub 打包 .next/standalone 产物并上传服务器
-> 服务器解压到新的 release 目录、复制 .env、软链接共享资源、临时端口自检、切换 PM2、做本机健康检查
```

旧的 `scripts/deploy-production.sh` 仍保留，但它会在服务器上安装依赖和构建。除非后续服务器配置升级，否则不要再把它作为日常部署方式。

## 部署前必须确认

1. 本地 `git status` 干净，确认哪些文件要进 GitHub。
2. 确认 `.env`、`.codex-run/`、私钥、备份文件、上传图片不会被提交。
3. 如果涉及数据库结构变化，先备份数据库，并单独确认迁移方案。
4. 如果只是前端、普通 API、文档、非数据库逻辑变更，不需要运行 Prisma migration。
5. 确认服务器当前 PM2、Nginx 和 HTTPS 都正常。

## GitHub Secrets

仓库需要先配置这些 Secrets：

- `SERVER_HOST`：服务器公网 IP，例如 `47.80.18.70`
- `SERVER_USER`：SSH 用户，当前是 `admin`
- `SERVER_SSH_KEY`：用于登录服务器的私钥内容
- `SERVER_PORT`：可选，默认 `22`

不要把 `.env`、Resend key、数据库连接串放进 GitHub Secrets。生产 `.env` 继续留在服务器现有 release 或 `/var/www/njuknow/.env`。

## 日常部署方式

1. 本地确认改动。
2. 提交并推送到 `001-nju-knowledge-p0`。
3. 打开 GitHub 仓库的 Actions。
4. 选择 `Deploy production`。
5. 点击 `Run workflow`，选择 `001-nju-knowledge-p0` 分支。
6. 等待 workflow 完成。

workflow 成功后，会检查：

- GitHub 构建成功。
- 服务器临时端口 `/login`、`/knowledge` 能打开。
- PM2 切换后本机 `3000` 端口 `/login`、`/knowledge` 能打开。
- 公网 `https://njuknow.xyz/login`、`https://njuknow.xyz/knowledge` 能打开。

如果临时端口自检失败，脚本不会切换 PM2。如果切换后健康检查失败，脚本会尝试把 PM2 回滚到旧 release。

## 线上共享资源

- `public/knowledge-images` 当前软链接到 `/var/www/njuknow/public/knowledge-images`。
- `public/pdfs` 当前软链接到 `/var/www/njuknow/public/pdfs`。
- `public/forum-images` 当前软链接到 `/var/www/njuknow/public/forum-images`。
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

## 服务器端产物部署脚本

GitHub Actions 会把构建产物和 `scripts/deploy-artifact-production.sh` 上传到服务器 `/tmp`，然后执行：

```bash
RELEASE_NAME=<timestamp-sha> bash /tmp/njuknow-deploy-artifact-production.sh /tmp/<artifact>.tar.gz
```

这个脚本不会执行：

- `npm ci`
- `npm install`
- `npm run build`
- `prisma migrate deploy`

它只负责解压已构建产物、复制服务器 `.env`、连接共享上传目录、临时启动自检、切换 PM2。
