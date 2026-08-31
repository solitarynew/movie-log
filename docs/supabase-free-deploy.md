# Supabase Free + GitHub Pages 部署记录

## 需要的账户

只需要一个 GitHub 账号和一个 Supabase 账号。创建项目时选择 Free 计划，不开通 Pro，不绑定付费资源，不输入 service-role key 到前端。

## Supabase 控制台

1. 创建一个 Free 项目，记下 Project URL 和 Project Settings → API → Publishable key（旧项目可能显示 anon key）。
2. 在 SQL Editor 中执行 `supabase/migrations/0001_movie_log.sql`。
3. 在 Edge Functions 中部署 `supabase/functions/movie-search/index.ts`；使用 Supabase CLI 时命令为：

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase functions deploy movie-search
   ```

4. Authentication → Providers 确认 Email 已开启。注册时会收到验证码；登录 session 默认持久化在本地浏览器并自动刷新。

## GitHub Pages

把项目推送到 `main` 分支，并在仓库 Settings → Secrets and variables → Actions → New repository secret 添加：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

`.github/workflows/deploy-pages.yml` 会自动构建 `out/` 并发布 Pages。项目站点地址形如 `https://<github-用户名>.github.io/<仓库名>/`，后续提交仍使用同一个地址。

## 免费心跳

Supabase Free 长期没有请求时可能暂停。可在 cron-job.org 创建一个每 3 天执行的 GET：

```text
https://<project-ref>.supabase.co/rest/v1/app_health?select=id
```

请求头只需要：

```text
apikey: <publishable-or-anon-key>
Authorization: Bearer <publishable-or-anon-key>
```

这个接口只返回一个布尔值，不读用户数据，也不写入数据库。若不想注册第三方定时服务，也可以手动每周打开一次网站；GitHub Actions 定时任务不作为唯一保活手段，因为 GitHub 对长期没有仓库活动的 scheduled workflow 有自动停用规则。
