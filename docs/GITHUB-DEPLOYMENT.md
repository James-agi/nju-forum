# GitHub 部署方案

本文档记录 `njuknow.xyz` 从手工上传部署切换到 GitHub 部署的建议步骤。

## 当前状态

- 本地仓库远端：`https://github.com/James-agi/nju-forum.git`
- 当前本地分支：`001-nju-knowledge-p0`
- 本地分支已推送到 GitHub，当前与远端同名分支对齐。
- 本地仍有多处未提交改动和未追踪文件。
- 服务器目录 `/var/www/njuknow` 当前不是 Git 仓库。
- 服务器上存在运行期文件：`.env`、`.next`、`node_modules`、`.env.bak-*`、`.codex-backups/`。
- 服务器上存在上传资源目录，例如 `public/knowledge-images/` 和 `public/forum-images/`，这些目录被 `.gitignore` 忽略，不应直接依赖 GitHub 管理。

## 推荐方案

先使用“服务器手动从 GitHub 拉取部署”，不要一开始就上 GitHub Actions。

原因：

- 对新手更可控，不会每次 push 都自动影响线上网站。
- 服务器 `.env` 可以继续只保存在服务器，不需要放进 GitHub。
- 出问题时容易回到当前手工部署版本。

部署流程：

```text
本地确认代码
-> 提交并推送到 GitHub
-> SSH 到服务器
-> 运行 scripts/deploy-production.sh
-> 服务器拉取 GitHub 最新代码、安装依赖、迁移数据库、构建、重启 PM2
```

## 切换前必须完成

1. 整理本地改动，确认哪些文件要进 GitHub。
2. 确认 `.env`、`.codex-run/`、私钥、备份文件、上传图片不会被提交。
3. 确认上传资源目录的保存方式：
   - 短期：继续保留在服务器的 `public/knowledge-images/` 和 `public/forum-images/`。
   - 长期：迁移到对象存储，例如 OSS。
4. 备份服务器当前目录和数据库。
5. 在服务器创建一个新的 Git 部署目录，验证成功后再切换。

## 首次切换建议

不要直接覆盖 `/var/www/njuknow`。建议先新建目录：

```bash
sudo mkdir -p /var/www/njuknow-git
sudo chown -R admin:admin /var/www/njuknow-git
git clone -b 001-nju-knowledge-p0 https://github.com/James-agi/nju-forum.git /var/www/njuknow-git
```

然后复制服务器现有生产配置：

```bash
sudo cp /var/www/njuknow/.env /var/www/njuknow-git/.env
```

如果要保留当前图片资源，也需要复制：

```bash
sudo mkdir -p /var/www/njuknow-git/public
sudo cp -a /var/www/njuknow/public/knowledge-images /var/www/njuknow-git/public/ 2>/dev/null || true
sudo cp -a /var/www/njuknow/public/forum-images /var/www/njuknow-git/public/ 2>/dev/null || true
```

进入新目录测试部署：

```bash
cd /var/www/njuknow-git
bash scripts/deploy-production.sh
```

确认无误后，再决定是否把 PM2 和 Nginx 指向新目录。

## 日常部署命令

服务器进入 Git 仓库目录后执行：

```bash
cd /var/www/njuknow-git
bash scripts/deploy-production.sh
```

默认变量：

```bash
APP_DIR=/var/www/njuknow
DEPLOY_BRANCH=001-nju-knowledge-p0
PM2_APP=njuknow
```

如果实际目录是 `/var/www/njuknow-git`，可以这样运行：

```bash
APP_DIR=/var/www/njuknow-git bash scripts/deploy-production.sh
```

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

## 后续可选：GitHub Actions

等手动部署稳定后，再考虑 GitHub Actions。

GitHub Actions 需要额外配置仓库 Secrets：

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_SSH_KEY`
- `APP_DIR`

对当前阶段来说，手动从 GitHub 拉取部署更简单、安全。
