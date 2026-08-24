# ZhongSai CRM 后端

深圳市中赛钢结构进出口有限公司海外广告线索 CRM MVP 后端。

项目同时包含中文响应式前端，位于 `apps/web`。运行 `pnpm web:dev` 启动前端，运行 `pnpm web:build` 生成生产构建。

## 已实现范围

- 管理员、销售登录与角色权限隔离；
- Access Token、Refresh Token、退出登录及账号停用；
- 客户线索、中文状态配置、快速状态变更；
- 无联系方式线索正常入库并进入待核查队列；
- 疑似垃圾、疑似重复与人工无效确认；
- 个人标签和管理员共享标签；
- 跟进记录和下一次跟进时间；
- 微信优先、WhatsApp/电话/邮箱后备的均衡分配；
- 管理首页、来源、质量、状态及广告归因统计；
- Meta Webhook 验证、签名校验、Graph API 拉取、幂等导入和失败重试；
- Swagger、审计日志、Docker 与健康检查。

## 本地运行

1. 将 `.env.example` 复制为 `.env`，替换所有密钥和数据库密码。
2. 安装依赖：`pnpm install`。
3. 生成 Prisma Client：`pnpm prisma:generate`。
4. 创建数据库迁移：`pnpm prisma:migrate`。
5. 初始化状态和管理员：`pnpm prisma:seed`。
6. 启动：`pnpm dev`。

Swagger 地址：`http://localhost:3000/api/docs`

健康检查：`http://localhost:3000/api/health`

## 主要接口分组

- `/api/auth`：登录、刷新、退出、修改密码；
- `/api/users`：管理员账号管理；
- `/api/leads`：客户、状态、分配和核查；
- `/api/leads/:leadId/follow-ups`：跟进记录；
- `/api/tags`：个人及共享标签；
- `/api/analytics`：首页和广告统计；
- `/api/integrations/meta/webhook`：Meta Lead Ads Webhook；
- `/api/integrations/meta/import`：管理员测试导入。

## Meta 配置

正式接入时在 Meta 后台填写：

- Callback URL：`https://crm.公司官网域名.com/api/integrations/meta/webhook`
- Verify Token：与 `.env` 中 `META_VERIFY_TOKEN` 一致；
- App Secret：填写到 `META_APP_SECRET`；
- Page Access Token：填写到 `META_PAGE_ACCESS_TOKEN`。

Webhook 接收器会先保存原始事件，再从 Graph API 拉取完整 Lead。没有联系方式或疑似垃圾的表单不会被删除，而是进入待核查队列。

## 生产部署

生产环境使用 Docker Compose 运行 PostgreSQL、NestJS API，以及内置 Caddy 的响应式前端。只有 80/443 端口对公网开放；API 与数据库不直接暴露。Caddy 会为 `crm.zhongsai-steelstructure.com` 自动申请和续期 HTTPS 证书。

1. 将项目上传到服务器并进入项目目录。
2. 执行 `bash scripts/init-production-env.sh`，在服务器终端本地设置管理员手机号和初始密码。
3. 执行 `sudo docker compose build`。
4. 执行 `sudo docker compose up -d`。
5. 首次部署执行 `sudo docker compose exec api ./node_modules/.bin/ts-node prisma/seed.ts` 初始化状态和管理员；升级现有系统时不要重复执行。
6. 通过 `sudo docker compose ps` 和 `sudo docker compose logs --tail=100` 检查服务。

Meta Webhook 地址为 `https://crm.zhongsai-steelstructure.com/api/integrations/meta/webhook`。

## 生产注意事项

- 必须替换 JWT、数据库、Meta 和初始管理员密码；
- 必须通过 HTTPS 暴露 Meta Webhook；
- 数据库不应直接暴露公网；
- 建议每天备份 PostgreSQL；
- Cloudflare 首次签发证书时保持“仅 DNS”，证书签发后可启用代理并设置为 Full (strict)。
- 建议在首次可用后创建服务器快照，并配置每天的 PostgreSQL 异地备份。
