import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase is the browser backend. The compatibility exports keep the existing
// page API stable while the project moves away from the old CloudBase runtime.

export type CloudUser = {
  id: string;
  email?: string;
  username?: string;
  name?: string;
  is_anonymous?: boolean;
};

export type RemoteStore = {
  films: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  cinemas: Array<Record<string, unknown>>;
};

export type DoubanMetadata = Record<string, {
  title?: string;
  matchedTitle?: string;
  subjectId?: string;
  status?: string;
  doubanUrl?: string;
  poster?: string;
  doubanRating?: string;
  synopsis?: string;
  director?: string;
  cast?: string;
  genres?: string;
  countries?: string;
  languages?: string;
  runtimeMinutes?: string;
  releaseDate?: string;
  note?: string;
}>;

export type EventDateMigration = {
  type: 'event-date-migration';
  updates: Array<{ title: string; watchedDate: string; watchGroup?: string }>;
};

export type MovieCandidate = {
  subjectId: string;
  title: string;
  year: string;
  poster: string;
  doubanUrl: string;
  director?: string;
  cast?: string;
  genres?: string;
  releaseDate?: string;
};

export type MovieMetadata = {
  subjectId: string;
  title: string;
  matchedTitle: string;
  poster: string;
  posterDataUrl?: string;
  doubanRating: string;
  synopsis: string;
  director: string;
  cast: string;
  genres: string;
  countries: string;
  languages: string;
  runtimeMinutes: string;
  releaseDate: string;
  doubanUrl: string;
  sourceNote: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// These names are retained as a compatibility layer for the existing page.
// They now mean “the Supabase-backed mode”. No service-role secret is bundled.
export const cloudBaseDatabaseMode = 'supabase';
export const cloudBaseConfigured = Boolean(supabaseUrl && supabaseKey);

let client: SupabaseClient | null = null;

function getClient() {
  if (!cloudBaseConfigured) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export function getCloudAuth() {
  return getClient()?.auth || null;
}

function requireClient() {
  const current = getClient();
  if (!current) throw new Error('Supabase 尚未配置，请完成部署配置');
  return current;
}

function text(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function subjectIdFromUrl(value: string) {
  return value.match(/\/subject\/(\d+)/)?.[1] || '';
}

function metadataExpiry(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function throwIfError(result: { error?: { message?: string } } | null | undefined, fallback: string) {
  if (result?.error) throw new Error(result.error.message || fallback);
}

async function callMovieSearch(data: Record<string, unknown>) {
  const current = requireClient();
  const result = await current.functions.invoke('movie-search', { body: data });
  if (result.error) throw new Error(result.error.message || '电影资料查询失败');
  const payload = result.data as { ok?: boolean; error?: string; candidates?: MovieCandidate[]; metadata?: MovieMetadata; posterDataUrl?: string } | undefined;
  if (!payload?.ok) throw new Error(payload?.error || '电影资料查询失败');
  return payload;
}

export async function searchCloudMovie(title: string, userId: string) {
  void userId;
  const payload = await callMovieSearch({ action: 'search', title });
  return { candidates: payload.candidates || [] };
}

export async function loadCloudMovieMetadata(candidate: MovieCandidate, userId: string) {
  void userId;
  const payload = await callMovieSearch({ action: 'detail', title: candidate.title, subjectId: candidate.subjectId, fallback: candidate });
  if (!payload.metadata) throw new Error('电影资料为空');
  return payload.metadata;
}

export async function loadCloudPoster(posterUrl: string, userId: string) {
  void userId;
  const payload = await callMovieSearch({ action: 'poster', title: '海报修复', posterUrl });
  return payload.posterDataUrl || '';
}

function filmFromRow(row: Record<string, unknown>) {
  return {
    id: text(row.id), title: text(row.title), poster: text(row.poster), releaseDate: text(row.release_date),
    doubanRating: text(row.douban_rating), synopsis: text(row.synopsis), director: text(row.director),
    cast: text(row.cast_names), genres: text(row.genres), countries: text(row.countries), languages: text(row.languages), runtimeMinutes: text(row.runtime_minutes), sourceNote: text(row.source_note),
    doubanSubjectId: text(row.douban_subject_id), doubanUrl: text(row.douban_url), metadataFetchedAt: text(row.metadata_fetched_at), metadataExpiresAt: text(row.metadata_expires_at),
    createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  };
}

function eventFromRow(row: Record<string, unknown>) {
  return {
    id: text(row.id), filmId: text(row.film_id), watchedDate: text(row.watched_date), watchGroup: text(row.watch_group),
    status: row.status === 'planned' ? 'planned' : 'watched', myRating: text(row.my_rating),
    shortReview: text(row.short_review), scene: text(row.scene), dateNote: text(row.date_note),
    cinemaId: text(row.cinema_id), hall: text(row.hall), seat: text(row.seat), watchedTime: text(row.watched_time),
    ticketStatus: text(row.ticket_status), ticketSource: text(row.ticket_source),
    createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  };
}

function cinemaFromRow(row: Record<string, unknown>) {
  return {
    id: text(row.id), name: text(row.name), address: text(row.address), sourceNote: text(row.source_note),
    createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  };
}

function timestamp(value: unknown) {
  return text(value) || new Date().toISOString();
}

function filmToRow(film: Record<string, unknown>, userId: string) {
  return {
    id: text(film.id), owner_id: userId, title: text(film.title), poster: text(film.poster), release_date: text(film.releaseDate),
    douban_rating: text(film.doubanRating), synopsis: text(film.synopsis), director: text(film.director),
    cast_names: text(film.cast), genres: text(film.genres), countries: text(film.countries), languages: text(film.languages), runtime_minutes: text(film.runtimeMinutes), source_note: text(film.sourceNote),
    douban_subject_id: text(film.doubanSubjectId), douban_url: text(film.doubanUrl), metadata_fetched_at: text(film.metadataFetchedAt) || null, metadata_expires_at: text(film.metadataExpiresAt) || null,
    created_at: timestamp(film.createdAt), updated_at: timestamp(film.updatedAt),
  };
}

function eventToRow(event: Record<string, unknown>, userId: string) {
  return {
    id: text(event.id), owner_id: userId, film_id: text(event.filmId), watched_date: text(event.watchedDate), watch_group: text(event.watchGroup),
    status: event.status === 'planned' ? 'planned' : 'watched', my_rating: text(event.myRating), short_review: text(event.shortReview), scene: text(event.scene), date_note: text(event.dateNote),
    cinema_id: text(event.cinemaId) || null, hall: text(event.hall), seat: text(event.seat), watched_time: text(event.watchedTime), ticket_status: text(event.ticketStatus), ticket_source: text(event.ticketSource),
    created_at: timestamp(event.createdAt), updated_at: timestamp(event.updatedAt),
  };
}

function cinemaToRow(cinema: Record<string, unknown>, userId: string) {
  return {
    id: text(cinema.id), owner_id: userId, name: text(cinema.name), address: text(cinema.address), source_note: text(cinema.sourceNote),
    created_at: timestamp(cinema.createdAt), updated_at: timestamp(cinema.updatedAt),
  };
}

const filmFieldMap: Record<string, string> = {
  title: 'title', poster: 'poster', releaseDate: 'release_date', doubanRating: 'douban_rating', synopsis: 'synopsis', director: 'director', cast: 'cast_names', genres: 'genres', countries: 'countries', languages: 'languages', runtimeMinutes: 'runtime_minutes', sourceNote: 'source_note',
  createdAt: 'created_at', updatedAt: 'updated_at', doubanSubjectId: 'douban_subject_id', doubanUrl: 'douban_url', metadataFetchedAt: 'metadata_fetched_at', metadataExpiresAt: 'metadata_expires_at',
};
const eventFieldMap: Record<string, string> = {
  filmId: 'film_id', watchedDate: 'watched_date', watchGroup: 'watch_group', status: 'status', myRating: 'my_rating', shortReview: 'short_review', scene: 'scene', dateNote: 'date_note', cinemaId: 'cinema_id', hall: 'hall', seat: 'seat', watchedTime: 'watched_time', ticketStatus: 'ticket_status', ticketSource: 'ticket_source',
  createdAt: 'created_at', updatedAt: 'updated_at',
};

function patchToRow(patch: Record<string, unknown>, fieldMap: Record<string, string>) {
  return Object.entries(fieldMap).reduce<Record<string, unknown>>((result, [from, to]) => {
    if (Object.prototype.hasOwnProperty.call(patch, from)) result[to] = patch[from];
    return result;
  }, {});
}

export async function getCloudUser(): Promise<CloudUser | null> {
  const current = getClient();
  if (!current) return null;
  const result = await current.auth.getUser();
  if (result.error || !result.data.user) return null;
  const user = result.data.user;
  return { id: user.id, email: user.email, username: text(user.user_metadata?.username), name: text(user.user_metadata?.name), is_anonymous: false };
}

export async function signInWithPassword(identifier: string, password: string) {
  const current = requireClient();
  const email = identifier.trim();
  if (!email.includes('@')) throw new Error('Supabase 登录请填写邮箱地址');
  const result = await current.auth.signInWithPassword({ email, password });
  if (result.error) throw new Error(result.error.message || '登录失败');
  return result.data.user ? { id: result.data.user.id, email: result.data.user.email } : null;
}

export async function startEmailSignup(email: string, password: string, username: string) {
  const current = requireClient();
  const emailRedirectTo = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : undefined;
  const result = await current.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo } });
  if (result.error) throw new Error(result.error.message || '发送确认邮件失败');
  return { email, session: result.data.session };
}

export async function signOutCloud() {
  const current = getClient();
  if (current) await current.auth.signOut();
}

async function readTable(table: string, userId: string) {
  const result = await requireClient().from(table).select('*').eq('owner_id', userId).order('created_at', { ascending: true });
  throwIfError(result, `${table} 读取失败`);
  return (result.data || []) as Array<Record<string, unknown>>;
}

export async function loadCloudStore(userId: string): Promise<RemoteStore> {
  const [filmRows, eventRows, cinemaRows] = await Promise.all([
    readTable('movie_films', userId), readTable('movie_events', userId), readTable('movie_cinemas', userId),
  ]);
  return { films: filmRows.map(filmFromRow), events: eventRows.map(eventFromRow), cinemas: cinemaRows.map(cinemaFromRow) };
}

const CLOUD_SYNC_INTERVAL_MS = 60_000;

export function watchCloudStore(userId: string, onChange: (store: RemoteStore) => void, onError: (error: Error) => void) {
  const current = requireClient();
  let active = true;
  let syncing = false;
  const refresh = async () => {
    if (!active || syncing || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    syncing = true;
    try { onChange(await loadCloudStore(userId)); }
    catch (error) { if (active) onError(error instanceof Error ? error : new Error('同步失败')); }
    finally { syncing = false; }
  };
  void refresh();
  const channel = current.channel(`movie-log:${userId}`);
  (['movie_films', 'movie_events', 'movie_cinemas'] as const).forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `owner_id=eq.${userId}` }, () => { void refresh(); });
  });
  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR' && active) onError(new Error('实时同步连接失败，页面仍会每分钟检查一次'));
  });
  const timer = window.setInterval(() => { void refresh(); }, CLOUD_SYNC_INTERVAL_MS);
  const onVisibilityChange = () => { if (document.visibilityState === 'visible') void refresh(); };
  const onFocus = () => { void refresh(); };
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', onFocus);
  return () => {
    active = false;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('focus', onFocus);
    void current.removeChannel(channel);
  };
}

