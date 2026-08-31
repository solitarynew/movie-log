import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const envId = 'movie-d6g34ruu2ef5b97fe';
const inputPath = new URL('./ticket-ocr-import.json', import.meta.url);
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const ownerId = input.ownerId;
const source = `${input.source}（${input.capturedAt}）`;
const records = input.records;

function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
}

function values(record) {
  return [record.title, record.month, record.watchGroup || '', record.date || '', record.time || '', record.cinema || '', record.hall || '', record.seat || '', record.status || '', record.note || '', record.scene || ''].map(sql).join(', ');
}

const cinemaNames = [...new Set(records.map((record) => record.cinema).filter(Boolean))];
const cinemaSql = cinemaNames.map((name, index) => `
  INSERT INTO public.movie_cinemas (id, owner_id, name, address, source_note, created_at, updated_at)
  VALUES (${sql(`ticket-cinema-${String(index + 1).padStart(3, '0')}`)}, ${sql(ownerId)}, ${sql(name)}, '', ${sql('由大麦票根截图导入；影院作为独立资料保存')}, now(), now())
  ON CONFLICT (owner_id, name) DO UPDATE SET updated_at = now();`).join('\n');

const recordValues = records.map((record) => `(${values(record)})`).join(',\n    ');
const sqlText = `
BEGIN;
CREATE TEMP TABLE ticket_ocr_input (
  title text NOT NULL,
  watched_month text NOT NULL,
  watch_group text NOT NULL DEFAULT '',
  watched_date text NOT NULL DEFAULT '',
  watched_time text NOT NULL DEFAULT '',
  cinema_name text NOT NULL DEFAULT '',
  hall text NOT NULL DEFAULT '',
  seat text NOT NULL DEFAULT '',
  ticket_status text NOT NULL DEFAULT '',
  import_note text NOT NULL DEFAULT '',
  scene text NOT NULL DEFAULT ''
) ON COMMIT DROP;
INSERT INTO ticket_ocr_input (title, watched_month, watch_group, watched_date, watched_time, cinema_name, hall, seat, ticket_status, import_note, scene)
VALUES
    ${recordValues};
${cinemaSql}
WITH updated AS (
  UPDATE public.movie_events e
  SET
    watched_date = CASE WHEN i.watched_date <> '' THEN i.watched_date ELSE e.watched_date END,
    status = CASE WHEN i.ticket_status = 'played' THEN 'watched' ELSE e.status END,
    cinema_id = c.id,
    hall = i.hall,
    seat = i.seat,
    watched_time = i.watched_time,
    ticket_status = i.ticket_status,
    ticket_source = ${sql(source)},
    date_note = CASE WHEN i.import_note <> '' THEN i.import_note ELSE e.date_note END,
    scene = CASE WHEN i.scene <> '' THEN i.scene ELSE e.scene END,
    updated_at = now()
  FROM ticket_ocr_input i
  JOIN public.movie_films f ON f.owner_id = ${sql(ownerId)} AND f.title = i.title
  LEFT JOIN public.movie_cinemas c ON c.owner_id = ${sql(ownerId)} AND c.name = i.cinema_name
  WHERE e.owner_id = ${sql(ownerId)}
    AND e.film_id = f.id
    AND e.watched_date LIKE i.watched_month || '%'
    AND COALESCE(e.watch_group, '') = i.watch_group
  RETURNING e.id
)
SELECT
  (SELECT count(*) FROM updated) AS updated_events,
  (SELECT count(*) FROM ticket_ocr_input) AS input_records,
  (SELECT count(*) FROM public.movie_cinemas WHERE owner_id = ${sql(ownerId)}) AS cinemas_for_owner;
COMMIT;`;

const output = execFileSync('tcb', ['db', 'execute', '-e', envId, '--json', '--sql', sqlText], { encoding: 'utf8' });
const jsonStart = output.indexOf('{');
if (jsonStart >= 0) {
  const payload = JSON.parse(output.slice(jsonStart));
  const rows = payload?.data?.Rows || [];
  console.log(JSON.stringify({ source, inputRecords: records.length, rows }, null, 2));
} else {
  console.log(output);
}
