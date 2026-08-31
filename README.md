# 观影记录 · Personal Screening Room

一个个人观影档案：电影资料和每一次观影事件分开保存，支持重复观看、影展标签、影院/影厅/座位、评分、短评、报告和跨设备同步。

## 免费部署架构

- GitHub Pages：托管静态前端，网站地址固定为 GitHub Pages 地址；之后每次部署只更新同一个地址。
- Supabase Free：邮箱登录、Postgres 数据库、RLS 用户隔离、Realtime 实时同步，以及电影海报/资料查询的 Edge Function。
- 可选 cron-job.org：每 3 天请求一次只读 `app_health`，减少 Supabase Free 因长期无活动而暂停的概率。它不写入电影数据，也不需要 service-role key。

本项目不使用腾讯云旧 PG 环境，也不把任何 Supabase `service_role`、数据库密码或 AccessKey 放进浏览器。前端只使用 publishable/anon key，数据库安全由 RLS 策略保证。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` 需要填：

```env
NEXT_PUBLIC_SUPABASE_URL=https://你的项目.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的_publishable_key
```

未配置时仍可本地打开，但只使用浏览器本地存储；配置后才启用云端登录和同步。

## Supabase 初始化

数据库结构位于 `supabase/migrations/0001_movie_log.sql`，包括：

- `movie_films`：一部电影及一个豆瓣条目引用、资料缓存。
- `movie_events`：一次观看；`watched_date` 可保存 `YYYY-MM` 或 `YYYY-MM-DD`，不写入上映日期。
- `movie_cinemas`：影院资料；事件通过 `cinema_id` 关联，影厅和座位保留为文字。
- `app_health`：不含用户数据的只读心跳表。

应用会使用 Supabase Auth 的持久 session（localStorage + 自动刷新），同一账号在手机和电脑登录后读取同一份数据。Realtime 连接失败时仍会在切回前台、获得焦点和每分钟进行一次兜底刷新。

## 豆瓣资料

`supabase/functions/movie-search/index.ts` 是受 JWT 保护的 Edge Function：搜索候选时返回年份、导演和前几位演员；用户确认版本后再读取详情；海报失败时可由服务器下载为 data URL。电影资料保存 `doubanSubjectId`、`doubanUrl` 和 30 天缓存时间，资料和观影日期始终分离。

## GitHub Pages

工作流文件为 `.github/workflows/deploy-pages.yml`。需要在 GitHub 仓库 Secrets 中设置：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

工作流构建 `out/` 并发布到 GitHub Pages。GitHub 仓库名确定后，若使用项目站点，需要同步配置 `basePath`；若使用 `<用户名>.github.io` 用户站点，则地址最简洁。

## 数据导入

页面仍支持导入现有 JSON。导入顺序为电影资料、影院、观影事件，并按 ID upsert，重复观看事件不会被去重。旧腾讯云环境不可读时，可使用工作区保留的本地恢复文件重新导入；导入前不会覆盖已存在的不同 ID 记录。