export async function addCloudRecords(film: Record<string, unknown>, event: Record<string, unknown>, userId: string) {
  const current = requireClient();
  const filmResult = await current.from('movie_films').insert(filmToRow(film, userId));
  throwIfError(filmResult, '电影资料保存失败');
  const eventResult = await current.from('movie_events').insert(eventToRow(event, userId));
  if (eventResult.error) {
    await current.from('movie_films').delete().eq('id', text(film.id)).eq('owner_id', userId);
    throwIfError(eventResult, '观影事件保存失败');
  }
}

export async function addCloudEvent(event: Record<string, unknown>, userId: string) {
  const result = await requireClient().from('movie_events').insert(eventToRow(event, userId));
  throwIfError(result, '观影事件保存失败');
}

export async function findOrCreateCloudCinema(name: string, userId: string) {
  const normalized = name.trim();
  if (!normalized) return null;
  const current = requireClient();
  const existing = await current.from('movie_cinemas').select('*').eq('owner_id', userId).eq('name', normalized).maybeSingle();
  throwIfError(existing, '电影院查找失败');
  if (existing.data) return cinemaFromRow(existing.data as Record<string, unknown>);
  const timestampValue = new Date().toISOString();
  const cinema = { id: `cinema-${crypto.randomUUID()}`, name: normalized, address: '', sourceNote: '由票根导入或观影记录创建', createdAt: timestampValue, updatedAt: timestampValue };
  const result = await current.from('movie_cinemas').insert(cinemaToRow(cinema, userId));
  throwIfError(result, '电影院保存失败');
  return cinema;
}

