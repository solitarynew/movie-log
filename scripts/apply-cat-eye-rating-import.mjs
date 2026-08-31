import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const envId = 'movie-d6g34ruu2ef5b97fe';
const ratingInput = JSON.parse(fs.readFileSync(new URL('./cat-eye-rating-import.json', import.meta.url), 'utf8'));
const newInput = JSON.parse(fs.readFileSync(new URL('./cat-eye-new-manual.json', import.meta.url), 'utf8'));
const ownerId = ratingInput.ownerId;
const source = `${ratingInput.source}（${ratingInput.capturedAt}）`;

function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function idPart(title, index) {
  const compact = title.replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${String(index + 1).padStart(3, '0')}-${compact || 'film'}`;
}

function runTcb(sqlText) {
  const output = execFileSync('tcb', ['db', 'execute', '-e', envId, '--json', '--sql', sqlText], { encoding: 'utf8' });
  const start = output.indexOf('{');
  if (start < 0) throw new Error(`CloudBase returned no JSON: ${output}`);
  const payload = JSON.parse(output.slice(start));
  if (payload.error) throw new Error(payload.error.message || 'CloudBase import failed');
  return payload;
}

const newTitles = new Set(newInput.records.map((record) => record.title));
const ratingRecords = ratingInput.records.filter((record) => !newTitles.has(record.title));
const newFilms = newInput.records.map((record, index) => ({ ...record, key: idPart(record.title, index) }));

const updateStatements = ratingRecords.map((record) => `
UPDATE public.movie_events e
SET my_rating = ${sql(record.rating)}, updated_at = now()
FROM public.movie_films f
WHERE e.owner_id = ${sql(ownerId)}
  AND e.film_id = f.id
  AND f.owner_id = ${sql(ownerId)}
  AND f.title = ${sql(record.title)};`).join('\n');

const filmStatements = newFilms.map((record) => `
INSERT INTO public.movie_films (
  id, owner_id, title, poster, release_date, douban_rating, synopsis, director,
  cast_names, genres, countries, languages, runtime_minutes, source_note,
  douban_subject_id, douban_url, metadata_fetched_at, metadata_expires_at, created_at, updated_at
)
VALUES (
  ${sql(`cat-eye-film-${record.key}`)}, ${sql(ownerId)}, ${sql(record.title)}, '', ${sql(record.releaseDate)}, '', '', '',
  '', '', '', '', '', ${sql(`${source}；上映月份按公开发行月份归档，豆瓣详细资料待后续补全`)},
  '', '', NULL, NULL, now(), now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.movie_events (
  id, owner_id, film_id, watched_date, watch_group, status, my_rating, short_review,
  scene, date_note, cinema_id, hall, seat, watched_time, ticket_status, ticket_source, created_at, updated_at
)
SELECT
  ${sql(`cat-eye-event-${record.key}`)}, ${sql(ownerId)}, f.id, ${sql(record.releaseDate)}, '', 'watched', ${sql(record.rating)},
  '', '', ${sql('猫眼评分截图导入；没有观影月份，暂按上映日期月份归档')}, NULL, '', '', '', '', ${sql(source)}, now(), now()
FROM public.movie_films f
WHERE f.owner_id = ${sql(ownerId)}
  AND f.title = ${sql(record.title)}
  AND NOT EXISTS (
    SELECT 1 FROM public.movie_events e
    WHERE e.id = ${sql(`cat-eye-event-${record.key}`)} AND e.owner_id = ${sql(ownerId)}
  );`).join('\n');

const sqlText = `
BEGIN;
${updateStatements}
${filmStatements}
SELECT
  (SELECT count(*) FROM public.movie_films WHERE owner_id = ${sql(ownerId)}) AS films_for_owner,
  (SELECT count(*) FROM public.movie_events WHERE owner_id = ${sql(ownerId)}) AS events_for_owner,
  (SELECT count(*) FROM public.movie_events WHERE owner_id = ${sql(ownerId)} AND ticket_source LIKE ${sql(`${source}%`)}) AS imported_ticket_source_events,
  (SELECT count(*) FROM public.movie_events WHERE owner_id = ${sql(ownerId)} AND ticket_source = ${sql(source)}) AS cat_eye_events;
COMMIT;`;

const payload = runTcb(sqlText);
const rows = payload.data?.Rows || [];
console.log(JSON.stringify({ source, ratingRecords: ratingRecords.length, newFilmCandidates: newFilms.length, rows }, null, 2));
