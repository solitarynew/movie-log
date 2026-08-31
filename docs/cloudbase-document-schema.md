# CloudBase 免费文档型数据库迁移说明

网站的免费模式使用三个集合：

- `movie_films`：一部电影的资料。关键字段为 `id`、`title`、`poster`、`release_date`、`douban_*`、`synopsis`、`director`、`cast_names`、`genres`、`countries`、`languages`、`runtime_minutes`、`created_at`、`updated_at`、`user_id`。
- `movie_events`：一次观影事件。关键字段为 `id`、`film_id`、`watched_date`、`watch_group`、`status`、`my_rating`、`short_review`、`scene`、`date_note`、`cinema_id`、`hall`、`seat`、`watched_time`、`ticket_*`、`created_at`、`updated_at`、`user_id`。
- `movie_cinemas`：电影院资料。关键字段为 `id`、`name`、`address`、`source_note`、`created_at`、`updated_at`、`user_id`。

每条文档都必须带当前 CloudBase 用户的 `user_id`。控制台安全规则应限制为：未登录用户不能读写；登录用户只能读写 `user_id` 等于自己用户 ID 的文档。代码层也会在更新和删除前再次校验归属。

切换配置：

```env
NEXT_PUBLIC_CLOUDBASE_DATABASE_MODE=document
```

文档模式使用 CloudBase SDK 的 JSON 文档读写和 `watch()` 实时监听；一次导入按 20 条小批次写入，避免集中消耗免费资源点。`release_date` 只保存电影资料的上映/发行日期，`watched_date` 只保存用户实际观看日期。