async function insertBatches(table: string, rows: Array<Record<string, unknown>>) {
  const current = requireClient();
  for (let index = 0; index < rows.length; index += 100) {
    const result = await current.from(table).upsert(rows.slice(index, index + 100), { onConflict: 'id' });
    throwIfError(result, `${table} 导入失败`);
  }
}

export async function addCloudStore(store: RemoteStore, userId: string) {
  await insertBatches('movie_films', store.films.map((film) => filmToRow(film, userId)));
  await insertBatches('movie_cinemas', store.cinemas.map((cinema) => cinemaToRow(cinema, userId)));
  await insertBatches('movie_events', store.events.map((event) => eventToRow(event, userId)));
}

export async function updateCloudFilm(filmId: string, patch: Record<string, unknown>, userId: string) {
  const payload = patchToRow(patch, filmFieldMap);
  payload.updated_at = new Date().toISOString();
  const result = await requireClient().from('movie_films').update(payload).eq('id', filmId).eq('owner_id', userId);
  throwIfError(result, '电影资料更新失败');
}

export async function updateCloudEventDates(migration: EventDateMigration, userId: string) {
  const current = requireClient();
  let updated = 0;
  for (const update of migration.updates) {
    const filmsResult = await current.from('movie_films').select('id').eq('owner_id', userId).eq('title', update.title);
    throwIfError(filmsResult, `电影查找失败：${update.title}`);
    for (const film of (filmsResult.data || []) as Array<Record<string, unknown>>) {
      let eventQuery = current.from('movie_events').select('id').eq('owner_id', userId).eq('film_id', film.id);
      if (update.watchGroup !== undefined) eventQuery = eventQuery.eq('watch_group', update.watchGroup);
      const eventsResult = await eventQuery;
      throwIfError(eventsResult, `观影记录查找失败：${update.title}`);
      for (const event of (eventsResult.data || []) as Array<Record<string, unknown>>) {
        const result = await current.from('movie_events').update({ watched_date: update.watchedDate, updated_at: new Date().toISOString() }).eq('id', event.id).eq('owner_id', userId);
        throwIfError(result, `观影日期更新失败：${update.title}`);
        updated += 1;
      }
    }
  }
  return { updated };
}

export async function updateCloudDoubanMetadata(metadata: DoubanMetadata, userId: string) {
  const current = requireClient();
  let updated = 0;
  let pending = 0;
  for (const [title, item] of Object.entries(metadata)) {
    const filmsResult = await current.from('movie_films').select('id').eq('owner_id', userId).eq('title', title);
    throwIfError(filmsResult, `电影查找失败：${title}`);
    const films = (filmsResult.data || []) as Array<Record<string, unknown>>;
    if (item?.status !== 'matched') {
      const pendingNote = `豆瓣匹配待确认${item?.note ? `：${item.note}` : ''}`;
      for (const film of films) {
        const result = await current.from('movie_films').update({ source_note: pendingNote, updated_at: new Date().toISOString() }).eq('id', text(film.id)).eq('owner_id', userId);
        throwIfError(result, `待确认标记更新失败：${title}`);
      }
      pending += films.length;
      continue;
    }
    const payload: Record<string, unknown> = {
      title: item.matchedTitle || item.title || title,
      douban_subject_id: item.subjectId || subjectIdFromUrl(item.doubanUrl || ''), douban_url: item.doubanUrl || '', poster: item.poster || '', release_date: item.releaseDate || '', douban_rating: item.doubanRating || '', synopsis: item.synopsis || '', director: item.director || '', cast_names: item.cast || '', genres: item.genres || '',
      source_note: `${item.doubanUrl?.includes('douban.com') ? '豆瓣' : '公开资料'}：${item.doubanUrl || '详情页'}${item.matchedTitle && item.matchedTitle !== title ? `；原始清单标题：${title}` : ''}${item.note ? `；${item.note}` : ''}`,
      metadata_fetched_at: new Date().toISOString(), metadata_expires_at: metadataExpiry(), updated_at: new Date().toISOString(),
    };
    if (item.countries) payload.countries = item.countries;
    if (item.languages) payload.languages = item.languages;
    if (item.runtimeMinutes) payload.runtime_minutes = item.runtimeMinutes;
    for (const film of films) {
      const result = await current.from('movie_films').update(payload).eq('id', text(film.id)).eq('owner_id', userId);
      throwIfError(result, `电影资料更新失败：${title}`);
      updated += 1;
    }
  }
  return { updated, pending };
}

export async function updateCloudEvent(eventId: string, patch: Record<string, unknown>, userId: string) {
  const payload = patchToRow(patch, eventFieldMap);
  payload.updated_at = new Date().toISOString();
  const result = await requireClient().from('movie_events').update(payload).eq('id', eventId).eq('owner_id', userId);
  throwIfError(result, '观影事件更新失败');
}

export async function deleteCloudEvent(eventId: string, userId: string) {
  const result = await requireClient().from('movie_events').delete().eq('id', eventId).eq('owner_id', userId);
  throwIfError(result, '观影事件删除失败');
}

export async function deleteCloudFilm(filmId: string, userId: string) {
  const result = await requireClient().from('movie_films').delete().eq('id', filmId).eq('owner_id', userId);
  throwIfError(result, '电影资料删除失败');
}
