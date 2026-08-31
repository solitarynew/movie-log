'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  addCloudEvent,
  addCloudRecords,
  addCloudStore,
  cloudBaseConfigured,
  deleteCloudEvent,
  deleteCloudFilm,
  finishEmailSignup,
  findOrCreateCloudCinema,
  getCloudAuth,
  getCloudUser,
  loadCloudMovieMetadata,
  loadCloudPoster,
  loadCloudStore,
  searchCloudMovie,
  signInWithPassword,
  signOutCloud,
  startEmailSignup,
  updateCloudDoubanMetadata,
  updateCloudEventDates,
  updateCloudEvent,
  updateCloudFilm,
  watchCloudStore,
  type CloudUser,
  type DoubanMetadata,
  type EventDateMigration,
  type MovieCandidate,
  type MovieMetadata,
} from './cloudbase';
import { confirmedDoubanMetadata, CONFIRMED_METADATA_VERSION } from './confirmed-metadata';

type Status = 'watched' | 'planned';

type Film = {
  id: string;
  title: string;
  doubanSubjectId: string;
  doubanUrl: string;
  metadataFetchedAt: string;
  metadataExpiresAt: string;
  poster: string;
  releaseDate: string;
  doubanRating: string;
  synopsis: string;
  director: string;
  cast: string;
  genres: string;
  countries: string;
  languages: string;
  runtimeMinutes: string;
  sourceNote: string;
  createdAt: string;
  updatedAt: string;
};

type WatchEvent = {
  id: string;
  filmId: string;
  watchedDate: string;
  watchGroup: string;
  status: Status;
  myRating: string;
  shortReview: string;
  scene: string;
  dateNote: string;
  cinemaId: string;
  hall: string;
  seat: string;
  watchedTime: string;
  ticketStatus: string;
  ticketSource: string;
  createdAt: string;
  updatedAt: string;
};

type Cinema = {
  id: string;
  name: string;
  address: string;
  sourceNote: string;
  createdAt: string;
  updatedAt: string;
};

type Store = { films: Film[]; events: WatchEvent[]; cinemas: Cinema[] };
type FormState = {
  title: string; doubanSubjectId: string; doubanUrl: string; metadataFetchedAt: string; metadataExpiresAt: string;
  poster: string; releaseDate: string; doubanRating: string; synopsis: string;
  director: string; cast: string; genres: string; sourceNote: string; watchedDate: string;
  countries: string; languages: string; runtimeMinutes: string;
  watchGroup: string; status: Status; myRating: string; shortReview: string; scene: string; dateNote: string;
  cinemaName: string; hall: string; seat: string; watchedTime: string; ticketStatus: string; ticketSource: string;
};
type ViewMode = 'compact' | 'expanded';
type PageView = 'records' | 'calendar' | 'festival' | 'report';

const STORAGE_KEY = 'movie-log-store-v1';
const EMPTY_STORE: Store = { films: [], events: [], cinemas: [] };

function id(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function now() { return new Date().toISOString(); }
function currentMonth() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; }
function toText(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? String(value) : ''; }
function metadataExpiryAt() { const date = new Date(); date.setDate(date.getDate() + 30); return date.toISOString(); }
function subjectIdFromUrl(value: string) { return value.match(/\/subject\/(\d+)/)?.[1] || ''; }
function isMetadataStale(film: Film) { return !film.doubanSubjectId || !film.metadataExpiresAt || Date.parse(film.metadataExpiresAt) <= Date.now(); }
function createEmptyForm(): FormState {
  return { title: '', doubanSubjectId: '', doubanUrl: '', metadataFetchedAt: '', metadataExpiresAt: '', poster: '', releaseDate: '', doubanRating: '', synopsis: '', director: '', cast: '', genres: '', countries: '', languages: '', runtimeMinutes: '', sourceNote: '', watchedDate: currentMonth(), watchGroup: '', status: 'planned', myRating: '', shortReview: '', scene: '', dateNote: '', cinemaName: '', hall: '', seat: '', watchedTime: '', ticketStatus: '', ticketSource: '' };
}
function parseStore(value: unknown): Store {
  if (value && typeof value === 'object' && 'films' in value && 'events' in value) {
    const data = value as { films?: unknown; events?: unknown; cinemas?: unknown };
    if (Array.isArray(data.films) && Array.isArray(data.events)) {
      return {
        films: data.films.filter((film): film is Film => Boolean(film && typeof film === 'object' && toText((film as Film).title))),
        events: data.events.filter((event): event is WatchEvent => Boolean(event && typeof event === 'object' && toText((event as WatchEvent).filmId))),
        cinemas: Array.isArray(data.cinemas) ? data.cinemas.filter((cinema): cinema is Cinema => Boolean(cinema && typeof cinema === 'object' && toText((cinema as Cinema).name))) : [],
      };
    }
  }
  if (Array.isArray(value)) {
    const films: Film[] = []; const events: WatchEvent[] = [];
    value.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const raw = item as Partial<FormState>; const title = toText(raw.title).trim(); if (!title) return;
      const createdAt = now(); const filmId = id('film');
      films.push({ id: filmId, title, doubanSubjectId: toText(raw.doubanSubjectId), doubanUrl: toText(raw.doubanUrl), metadataFetchedAt: toText(raw.metadataFetchedAt), metadataExpiresAt: toText(raw.metadataExpiresAt), poster: toText(raw.poster), releaseDate: toText(raw.releaseDate), doubanRating: toText(raw.doubanRating), synopsis: toText(raw.synopsis), director: toText(raw.director), cast: toText(raw.cast), genres: toText(raw.genres), countries: toText(raw.countries), languages: toText(raw.languages), runtimeMinutes: toText(raw.runtimeMinutes), sourceNote: toText(raw.sourceNote), createdAt, updatedAt: createdAt });
      events.push({ id: id('event'), filmId, watchedDate: toText(raw.watchedDate), watchGroup: toText(raw.watchGroup), status: raw.status === 'planned' ? 'planned' : 'watched', myRating: toText(raw.myRating), shortReview: toText(raw.shortReview), scene: toText(raw.scene), dateNote: toText(raw.dateNote), cinemaId: '', hall: '', seat: '', watchedTime: '', ticketStatus: '', ticketSource: '', createdAt, updatedAt: createdAt });
    });
    return { films, events, cinemas: [] };
  }
  return EMPTY_STORE;
}
function isDoubanMetadata(value: unknown): value is DoubanMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return entries.length > 0 && entries.every(([, item]) => Boolean(item && typeof item === 'object' && 'title' in item && ('status' in item || 'doubanUrl' in item)));
}
function isEventDateMigration(value: unknown): value is EventDateMigration {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as EventDateMigration).type === 'event-date-migration' && Array.isArray((value as EventDateMigration).updates));
}
function formatDate(value: string) { return value ? value.replace(/-/g, '.') : '日期待补'; }
function monthKey(event: WatchEvent) { return event.watchedDate.trim() ? event.watchedDate.slice(0, 7) : 'unknown'; }
function monthLabel(key: string) { if (key === 'unknown') return '日期待补'; const [year, month] = key.split('-'); return `${year} 年 ${Number(month)} 月`; }
function sortKey(event: WatchEvent) {
  const watchedDate = event.watchedDate.trim();
  const month = watchedDate ? watchedDate.slice(0, 7) : 'unknown';
  const statusOrder = event.status === 'planned' ? '0' : '1';
  return `${watchedDate ? '0' : '1'}-${month}-${statusOrder}-${watchedDate || 'unknown'}-${event.id}`;
}
function initials(title: string) { return title.trim().slice(0, 1) || '影'; }
function localPosterPath(poster: string) {
  const match = poster.match(/\/(p\d+)\.(?:webp|jpg|jpeg|png)(?:\?.*)?$/i);
  return match ? `/posters/${match[1]}.webp` : '';
}
function posterMirrorUrl(poster: string) {
  const match = poster.match(/\/(p\d+)\.(?:webp|jpg|jpeg|png)(?:\?.*)?$/i);
  return match ? `https://img3.doubanio.com/view/photo/s_ratio_poster/public/${match[1]}.jpg?mirror=1` : '';
}
function splitTags(value: string) { return value.split(/[、,，/|]/).map((item) => item.trim()).filter(Boolean); }
function fieldValue(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) { return event.target.value; }
function monthInputValue(value: string) { return /^\d{4}-\d{2}(?:-\d{2})?$/.test(value) ? value.slice(0, 7) : ''; }
function dateInputValue(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''; }

type DeleteConfirmation = { eventId: string; title: string; deletesFilm: boolean; step: 1 | 2 | 3 };

export default function Home() {
  const [store, setStore] = useState<Store>(EMPTY_STORE);
  const [ready, setReady] = useState(!cloudBaseConfigured);
  const [cloudUser, setCloudUser] = useState<CloudUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authBusy, setAuthBusy] = useState(false);
  const [pendingSignup, setPendingSignup] = useState<{ verifyOtp?: (params: { token: string }) => Promise<unknown> } | null>(null);
  const [authForm, setAuthForm] = useState({ identifier: '', email: '', username: '', password: '', code: '' });
  const [viewMode, setViewMode] = useState<ViewMode>('compact');
  const [pageView, setPageView] = useState<PageView>('records');
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [metadataCandidates, setMetadataCandidates] = useState<MovieCandidate[]>([]);
  const [metadataBusy, setMetadataBusy] = useState(false);
  const [refreshingFilmId, setRefreshingFilmId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0 });
  const [notice, setNotice] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const posterRepairing = useRef(new Set<string>());

  useEffect(() => {
    if (cloudBaseConfigured) {
      let cancelled = false;
      const syncAuthUser = async () => {
        try {
          const user = await getCloudUser();
          if (cancelled) return;
          setCloudUser(user);
          setReady(true);
        } catch {
          if (!cancelled) setNotice('Supabase 登录状态读取失败，请稍后重试。');
        }
      };
      void syncAuthUser();
      const subscription = getCloudAuth()?.onAuthStateChange?.(() => { void syncAuthUser(); });
      return () => { cancelled = true; subscription?.data?.subscription?.unsubscribe(); };
    }
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      // The local archive is the source of truth on first mount; this is intentionally a one-time hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setStore(parseStore(JSON.parse(saved)));
    } catch { setNotice('本地数据读取失败，当前使用空白档案。'); }
    finally { setReady(true); }
    return undefined;
  }, []);
  useEffect(() => { if (!cloudBaseConfigured && ready) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); }, [ready, store]);
  useEffect(() => {
    if (!cloudBaseConfigured || !cloudUser?.id) return undefined;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(false);
    void loadCloudStore(cloudUser.id).then((remote) => {
      if (!active) return;
      setStore(remote as Store);
      setReady(true);
    }).catch(() => { if (active) { setReady(true); setNotice('云端数据读取失败，请检查数据库权限。'); } });
    const stop = watchCloudStore(cloudUser.id, (remote) => { if (active) setStore(remote as Store); }, (error) => { if (active) setNotice(error.message); });
    return () => { active = false; stop(); };
  }, [cloudUser]);
  useEffect(() => {
    if (!cloudBaseConfigured || !cloudUser?.id) return undefined;
    const markerKey = `movie-log-${CONFIRMED_METADATA_VERSION}-${cloudUser.id}`;
    if (window.localStorage.getItem(markerKey) === 'done') return undefined;
    let active = true;
    void updateCloudDoubanMetadata(confirmedDoubanMetadata, cloudUser.id).then(async (result) => {
      if (!active) return;
      window.localStorage.setItem(markerKey, 'done');
      setStore((await loadCloudStore(cloudUser.id)) as Store);
      if (result.updated) setNotice(`已同步 ${result.updated} 部已确认电影资料`);
    }).catch((error) => {
      if (active) setNotice(error instanceof Error ? error.message : '已确认电影资料同步失败');
    });
    return () => { active = false; };
  }, [cloudUser]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3600); return () => window.clearTimeout(timer); }, [notice]);

  const filmsById = useMemo(() => new Map(store.films.map((film) => [film.id, film])), [store.films]);
  const years = useMemo(() => Array.from(new Set(store.events.map((event) => event.watchedDate.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [store.events]);
  const months = useMemo(() => Array.from(new Set(store.events.map((event) => event.watchedDate.slice(0, 7)).filter((value) => value && (yearFilter === 'all' || value.startsWith(yearFilter))))).sort((a, b) => b.localeCompare(a)), [store.events, yearFilter]);
  const watchedCount = store.events.filter((event) => event.status === 'watched').length;
  const plannedCount = store.events.filter((event) => event.status === 'planned').length;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthCount = store.events.filter((event) => event.watchedDate.startsWith(currentMonth)).length;
  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return store.events.filter((event) => {
      const film = filmsById.get(event.filmId); if (!film) return false;
      const cinema = store.cinemas.find((item) => item.id === event.cinemaId);
      const searchable = [film.title, film.director, film.cast, film.genres, event.shortReview, event.scene, event.watchGroup, cinema?.name, event.hall, event.seat].join(' ').toLowerCase();
      return (!normalizedQuery || searchable.includes(normalizedQuery)) && (statusFilter === 'all' || event.status === statusFilter) && (yearFilter === 'all' || event.watchedDate.startsWith(yearFilter)) && (monthFilter === 'all' || event.watchedDate.startsWith(monthFilter));
    }).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }, [filmsById, monthFilter, query, statusFilter, store.cinemas, store.events, yearFilter]);
  const groupedEvents = useMemo(() => {
    const groups = new Map<string, WatchEvent[]>();
    filteredEvents.forEach((event) => groups.set(monthKey(event), [...(groups.get(monthKey(event)) || []), event]));
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredEvents]);

  function updateForm(key: keyof FormState, value: string) {
    if (key === 'title') setMetadataCandidates([]);
    setForm((current) => ({ ...current, [key]: value }));
  }
  function updateAuthForm(key: keyof typeof authForm, value: string) { setAuthForm((current) => ({ ...current, [key]: value })); }
  function openImport() { if (cloudBaseConfigured && !cloudUser) { setAuthOpen(true); return; } fileInput.current?.click(); }
  function openAdd() { if (cloudBaseConfigured && !cloudUser) { setAuthOpen(true); return; } setEditingId(null); setMetadataCandidates([]); setForm(createEmptyForm()); setModalOpen(true); }
  function openEdit(event: WatchEvent) {
    const film = filmsById.get(event.filmId); if (!film) return;
    setEditingId(event.id); setMetadataCandidates([]); setForm({ title: film.title, doubanSubjectId: film.doubanSubjectId, doubanUrl: film.doubanUrl, metadataFetchedAt: film.metadataFetchedAt, metadataExpiresAt: film.metadataExpiresAt, poster: film.poster, releaseDate: film.releaseDate, doubanRating: film.doubanRating, synopsis: film.synopsis, director: film.director, cast: film.cast, genres: film.genres, countries: film.countries, languages: film.languages, runtimeMinutes: film.runtimeMinutes, sourceNote: film.sourceNote, watchedDate: event.watchedDate, watchGroup: event.watchGroup, status: event.status, myRating: event.myRating, shortReview: event.shortReview, scene: event.scene, dateNote: event.dateNote, cinemaName: store.cinemas.find((cinema) => cinema.id === event.cinemaId)?.name || '', hall: event.hall || '', seat: event.seat || '', watchedTime: event.watchedTime || '', ticketStatus: event.ticketStatus || '', ticketSource: event.ticketSource || '' }); setModalOpen(true);
  }
  function applyMovieMetadata(metadata: MovieMetadata) {
    setForm((current) => ({
      ...current,
      doubanSubjectId: metadata.subjectId || current.doubanSubjectId || subjectIdFromUrl(metadata.doubanUrl),
      doubanUrl: metadata.doubanUrl || current.doubanUrl,
      metadataFetchedAt: now(),
      metadataExpiresAt: metadataExpiryAt(),
      poster: metadata.poster || current.poster,
      releaseDate: metadata.releaseDate || current.releaseDate,
      doubanRating: metadata.doubanRating || current.doubanRating,
      synopsis: metadata.synopsis || current.synopsis,
      director: metadata.director || current.director,
      cast: metadata.cast || current.cast,
      genres: metadata.genres || current.genres,
      countries: metadata.countries || current.countries,
      languages: metadata.languages || current.languages,
      runtimeMinutes: metadata.runtimeMinutes || current.runtimeMinutes,
      sourceNote: metadata.sourceNote || current.sourceNote,
    }));
  }
  async function chooseMovieCandidate(candidate: MovieCandidate) {
    if (!cloudUser) { setAuthOpen(true); return; }
    setMetadataBusy(true);
    try {
      const metadata = await loadCloudMovieMetadata(candidate, cloudUser.id);
      applyMovieMetadata(metadata);
      setMetadataCandidates([]);
      setNotice(`已关联豆瓣条目《${candidate.title}${candidate.year ? `（${candidate.year}）` : ''}》，资料由服务器缓存`);
    } catch (error) { setNotice(error instanceof Error ? error.message : '电影资料补全失败'); }
    finally { setMetadataBusy(false); }
  }
  async function autoFillMovie() {
    const title = form.title.trim();
    if (!title) { setNotice('请先输入电影标题'); return; }
    if (!cloudBaseConfigured || !cloudUser) { setAuthOpen(true); return; }
    setMetadataBusy(true); setMetadataCandidates([]);
    try {
      const result = await searchCloudMovie(title, cloudUser.id);
      if (!result.candidates.length) { setNotice('没有找到可靠豆瓣候选。可以先保存观影事件，之后再刷新或确认条目。'); return; }
      if (result.candidates.length === 1) { await chooseMovieCandidate(result.candidates[0]); return; }
      setMetadataCandidates(result.candidates);
      setNotice(`找到 ${result.candidates.length} 个候选，请选择正确版本`);
    } catch (error) { setNotice(error instanceof Error ? error.message : '电影资料查询失败'); }
    finally { setMetadataBusy(false); }
  }
  async function refreshMovieMetadata(film: Film) {
    if (!cloudBaseConfigured || !cloudUser) { setAuthOpen(true); return; }
    if (refreshingFilmId) return;
    setRefreshingFilmId(film.id);
    try {
      let candidate: MovieCandidate | null = null;
      const subjectId = film.doubanSubjectId || subjectIdFromUrl(film.doubanUrl);
      if (subjectId) {
        candidate = { subjectId, title: film.title, year: film.releaseDate.slice(0, 4), poster: film.poster, doubanUrl: film.doubanUrl };
      } else {
        const result = await searchCloudMovie(film.title, cloudUser.id);
        if (result.candidates.length !== 1) {
          setNotice(result.candidates.length ? `《${film.title}》有多个豆瓣候选，请编辑记录后选择版本` : `没有找到《${film.title}》的可靠豆瓣条目`);
          return;
        }
        candidate = result.candidates[0];
      }
      const metadata = await loadCloudMovieMetadata(candidate, cloudUser.id);
      await updateCloudFilm(film.id, {
        doubanSubjectId: metadata.subjectId || candidate.subjectId,
        doubanUrl: metadata.doubanUrl || candidate.doubanUrl,
        poster: metadata.poster || film.poster,
        releaseDate: metadata.releaseDate || film.releaseDate,
        doubanRating: metadata.doubanRating || film.doubanRating,
        synopsis: metadata.synopsis || film.synopsis,
        director: metadata.director || film.director,
        cast: metadata.cast || film.cast,
        genres: metadata.genres || film.genres,
        countries: metadata.countries || film.countries,
        languages: metadata.languages || film.languages,
        runtimeMinutes: metadata.runtimeMinutes || film.runtimeMinutes,
        sourceNote: metadata.sourceNote || film.sourceNote,
        metadataFetchedAt: now(),
        metadataExpiresAt: metadataExpiryAt(),
        updatedAt: now(),
      }, cloudUser.id);
      setStore((await loadCloudStore(cloudUser.id)) as Store);
      setNotice(`已刷新《${film.title}》的豆瓣资料`);
    } catch (error) { setNotice(error instanceof Error ? error.message : '豆瓣资料刷新失败'); }
    finally { setRefreshingFilmId(null); }
  }
  async function repairPoster(film: Film) {
    if (!cloudUser || !film.poster || posterRepairing.current.has(film.id)) return;
    posterRepairing.current.add(film.id);
    try {
      const posterDataUrl = await loadCloudPoster(film.poster, cloudUser.id);
      if (!posterDataUrl) return;
      await updateCloudFilm(film.id, { poster: posterDataUrl, updatedAt: now() }, cloudUser.id);
      setStore((await loadCloudStore(cloudUser.id)) as Store);
    } catch {
      // A failed repair remains a normal placeholder; do not interrupt browsing with an error toast.
    } finally { posterRepairing.current.delete(film.id); }
  }
  async function batchEnrichMissing() {
    if (!cloudBaseConfigured || !cloudUser) { setAuthOpen(true); return; }
    if (batchBusy) return;
    const targets = store.films.filter(isMetadataStale);
    if (!targets.length) { setNotice('豆瓣资料都在缓存有效期内，不需要重新抓取。'); return; }
    setBatchBusy(true); setBatchProgress({ done: 0, total: targets.length });
    let updated = 0; let ambiguous = 0; let failed = 0;
    for (let index = 0; index < targets.length; index += 1) {
      const film = targets[index];
      try {
        const result = await searchCloudMovie(film.title, cloudUser.id);
        if (result.candidates.length !== 1) { ambiguous += 1; }
        else {
          const metadata = await loadCloudMovieMetadata(result.candidates[0], cloudUser.id);
          const patch: Record<string, unknown> = {
            doubanSubjectId: metadata.subjectId || result.candidates[0].subjectId,
            doubanUrl: metadata.doubanUrl || result.candidates[0].doubanUrl,
            poster: metadata.poster || film.poster,
            releaseDate: metadata.releaseDate || film.releaseDate,
            doubanRating: metadata.doubanRating || film.doubanRating,
            synopsis: metadata.synopsis || film.synopsis,
            director: metadata.director || film.director,
            cast: metadata.cast || film.cast,
            genres: metadata.genres || film.genres,
            countries: metadata.countries || film.countries,
            languages: metadata.languages || film.languages,
            runtimeMinutes: metadata.runtimeMinutes || film.runtimeMinutes,
            sourceNote: metadata.sourceNote || film.sourceNote,
            metadataFetchedAt: now(),
            metadataExpiresAt: metadataExpiryAt(),
            updatedAt: now(),
          };
          await updateCloudFilm(film.id, patch, cloudUser.id);
          updated += 1;
        }
      } catch { failed += 1; }
      setBatchProgress({ done: index + 1, total: targets.length });
      if (index < targets.length - 1) await new Promise((resolve) => window.setTimeout(resolve, 650));
    }
    try { setStore((await loadCloudStore(cloudUser.id)) as Store); } catch { /* the realtime listener will refresh shortly */ }
    setBatchBusy(false);
    setNotice(`豆瓣缓存刷新完成：更新 ${updated} 部，待人工确认 ${ambiguous} 部，失败 ${failed} 部。`);
  }
  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault(); const title = form.title.trim(); if (!title) return; const timestamp = now();
    const editingEvent = editingId ? store.events.find((event) => event.id === editingId) : undefined;
    const existingLinkedFilm = !editingId && form.doubanSubjectId ? store.films.find((film) => film.doubanSubjectId === form.doubanSubjectId) : undefined;
    const filmId = editingEvent?.filmId || existingLinkedFilm?.id || id('film');
    const eventId = editingId || id('event');
    const filmPayload: Film = { id: filmId, title, doubanSubjectId: form.doubanSubjectId.trim(), doubanUrl: form.doubanUrl.trim(), metadataFetchedAt: form.metadataFetchedAt.trim(), metadataExpiresAt: form.metadataExpiresAt.trim(), poster: form.poster.trim(), releaseDate: form.releaseDate.trim(), doubanRating: form.doubanRating.trim(), synopsis: form.synopsis.trim(), director: form.director.trim(), cast: form.cast.trim(), genres: form.genres.trim(), countries: form.countries.trim(), languages: form.languages.trim(), runtimeMinutes: form.runtimeMinutes.trim(), sourceNote: form.sourceNote.trim(), createdAt: existingLinkedFilm?.createdAt || timestamp, updatedAt: timestamp };
    const cinemaName = form.cinemaName.trim();
    const existingCinema = cinemaName ? store.cinemas.find((cinema) => cinema.name.trim() === cinemaName) : undefined;
    let cinema: Cinema | null = existingCinema || null;
    if (cinemaName && cloudBaseConfigured && cloudUser) {
      try { cinema = await findOrCreateCloudCinema(cinemaName, cloudUser.id) as Cinema | null; } catch (error) { setNotice(error instanceof Error ? error.message : '电影院保存失败'); return; }
    }
    if (cinemaName && !cinema) {
      cinema = { id: id('cinema'), name: cinemaName, address: '', sourceNote: '由观影记录创建', createdAt: timestamp, updatedAt: timestamp };
    }
    const eventPayload: WatchEvent = { id: eventId, filmId, watchedDate: form.watchedDate.trim(), watchGroup: form.watchGroup.trim(), status: form.status, myRating: form.myRating.trim(), shortReview: form.shortReview.trim(), scene: form.scene.trim(), dateNote: form.dateNote.trim(), cinemaId: cinema?.id || '', hall: form.hall.trim(), seat: form.seat.trim(), watchedTime: form.watchedTime.trim(), ticketStatus: form.ticketStatus.trim(), ticketSource: form.ticketSource.trim(), createdAt: editingEvent?.createdAt || timestamp, updatedAt: timestamp };
    if (cloudBaseConfigured && cloudUser) {
      try {
        if (editingId) {
          const { id: _filmId, ...filmPatch } = filmPayload;
          const { id: _eventId, ...eventPatch } = eventPayload;
          void _filmId;
          void _eventId;
          await Promise.all([updateCloudFilm(filmId, filmPatch, cloudUser.id), updateCloudEvent(eventId, eventPatch, cloudUser.id)]);
        } else if (existingLinkedFilm) {
          await addCloudEvent(eventPayload, cloudUser.id);
        } else {
          await addCloudRecords(filmPayload, eventPayload, cloudUser.id);
        }
        setStore((await loadCloudStore(cloudUser.id)) as Store);
        setNotice(editingId ? '观影记录已更新并同步' : '观影记录已添加并同步');
      } catch (error) { setNotice(error instanceof Error ? error.message : '云端保存失败'); return; }
      setModalOpen(false);
      return;
    }
    if (editingId) {
      if (!editingEvent) return;
      setStore({ films: store.films.map((film) => film.id === editingEvent.filmId ? { ...film, title, doubanSubjectId: form.doubanSubjectId.trim(), doubanUrl: form.doubanUrl.trim(), metadataFetchedAt: form.metadataFetchedAt.trim(), metadataExpiresAt: form.metadataExpiresAt.trim(), poster: form.poster.trim(), releaseDate: form.releaseDate.trim(), doubanRating: form.doubanRating.trim(), synopsis: form.synopsis.trim(), director: form.director.trim(), cast: form.cast.trim(), genres: form.genres.trim(), countries: form.countries.trim(), languages: form.languages.trim(), runtimeMinutes: form.runtimeMinutes.trim(), sourceNote: form.sourceNote.trim(), updatedAt: timestamp } : film), events: store.events.map((event) => event.id === editingId ? eventPayload : event), cinemas: cinema && !existingCinema ? [...store.cinemas, cinema] : store.cinemas.map((item) => item.id === cinema?.id ? { ...item, updatedAt: timestamp } : item) });
      setNotice('观影记录已更新');
    } else {
      setStore({ films: existingLinkedFilm ? store.films : [...store.films, filmPayload], events: [...store.events, eventPayload], cinemas: cinema && !existingCinema ? [...store.cinemas, cinema] : store.cinemas });
      setNotice('观影记录已添加');
    }
    setModalOpen(false);
  }
  async function toggleStatus(eventId: string) {
    const current = store.events.find((event) => event.id === eventId); if (!current) return;
    const timestamp = now(); const nextStatus: Status = current.status === 'watched' ? 'planned' : 'watched';
    if (cloudBaseConfigured && cloudUser) {
      try { await updateCloudEvent(eventId, { status: nextStatus, updatedAt: timestamp }, cloudUser.id); setStore((await loadCloudStore(cloudUser.id)) as Store); setNotice('状态已切换并同步'); } catch (error) { setNotice(error instanceof Error ? error.message : '云端更新失败'); }
      return;
    }
    setStore((currentStore) => ({ ...currentStore, events: currentStore.events.map((event) => event.id === eventId ? { ...event, status: nextStatus, updatedAt: timestamp } : event) })); setNotice('状态已切换');
  }
  async function duplicateEvent(eventId: string) {
    const source = store.events.find((event) => event.id === eventId); if (!source) return; const timestamp = now();
    const copy = { ...source, id: id('event'), watchedDate: '', watchGroup: '', status: 'watched' as Status, shortReview: '', scene: '', dateNote: '由已有记录复制，可继续补充本次观影信息', cinemaId: '', hall: '', seat: '', watchedTime: '', ticketStatus: '', ticketSource: '', createdAt: timestamp, updatedAt: timestamp };
    if (cloudBaseConfigured && cloudUser) {
      try { await addCloudEvent(copy, cloudUser.id); setStore((await loadCloudStore(cloudUser.id)) as Store); setNotice('已复制并同步为新的观影事件'); } catch (error) { setNotice(error instanceof Error ? error.message : '云端复制失败'); }
      return;
    }
    setStore((current) => ({ ...current, events: [...current.events, copy] })); setNotice('已复制为一条新的观影事件');
  }
  function requestDelete(eventId: string) {
    const target = store.events.find((event) => event.id === eventId); if (!target) return;
    const film = filmsById.get(target.filmId);
    const hasOtherEvents = store.events.some((event) => event.id !== eventId && event.filmId === target.filmId);
    setDeleteConfirmation({ eventId, title: film?.title || '这条观影记录', deletesFilm: !hasOtherEvents, step: 1 });
  }
  async function executeDelete(eventId: string) {
    const target = store.events.find((event) => event.id === eventId); if (!target) return;
    const remaining = store.events.filter((event) => event.id !== eventId); const hasOtherEvents = remaining.some((event) => event.filmId === target.filmId);
    if (cloudBaseConfigured && cloudUser) {
      try { await deleteCloudEvent(eventId, cloudUser.id); if (!hasOtherEvents) await deleteCloudFilm(target.filmId, cloudUser.id); setStore((await loadCloudStore(cloudUser.id)) as Store); setNotice('观影记录已删除并同步'); } catch (error) { setNotice(error instanceof Error ? error.message : '云端删除失败'); }
      return;
    }
    setStore({ films: hasOtherEvents ? store.films : store.films.filter((film) => film.id !== target.filmId), events: remaining, cinemas: store.cinemas }); setNotice('观影记录已删除');
  }
  function advanceDeleteConfirmation() {
    if (!deleteConfirmation) return;
    if (deleteConfirmation.step < 3) { setDeleteConfirmation({ ...deleteConfirmation, step: (deleteConfirmation.step + 1) as 2 | 3 }); return; }
    const eventId = deleteConfirmation.eventId;
    setDeleteConfirmation(null);
    void executeDelete(eventId);
  }
  function exportData() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `movie-log-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); setNotice('数据已导出');
  }
  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (isEventDateMigration(parsed)) {
          if (!cloudBaseConfigured || !cloudUser) throw new Error('请先登录 Supabase，再导入日期迁移文件');
          const result = await updateCloudEventDates(parsed, cloudUser.id);
          setStore((await loadCloudStore(cloudUser.id)) as Store);
          setNotice(`已更新 ${result.updated} 组观影日期并同步`);
        } else if (isDoubanMetadata(parsed)) {
          if (!cloudBaseConfigured || !cloudUser) throw new Error('请先登录 Supabase，再导入豆瓣资料');
          const result = await updateCloudDoubanMetadata(parsed, cloudUser.id);
          setStore((await loadCloudStore(cloudUser.id)) as Store);
          setNotice(`已更新 ${result.updated} 部电影资料，${result.pending} 部待确认`);
        } else {
          const imported = parseStore(parsed);
          if (cloudBaseConfigured && cloudUser) { await addCloudStore(imported, cloudUser.id); setStore((await loadCloudStore(cloudUser.id)) as Store); } else setStore(imported);
          setNotice(`已导入并同步 ${imported.events.length} 条观影记录`);
        }
      } catch (error) { setNotice(error instanceof Error ? error.message : '导入失败，请选择有效的 JSON 文件'); }
      if (fileInput.current) fileInput.current.value = '';
    };
    reader.readAsText(file);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthBusy(true);
    try {
      if (authMode === 'signin') {
        const user = await signInWithPassword(authForm.identifier.trim(), authForm.password);
        setCloudUser(user || await getCloudUser()); setAuthOpen(false); setNotice('已登录 Supabase，正在同步数据');
      } else if (!pendingSignup) {
        const verification = await startEmailSignup(authForm.email.trim(), authForm.password, authForm.username.trim());
        setPendingSignup(verification as { verifyOtp?: (params: { token: string }) => Promise<unknown> }); setNotice('验证码已发送到邮箱，请输入验证码完成注册');
      } else {
        const user = await finishEmailSignup(pendingSignup, authForm.code.trim());
        setCloudUser(user || await getCloudUser()); setPendingSignup(null); setAuthOpen(false); setNotice('账号已创建，正在同步数据');
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : '登录失败'); }
    finally { setAuthBusy(false); }
  }
  async function logoutCloud() { try { await signOutCloud(); setCloudUser(null); setStore(EMPTY_STORE); setReady(true); setNotice('已退出 Supabase'); } catch { setNotice('退出登录失败'); } }
  const cloudLocked = cloudBaseConfigured && !cloudUser;

  return <main className="app-shell">
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark" aria-hidden="true"><span /></div><div><p className="brand-kicker">PERSONAL SCREENING ROOM</p><p className="brand-name">观影记录</p></div></div><div className="topbar-right"><span className={`local-pill ${cloudUser ? 'cloud-pill' : ''}`}><span className="live-dot" />{!cloudBaseConfigured ? '本地模式' : cloudUser ? '云端已同步' : 'Supabase 待登录'}</span>{cloudBaseConfigured && <button className="sync-action" type="button" onClick={cloudUser ? logoutCloud : () => setAuthOpen(true)}>{cloudUser ? '退出' : '登录'}</button>}<button className="icon-button top-icon" type="button" onClick={exportData} aria-label="导出数据">↗</button></div></header>
    <div className="page-grid">
      <aside className="sidebar">
        <div className="sidebar-section"><p className="side-label">我的档案</p><button className={`nav-button ${pageView === 'records' && statusFilter === 'all' ? 'active' : ''}`} type="button" onClick={() => { setPageView('records'); setStatusFilter('all'); }}><span className="nav-icon">⌂</span><span>全部记录</span><b>{store.events.length}</b></button><button className={`nav-button ${pageView === 'records' && statusFilter === 'watched' ? 'active' : ''}`} type="button" onClick={() => { setPageView('records'); setStatusFilter('watched'); }}><span className="nav-icon">✓</span><span>已观影</span><b>{watchedCount}</b></button><button className={`nav-button ${pageView === 'records' && statusFilter === 'planned' ? 'active' : ''}`} type="button" onClick={() => { setPageView('records'); setStatusFilter('planned'); }}><span className="nav-icon">◷</span><span>观影计划</span><b>{plannedCount}</b></button></div>
        <div className="sidebar-section report-nav-section"><p className="side-label">洞察</p><button className={`nav-button ${pageView === 'calendar' ? 'active' : ''}`} type="button" onClick={() => setPageView('calendar')}><span className="nav-icon">▦</span><span>观影日历</span><b>热力</b></button><button className={`nav-button ${pageView === 'festival' ? 'active' : ''}`} type="button" onClick={() => setPageView('festival')}><span className="nav-icon">✧</span><span>影展模式</span><b>独立</b></button><button className={`nav-button ${pageView === 'report' ? 'active' : ''}`} type="button" onClick={() => setPageView('report')}><span className="nav-icon">✦</span><span>观影报告</span><b>分析</b></button></div>
        <div className="sidebar-section filter-section"><p className="side-label">时间筛选</p><label className="select-label">年份<select value={yearFilter} onChange={(event) => { setYearFilter(event.target.value); setMonthFilter('all'); }}><option value="all">全部年份</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label><label className="select-label">月份<select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)}><option value="all">全部月份</option>{months.map((month) => <option key={month} value={month}>{month.replace('-', ' / ')}</option>)}</select></label></div>
        <div className="sidebar-note"><span className="note-icon">✦</span><p>这里记录的是你的观看时刻，不是电影的上映时间。</p></div><p className="sidebar-footer">{cloudBaseConfigured ? 'SUPABASE ARCHIVE · V3.0' : 'LOCAL ARCHIVE · V1.0'}</p>
      </aside>
      <section className="content-column">
        {pageView === 'report' ? <WatchReport store={store} cloudLocked={cloudLocked} onBatchEnrich={() => { void batchEnrichMissing(); }} batchBusy={batchBusy} batchProgress={batchProgress} /> : pageView === 'calendar' ? <CalendarView store={store} /> : pageView === 'festival' ? <FestivalView store={store} filmsById={filmsById} /> : <>
        <div className="content-heading"><div><p className="eyebrow">MY MOVIE JOURNAL <span>／</span> 2026</p><h1>看过的，<em>计划看的。</em></h1><p className="intro">把每一次走进影院、打开屏幕的时刻，留在自己的时间线上。</p></div><button className="primary-button add-button" type="button" onClick={openAdd}><span>＋</span> 添加记录</button></div>
        <div className="stats-row" aria-label="档案统计"><div className="stat-card accent"><span className="stat-label">观影事件</span><strong>{store.events.length}</strong><span className="stat-foot">每次观看都是一条记录</span></div><div className="stat-card"><span className="stat-label">已观影</span><strong>{watchedCount}</strong><span className="stat-foot">已经发生的时刻</span></div><div className="stat-card"><span className="stat-label">观影计划</span><strong>{plannedCount}</strong><span className="stat-foot">接下来想看的</span></div><div className="stat-card"><span className="stat-label">本月记录</span><strong>{currentMonthCount}</strong><span className="stat-foot">{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}</span></div></div>
        <div className="toolbar"><label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索片名、导演、短评…" aria-label="搜索电影" />{query && <button type="button" onClick={() => setQuery('')} aria-label="清除搜索">×</button>}</label><div className="toolbar-actions"><div className="view-toggle" role="group" aria-label="视图模式"><button className={viewMode === 'compact' ? 'selected' : ''} type="button" onClick={() => setViewMode('compact')}><span>▦</span> 简略</button><button className={viewMode === 'expanded' ? 'selected' : ''} type="button" onClick={() => setViewMode('expanded')}><span>☷</span> 展开</button></div><input ref={fileInput} className="hidden-input" type="file" accept="application/json,.json" onChange={importData} /><button className="text-button" type="button" onClick={openImport}>导入</button><button className="text-button" type="button" onClick={exportData}>导出</button></div></div>
        <div className="result-line"><span>{filteredEvents.length} 条记录</span>{query || statusFilter !== 'all' || yearFilter !== 'all' || monthFilter !== 'all' ? <button type="button" onClick={() => { setQuery(''); setStatusFilter('all'); setYearFilter('all'); setMonthFilter('all'); }}>清除筛选 ×</button> : <span className="result-hint">双击记录不会触发任何操作，放心浏览</span>}</div>
        {!ready ? <div className="loading-panel">{cloudBaseConfigured ? '正在连接 Supabase 云端档案…' : '正在打开你的本地档案…'}</div> : filteredEvents.length === 0 ? <div className="empty-state"><div className="empty-orbit" aria-hidden="true"><span>✦</span></div><p className="empty-kicker">{cloudLocked ? 'CLOUD ARCHIVE' : 'YOUR ARCHIVE IS READY'}</p><h2>{cloudLocked ? '先登录你的云端档案' : store.events.length === 0 ? '先把第一部电影放进来' : '没有匹配的记录'}</h2><p>{cloudLocked ? '登录后，手机和电脑会共用同一份数据库，并在打开页面时自动同步。' : store.events.length === 0 ? '添加一条观影记录，或导入你整理好的 JSON。数据会自动保存在当前浏览器。' : '试试换一个搜索词，或清除左侧的筛选条件。'}</p><div className="empty-actions">{cloudLocked ? <button className="primary-button" type="button" onClick={() => setAuthOpen(true)}>登录 Supabase <span>→</span></button> : store.events.length === 0 && <button className="primary-button" type="button" onClick={openAdd}>添加首条记录 <span>→</span></button>}{!cloudLocked && <button className="secondary-button" type="button" onClick={openImport}>导入 JSON</button>}</div>{(cloudLocked || store.events.length === 0) && <div className="empty-detail"><span>◎</span> {cloudLocked ? '同一个 Supabase 账号即可在手机和电脑查看同一份数据。' : '当前未配置云端，数据只保存在浏览器；部署后会切换为云端同步。'}</div>}</div> : <div className="timeline">{groupedEvents.map(([group, events]) => <section className="month-group" key={group}><div className="month-heading"><div><span className="month-marker" /><h2>{monthLabel(group)}</h2>{group === 'unknown' && <span className="pending-label">待补日期</span>}</div><span>{events.length} {events.length === 1 ? 'record' : 'records'}</span></div><div className={`record-list ${viewMode}`}>{events.map((event) => { const film = filmsById.get(event.filmId); if (!film) return null; return <RecordCard key={event.id} event={event} film={film} cinema={store.cinemas.find((item) => item.id === event.cinemaId)} viewMode={viewMode} onEdit={() => openEdit(event)} onDelete={() => requestDelete(event.id)} onToggle={() => toggleStatus(event.id)} onDuplicate={() => duplicateEvent(event.id)} onPosterRepair={() => { void repairPoster(film); }} onRefresh={() => { void refreshMovieMetadata(film); }} refreshing={refreshingFilmId === film.id} />; })}</div></section>)}</div>}
        <footer className="content-footer"><span>电影资料与观影事件分离保存 · 重复观看各自留档</span><span>{cloudBaseConfigured && cloudUser ? 'Supabase 云端同步中 · 切回页面立即检查' : cloudBaseConfigured ? '登录后启用云端同步' : '数据只在本设备浏览器中保存'}</span></footer>
        </>}
      </section>
    </div>
    {notice && <div className="toast" role="status">{notice}</div>}{modalOpen && <RecordModalWithLookup editing={Boolean(editingId)} form={form} cinemas={store.cinemas} onChange={updateForm} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} metadataBusy={metadataBusy} candidates={metadataCandidates} onAutoFill={autoFillMovie} onSelectCandidate={chooseMovieCandidate} />}{deleteConfirmation && <DeleteConfirmModal confirmation={deleteConfirmation} onCancel={() => setDeleteConfirmation(null)} onAdvance={advanceDeleteConfirmation} />}{authOpen && <CloudAuthModal mode={authMode} pendingSignup={Boolean(pendingSignup)} busy={authBusy} form={authForm} onModeChange={(mode) => { setAuthMode(mode); setPendingSignup(null); setAuthForm({ identifier: '', email: '', username: '', password: '', code: '' }); }} onChange={updateAuthForm} onClose={() => setAuthOpen(false)} onSubmit={handleAuthSubmit} />}
  </main>;
}

type CalendarMode = 'heatmap' | 'week' | 'month';

function isoDateLabel(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function weekStartFor(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return isoDateLabel(date);
}

function CalendarView({ store }: { store: Store }) {
  const [mode, setMode] = useState<CalendarMode>('heatmap');
  const availableYears = useMemo(() => Array.from(new Set(store.events.map((event) => event.watchedDate.slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [store.events]);
  const [requestedYear, setRequestedYear] = useState(String(new Date().getFullYear()));
  const year = availableYears.includes(requestedYear) ? requestedYear : availableYears[0] || requestedYear;
  const watched = useMemo(() => store.events.filter((event) => event.status === 'watched' && event.watchedDate.startsWith(`${year}-`)), [store.events, year]);
  const exactDateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    watched.filter((event) => /^\d{4}-\d{2}-\d{2}$/.test(event.watchedDate)).forEach((event) => counts.set(event.watchedDate, (counts.get(event.watchedDate) || 0) + 1));
    return counts;
  }, [watched]);
  const monthCounts = useMemo(() => Array.from({ length: 12 }, (_, month) => watched.filter((event) => event.watchedDate.slice(5, 7) === String(month + 1).padStart(2, '0')).length), [watched]);
  const monthOnlyCount = watched.filter((event) => /^\d{4}-\d{2}$/.test(event.watchedDate)).length;
  const weeklyRows = useMemo(() => {
    const counts = new Map<string, number>();
    exactDateCounts.forEach((count, date) => counts.set(weekStartFor(date), (counts.get(weekStartFor(date)) || 0) + count));
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [exactDateCounts]);
  const maxMonth = Math.max(1, ...monthCounts);
  const maxWeek = Math.max(1, ...weeklyRows.map(([, count]) => count));
  const total = watched.length;
  return <div className="insight-page calendar-page">
    <div className="insight-page-header"><div><p className="eyebrow">CALENDAR / HEATMAP <span>／</span> LIVE ARCHIVE</p><h1>把观影，<em>铺成时间。</em></h1><p className="intro">只统计已观影事件；只记到月份的记录会进入月度统计，不会被假装成某一天。</p></div><div className="calendar-year-control"><label>查看年份<select value={year} onChange={(event) => setRequestedYear(event.target.value)}>{availableYears.length ? availableYears.map((item) => <option key={item} value={item}>{item} 年</option>) : <option value={year}>{year} 年</option>}</select></label><strong>{total}</strong><small>次已观影</small></div></div>
    <div className="calendar-summary"><span><b>{exactDateCounts.size}</b> 个具体观影日</span><span><b>{monthOnlyCount}</b> 条仅记录月份</span><span><b>{monthCounts.filter(Boolean).length}</b> 个活跃月份</span><span><b>{weeklyRows.length}</b> 个观影周</span></div>
    <div className="view-toggle calendar-tabs" role="tablist" aria-label="日历视图"><button className={mode === 'heatmap' ? 'selected' : ''} type="button" onClick={() => setMode('heatmap')}>▦ 日历热力图</button><button className={mode === 'week' ? 'selected' : ''} type="button" onClick={() => setMode('week')}>↗ 按周</button><button className={mode === 'month' ? 'selected' : ''} type="button" onClick={() => setMode('month')}>▤ 按月</button></div>
    {mode === 'heatmap' && <section className="calendar-panel"><div className="calendar-panel-heading"><div><p className="panel-kicker">GITHUB-LIKE PULSE</p><h2>{year} 年观影热力</h2></div><span>颜色越深，当天记录越多</span></div><div className="heatmap-grid">{Array.from({ length: 12 }, (_, monthIndex) => { const firstDay = new Date(Number(year), monthIndex, 1).getDay(); const offset = (firstDay + 6) % 7; const days = new Date(Number(year), monthIndex + 1, 0).getDate(); return <div className="heatmap-month" key={`${year}-${monthIndex}`}><h3>{monthIndex + 1} 月 <small>{monthCounts[monthIndex]} 次</small></h3><div className="weekday-mini"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div className="heatmap-cells">{Array.from({ length: offset }, (_, index) => <i className="heat-cell blank" key={`blank-${index}`} />)}{Array.from({ length: days }, (_, index) => { const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`; const count = exactDateCounts.get(date) || 0; return <i className={`heat-cell level-${Math.min(4, count)}`} key={date} title={`${date.replaceAll('-', '.')} · ${count ? `${count} 条观影记录` : '无记录'}`} aria-label={`${date} ${count} 条观影记录`} />; })}</div></div>; })}</div><div className="heatmap-legend"><span>少</span><i className="heat-cell level-0" /><i className="heat-cell level-1" /><i className="heat-cell level-2" /><i className="heat-cell level-3" /><i className="heat-cell level-4" /><span>多</span></div></section>}
    {mode === 'week' && <section className="calendar-panel"><div className="calendar-panel-heading"><div><p className="panel-kicker">WEEKLY RHYTHM</p><h2>按周看你的节奏</h2></div><span>只使用精确到日的记录</span></div>{weeklyRows.length ? <div className="weekly-list">{weeklyRows.map(([week, count]) => <div className="weekly-row" key={week}><div><strong>{week.slice(0, 7).replace('-', '.')}</strong><span>周一开始 · {count} 次</span></div><div className="progress-track"><i style={{ width: `${(count / maxWeek) * 100}%` }} /></div><em>{count}</em></div>)}</div> : <div className="report-muted">补充具体观影日期后，这里会显示每周节奏。</div>}<p className="calendar-note">月份记录仍保留在主线和按月统计里，不会被分配到某个星期。</p></section>}
    {mode === 'month' && <section className="calendar-panel"><div className="calendar-panel-heading"><div><p className="panel-kicker">MONTHLY RHYTHM</p><h2>按月看观影密度</h2></div><span>{year} 年</span></div><div className="month-summary-grid">{monthCounts.map((count, index) => <div className="month-summary-card" key={index}><div><strong>{String(index + 1).padStart(2, '0')}</strong><span>月</span></div><b>{count}</b><div className="month-summary-track"><i style={{ width: `${(count / maxMonth) * 100}%` }} /></div><small>{count ? `${count} 次已观影` : '没有记录'}</small></div>)}</div></section>}
  </div>;
}

function FestivalView({ store, filmsById }: { store: Store; filmsById: Map<string, Film> }) {
  const groups = useMemo(() => { const map = new Map<string, WatchEvent[]>(); store.events.filter((event) => event.watchGroup.trim()).forEach((event) => map.set(event.watchGroup.trim(), [...(map.get(event.watchGroup.trim()) || []), event])); return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)); }, [store.events]);
  const [requestedGroup, setRequestedGroup] = useState('');
  const groupName = groups.some(([name]) => name === requestedGroup) ? requestedGroup : groups[0]?.[0] || '';
  const groupEvents = groups.find(([name]) => name === groupName)?.[1] || [];
  const festivalFilms = Array.from(new Map(groupEvents.map((event) => [event.filmId, filmsById.get(event.filmId)])).values()).filter((film): film is Film => Boolean(film));
  const watchedCount = groupEvents.filter((event) => event.status === 'watched').length;
  const normalRelations = festivalFilms.map((film) => ({ film, festival: groupEvents.filter((event) => event.filmId === film.id), normal: store.events.filter((event) => event.filmId === film.id && !event.watchGroup.trim()) })).filter((item) => item.normal.length);
  if (!groups.length) return <div className="insight-page"><div className="empty-state report-empty"><div className="empty-orbit" aria-hidden="true"><span>✧</span></div><p className="empty-kicker">FESTIVAL MODE</p><h2>还没有影展分组</h2><p>编辑一次观影，在“观影分组”里填入北影节、FIRST 或其他影展。影展模式会单独读取它，不会改变主线。</p></div></div>;
  const progress = groupEvents.length ? Math.round((watchedCount / groupEvents.length) * 100) : 0;
  return <div className="insight-page festival-page"><div className="insight-page-header"><div><p className="eyebrow">FESTIVAL MODE <span>／</span> SIDE ARCHIVE</p><h1>你的影展，<em>另有一条线。</em></h1><p className="intro">影展数据是独立视图：主线仍按观影月份排列，同一部电影可以同时出现在普通月份和影展关系里。</p></div><div className="festival-mark"><span>✧</span><strong>{festivalFilms.length}</strong><small>部影展电影</small></div></div><div className="festival-switcher">{groups.map(([name, events]) => <button className={name === groupName ? 'selected' : ''} type="button" key={name} onClick={() => setRequestedGroup(name)}><span>✧</span>{name}<b>{events.length}</b></button>)}</div><section className="festival-overview"><div className="festival-progress"><div className="festival-progress-top"><span>片单完成度</span><strong>{progress}%</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div><small>{watchedCount} 次已观影 / {groupEvents.length} 条影展记录</small></div><div><span className="festival-stat-label">观影数量</span><strong className="festival-stat-value">{watchedCount}</strong><small>含重复观影事件</small></div><div><span className="festival-stat-label">片单电影</span><strong className="festival-stat-value">{festivalFilms.length}</strong><small>按电影资料去重展示</small></div><div><span className="festival-stat-label">日期范围</span><strong className="festival-stat-value festival-date-value">{groupEvents.map((event) => event.watchedDate).filter(Boolean).sort()[0]?.slice(0, 7).replace('-', '.') || '待补'}</strong><small>{groupEvents.map((event) => event.watchedDate).filter(Boolean).sort().at(-1)?.slice(0, 7).replace('-', '.') || '没有日期'}</small></div></section><section className="calendar-panel festival-panel"><div className="calendar-panel-heading"><div><p className="panel-kicker">POSTER WALL</p><h2>{groupName}片单墙</h2></div><span>独立于主线展示</span></div><div className="festival-poster-wall">{festivalFilms.map((film) => <div className="festival-poster-card" key={film.id}><div className="festival-poster"><PosterVisual film={film} /></div><strong title={film.title}>{film.title}</strong><small>{groupEvents.some((event) => event.filmId === film.id && event.status === 'watched') ? '已观影' : '计划中'} · {groupEvents.filter((event) => event.filmId === film.id).length} 次</small></div>)}</div></section><section className="calendar-panel relationship-panel"><div className="calendar-panel-heading"><div><p className="panel-kicker">DOUBLE EXPOSURE</p><h2>普通月份 × 影展再次观看</h2></div><span>{normalRelations.length} 部有交集</span></div>{normalRelations.length ? <div className="festival-relations">{normalRelations.map(({ film, festival, normal }) => <div className="festival-relation" key={film.id}><div className="relation-poster"><PosterVisual film={film} /></div><div><strong>{film.title}</strong><p><span>普通主线</span>{normal.map((event) => formatDate(event.watchedDate)).join('、') || '日期待补'}</p><p><span>{groupName}</span>{festival.map((event) => formatDate(event.watchedDate)).join('、') || '日期待补'}</p></div></div>)}</div> : <div className="report-muted">当前影展电影没有同时出现在普通观影记录中；以后重复观看时，这里会自动建立关系。</div>}</section></div>;
}

function escapeSvgText(value: string) { return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[character] || character)); }

function downloadYearCard(store: Store, year: string) {
  const filmMap = new Map(store.films.map((film) => [film.id, film]));
  const watched = store.events.filter((event) => event.status === 'watched' && event.watchedDate.startsWith(`${year}-`));
  const titleCounts = new Map<string, number>(); const monthCounts = new Map<string, number>(); const genres = new Map<string, number>();
  watched.forEach((event) => { const film = filmMap.get(event.filmId); const title = film?.title || '未命名电影'; titleCounts.set(title, (titleCounts.get(title) || 0) + 1); const month = event.watchedDate.slice(5, 7); if (/^\d{2}$/.test(month)) monthCounts.set(month, (monthCounts.get(month) || 0) + 1); splitTags(film?.genres || '').forEach((genre) => genres.set(genre, (genres.get(genre) || 0) + 1)); });
  const topTitles = Array.from(titleCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6); const topGenres = Array.from(genres.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3); const maxMonth = Math.max(1, ...monthCounts.values());
  const monthBars = Array.from({ length: 12 }, (_, index) => { const month = String(index + 1).padStart(2, '0'); const count = monthCounts.get(month) || 0; const height = Math.round((count / maxMonth) * 150); const x = 100 + index * 82; return `<rect x="${x}" y="${510 - height}" width="34" height="${Math.max(4, height)}" rx="8" fill="#a7c48f"/><text x="${x + 17}" y="535" text-anchor="middle" class="small">${index + 1}</text><text x="${x + 17}" y="${495 - height}" text-anchor="middle" class="count">${count || ''}</text>`; }).join('');
  const ranking = topTitles.map(([title, count], index) => `<text x="770" y="${285 + index * 42}" class="rank">${String(index + 1).padStart(2, '0')}</text><text x="815" y="${285 + index * 42}" class="title">${escapeSvgText(title.slice(0, 18))}</text><text x="1080" y="${285 + index * 42}" text-anchor="end" class="count">${count} 次</text>`).join('');
  const genreText = topGenres.map(([name, count]) => `${name} ${count}`).join('  ·  ') || '类型资料待补';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#20352c"/><stop offset="1" stop-color="#577257"/></linearGradient><style>.serif{font-family:Georgia,'Songti SC',serif}.sans{font-family:Arial,'PingFang SC',sans-serif}.small{font:16px sans;fill:#a9bca9}.count{font:18px sans;fill:#678261}.rank{font:18px sans;fill:#9fb691}.title{font:24px serif;fill:#304238}.muted{font:18px sans;fill:#899b8e}</style></defs><rect width="1200" height="1600" fill="#f4f5ef"/><rect x="0" y="0" width="1200" height="650" fill="url(#bg)"/><circle cx="1010" cy="130" r="210" fill="#a9c18b" opacity=".18"/><circle cx="1040" cy="150" r="125" fill="none" stroke="#dbe7ce" stroke-opacity=".25" stroke-width="2"/><text x="80" y="104" class="sans" font-size="16" letter-spacing="5" fill="#b5c8b1">PERSONAL SCREENING ROOM  /  ANNUAL ARCHIVE</text><text x="80" y="215" class="serif" font-size="88" fill="#f3f5ea">${escapeSvgText(year)}</text><text x="80" y="278" class="serif" font-size="42" fill="#d7e5cf">我的观影年鉴</text><text x="80" y="350" class="sans" font-size="19" fill="#b9cbb9">这一年，电影把时间变成了可以回看的形状。</text><text x="80" y="470" class="serif" font-size="78" fill="#edf4e6">${watched.length}</text><text x="85" y="510" class="sans" font-size="17" fill="#b8cbb8">次已观影</text><text x="340" y="470" class="serif" font-size="78" fill="#edf4e6">${titleCounts.size}</text><text x="345" y="510" class="sans" font-size="17" fill="#b8cbb8">部电影</text><text x="600" y="470" class="serif" font-size="78" fill="#edf4e6">${monthCounts.size}</text><text x="605" y="510" class="sans" font-size="17" fill="#b8cbb8">个有记录月份</text><rect x="70" y="700" width="1060" height="300" rx="22" fill="#fffefa" stroke="#dfe6da"/><text x="100" y="765" class="sans" font-size="15" letter-spacing="3" fill="#95a591">MONTHLY RHYTHM</text><text x="100" y="810" class="serif" font-size="32" fill="#3f5147">每个月，走进电影几次</text><line x1="90" y1="560" x2="1120" y2="560" stroke="#dfe8db"/>${monthBars}<rect x="70" y="1040" width="1060" height="380" rx="22" fill="#fffefa" stroke="#dfe6da"/><text x="100" y="1105" class="sans" font-size="15" letter-spacing="3" fill="#95a591">YOUR SCREENING LIST</text><text x="100" y="1150" class="serif" font-size="32" fill="#3f5147">年度观影榜单</text>${ranking || '<text x="100" y="1225" class="muted">还没有足够的观影记录</text>'}<text x="100" y="1480" class="sans" font-size="17" fill="#8a9a8e">类型偏好：${escapeSvgText(genreText)}</text><text x="100" y="1525" class="sans" font-size="14" fill="#abb7ad">Generated from your live CloudBase archive · ${new Date().toLocaleDateString('zh-CN')}</text></svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }); const url = URL.createObjectURL(blob); const save = (href: string, filename: string) => { const anchor = document.createElement('a'); anchor.href = href; anchor.download = filename; anchor.style.display = 'none'; document.body.appendChild(anchor); anchor.click(); window.setTimeout(() => anchor.remove(), 1200); }; const image = new Image(); image.onload = () => { const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1600; const context = canvas.getContext('2d'); if (context) { context.drawImage(image, 0, 0); save(canvas.toDataURL('image/png'), `我的观影年鉴-${year}.png`); } else save(url, `我的观影年鉴-${year}.svg`); window.setTimeout(() => URL.revokeObjectURL(url), 1200); }; image.onerror = () => { save(url, `我的观影年鉴-${year}.svg`); window.setTimeout(() => URL.revokeObjectURL(url), 1200); }; image.src = url;
}

function WatchReport({ store, cloudLocked, onBatchEnrich, batchBusy, batchProgress }: { store: Store; cloudLocked: boolean; onBatchEnrich: () => void; batchBusy: boolean; batchProgress: { done: number; total: number } }) {
  const report = useMemo(() => {
    const filmMap = new Map(store.films.map((film) => [film.id, film]));
    const watched = store.events.filter((event) => event.status === 'watched');
    const titleCounts = new Map<string, number>();
    const monthCounts = new Map<string, number>();
    const yearCounts = new Map<string, number>();
    const genreCounts = new Map<string, number>();
    const directorCounts = new Map<string, number>();
    const actorCounts = new Map<string, number>();
    const decadeCounts = new Map<string, number>();
    const countryCounts = new Map<string, number>();
    const languageCounts = new Map<string, number>();
    const groupCounts = new Map<string, number>();
    const sceneCounts = new Map<string, number>();
    const ratings: number[] = [];
    const runtimeValues: number[] = [];
    const exactDates: Array<{ event: WatchEvent; film?: Film; watchedDate: Date }> = [];
    for (const event of watched) {
      const film = filmMap.get(event.filmId);
      const title = film?.title || '未命名电影';
      titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
      const month = event.watchedDate.trim().slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(month)) {
        monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
        yearCounts.set(month.slice(0, 4), (yearCounts.get(month.slice(0, 4)) || 0) + 1);
      }
      splitTags(film?.genres || '').forEach((genre) => genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1));
      const director = film?.director.trim();
      if (director) directorCounts.set(director, (directorCounts.get(director) || 0) + 1);
      splitTags(film?.cast || '').slice(0, 12).forEach((actor) => actorCounts.set(actor, (actorCounts.get(actor) || 0) + 1));
      const releaseYear = film?.releaseDate.match(/\d{4}/)?.[0];
      if (releaseYear) { const decade = `${Math.floor(Number(releaseYear) / 10) * 10}s`; decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + 1); }
      splitTags(film?.countries || '').forEach((country) => countryCounts.set(country, (countryCounts.get(country) || 0) + 1));
      splitTags(film?.languages || '').forEach((language) => languageCounts.set(language, (languageCounts.get(language) || 0) + 1));
      const runtime = Number(film?.runtimeMinutes);
      if (Number.isFinite(runtime) && runtime > 0) runtimeValues.push(runtime);
      if (event.watchGroup.trim()) groupCounts.set(event.watchGroup.trim(), (groupCounts.get(event.watchGroup.trim()) || 0) + 1);
      if (event.scene.trim()) sceneCounts.set(event.scene.trim(), (sceneCounts.get(event.scene.trim()) || 0) + 1);
      const rating = Number(event.myRating);
      if (event.myRating.trim() && Number.isFinite(rating) && rating >= 0 && rating <= 10) ratings.push(rating);
      if (/^\d{4}-\d{2}-\d{2}$/.test(event.watchedDate)) exactDates.push({ event, film, watchedDate: new Date(`${event.watchedDate}T12:00:00`) });
    }
    const toRows = (counts: Map<string, number>) => Array.from(counts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const monthly = Array.from(monthCounts.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => ({ key, count, label: monthLabel(key).replace(' 年 ', '.').replace(' 月', '') }));
    const years = Array.from(yearCounts.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, count }));
    const genreRows = toRows(genreCounts).slice(0, 6);
    const directorRows = toRows(directorCounts).slice(0, 5);
    const actorRows = toRows(actorCounts).slice(0, 8);
    const decadeRows = toRows(decadeCounts).sort((a, b) => a.name.localeCompare(b.name));
    const countryRows = toRows(countryCounts).slice(0, 8);
    const languageRows = toRows(languageCounts).slice(0, 8);
    const topTitles = toRows(titleCounts).slice(0, 8);
    const groups = toRows(groupCounts);
    const scenes = toRows(sceneCounts).slice(0, 5);
    const repeatRows = toRows(titleCounts).filter((row) => row.count > 1);
    const pendingTitles = Array.from(new Set(store.films.filter((film) => film.sourceNote.includes('待确认')).map((film) => film.title)));
    const peakMonth = monthly.reduce<{ key: string; count: number } | null>((best, item) => !best || item.count > best.count ? item : best, null);
    const averageRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
    const ratingBuckets = [{ name: '0–5', count: ratings.filter((value) => value <= 5).length }, { name: '5–7', count: ratings.filter((value) => value > 5 && value <= 7).length }, { name: '7–8.5', count: ratings.filter((value) => value > 7 && value <= 8.5).length }, { name: '8.5–10', count: ratings.filter((value) => value > 8.5).length }];
    const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const weekdayCounts = weekdayNames.map((name) => ({ name, count: 0 }));
    exactDates.forEach(({ watchedDate }) => { const index = (watchedDate.getDay() + 6) % 7; weekdayCounts[index].count += 1; });
    const filmIds = Array.from(new Set(watched.map((event) => event.filmId)));
    const watchedFilms = filmIds.map((filmId) => filmMap.get(filmId)).filter((film): film is Film => Boolean(film));
    const coverageRows = [{ name: '海报', count: watchedFilms.filter((film) => film.poster).length }, { name: '上映日期', count: watchedFilms.filter((film) => film.releaseDate).length }, { name: '导演', count: watchedFilms.filter((film) => film.director).length }, { name: '演员', count: watchedFilms.filter((film) => film.cast).length }, { name: '类型', count: watchedFilms.filter((film) => film.genres).length }, { name: '简介', count: watchedFilms.filter((film) => film.synopsis).length }, { name: '国家 / 语言', count: watchedFilms.filter((film) => film.countries || film.languages).length }, { name: '片长', count: watchedFilms.filter((film) => film.runtimeMinutes).length }].map((item) => ({ ...item, total: watchedFilms.length, percent: watchedFilms.length ? Math.round((item.count / watchedFilms.length) * 100) : 0 }));
    const releaseLagValues = exactDates.map(({ film, watchedDate }) => {
      const releaseValue = film?.releaseDate.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      if (!releaseValue) return null;
      const releaseDate = new Date(`${releaseValue}T12:00:00`);
      const days = Math.round((watchedDate.getTime() - releaseDate.getTime()) / 86400000);
      return days >= 0 ? days : null;
    }).filter((days): days is number => days !== null);
    const firstMonth = monthly[0]?.key;
    const lastMonth = monthly[monthly.length - 1]?.key;
    const monthSpan = firstMonth && lastMonth ? (Number(lastMonth.slice(0, 4)) - Number(firstMonth.slice(0, 4))) * 12 + Number(lastMonth.slice(5)) - Number(firstMonth.slice(5)) + 1 : 0;
    return {
      watched, monthly, years, genreRows, directorRows, actorRows, decadeRows, countryRows, languageRows, topTitles, groups, scenes, repeatRows, pendingTitles, peakMonth, ratingBuckets, weekdayCounts, coverageRows,
      averageRating, ratingCount: ratings.length, uniqueTitles: titleCounts.size, highRatingCount: ratings.filter((value) => value >= 8).length,
      reviewCount: watched.filter((event) => event.shortReview.trim()).length,
      exactDateCount: watched.filter((event) => /^\d{4}-\d{2}-\d{2}$/.test(event.watchedDate)).length,
      activeMonthCount: monthly.length, monthSpan, averagePerMonth: monthly.length ? watched.length / monthly.length : 0,
      releaseLagAverage: releaseLagValues.length ? Math.round(releaseLagValues.reduce((sum, value) => sum + value, 0) / releaseLagValues.length) : null,
      releaseLagCount: releaseLagValues.length, totalFilms: watchedFilms.length,
      runtimeTotal: runtimeValues.reduce((sum, value) => sum + value, 0), runtimeFilmCount: runtimeValues.length,
      maxMonthly: Math.max(1, ...monthly.map((item) => item.count)),
      maxGenre: Math.max(1, ...genreRows.map((item) => item.count)),
      maxYear: Math.max(1, ...years.map((item) => item.count)),
      maxRating: Math.max(1, ...ratingBuckets.map((item) => item.count)),
      maxWeekday: Math.max(1, ...weekdayCounts.map((item) => item.count)),
      maxActor: Math.max(1, ...actorRows.map((item) => item.count)), maxDecade: Math.max(1, ...decadeRows.map((item) => item.count)), maxCountry: Math.max(1, ...countryRows.map((item) => item.count)), maxLanguage: Math.max(1, ...languageRows.map((item) => item.count)),
    };
  }, [store]);

  const reportYears = report.years.map((item) => item.name);
  const [requestedCardYear, setRequestedCardYear] = useState(reportYears.includes(String(new Date().getFullYear())) ? String(new Date().getFullYear()) : reportYears.at(-1) || String(new Date().getFullYear()));
  const cardYear = reportYears.includes(requestedCardYear) ? requestedCardYear : reportYears.at(-1) || requestedCardYear;
  if (cloudLocked && store.events.length === 0) return <div className="empty-state report-empty"><div className="empty-orbit" aria-hidden="true"><span>✦</span></div><p className="empty-kicker">PERSONAL INSIGHTS</p><h2>登录后生成你的观影报告</h2><p>报告只读取你自己的 Supabase 观影数据，不会把数据发给第三方。</p></div>;

  const persona = report.averagePerMonth >= 12 ? '高密度观影者' : report.averagePerMonth >= 6 ? '稳定观影者' : report.activeMonthCount ? '慢慢积累的观影者' : '刚刚开始的观影者';
  const insight = report.peakMonth ? `你在 ${monthLabel(report.peakMonth.key)} 看得最多，共留下 ${report.peakMonth.count} 次观影记录。${report.genreRows[0] ? `从类型来看，你最常走进的是“${report.genreRows[0].name}”的世界。` : ''}${report.ratingCount && report.highRatingCount >= report.ratingCount / 2 ? '你的评分整体偏慷慨，喜欢的电影会明确留下高分。' : ''}` : '先记录几次观影，报告会慢慢长出属于你的轮廓。';
  return <div className="report-page">
    <div className="report-hero"><div><p className="eyebrow">PERSONAL INSIGHTS <span>／</span> LIVE ARCHIVE</p><h1>你的观影，<em>有迹可循。</em></h1><p className="intro">这是一份随着你的数据库实时生长的私人观影年鉴。</p><div className="report-chips"><span>● 实时计算</span><span>{persona}</span><span>{report.monthSpan ? `跨度 ${report.monthSpan} 个月` : '等待更多日期'}</span></div></div><div className="report-hero-actions"><div className="report-stamp"><span>LIVE ARCHIVE</span><strong>{report.watched.length}</strong><small>次已观影</small></div><div className="year-card-tools"><label>年度海报<select value={cardYear} onChange={(event) => setRequestedCardYear(event.target.value)}>{reportYears.length ? reportYears.map((year) => <option key={year} value={year}>{year}</option>) : <option value={cardYear}>{cardYear}</option>}</select></label><button className="secondary-button" type="button" onClick={() => downloadYearCard(store, cardYear)}>↗ 导出分享图</button></div></div></div>
    <div className="report-kpis"><div className="report-kpi featured"><span>观影事件</span><strong>{store.events.length}</strong><small>包含已观影与观影计划</small></div><div className="report-kpi"><span>看过电影</span><strong>{report.uniqueTitles}</strong><small>按电影标题统计</small></div><div className="report-kpi"><span>活跃月份</span><strong>{report.activeMonthCount}</strong><small>有实际观影记录的月份</small></div><div className="report-kpi"><span>平均每月</span><strong>{report.activeMonthCount ? report.averagePerMonth.toFixed(1) : '—'}</strong><small>按活跃月份计算</small></div><div className="report-kpi"><span>平均评分</span><strong>{report.ratingCount ? report.averageRating.toFixed(1) : '—'}</strong><small>{report.ratingCount ? `已有 ${report.ratingCount} 次评分` : '还没有评分'}</small></div><div className="report-kpi"><span>短评覆盖</span><strong>{report.watched.length ? `${Math.round((report.reviewCount / report.watched.length) * 100)}%` : '—'}</strong><small>{report.reviewCount} 次留下感受</small></div></div>
    <div className="report-layout"><section className="report-panel report-trend"><div className="report-panel-heading"><div><p className="panel-kicker">MONTHLY RHYTHM</p><h2>你的观影节奏</h2></div><span>{report.monthly.length} 个月有记录</span></div>{report.monthly.length ? <div className="monthly-chart">{report.monthly.map((item) => <div className="month-bar" key={item.key}><div className="month-bar-value">{item.count}</div><div className="month-bar-track"><i style={{ height: `${Math.max(8, (item.count / report.maxMonthly) * 100)}%` }} /></div><span>{item.label}</span></div>)}</div> : <div className="report-muted">补充观影日期后，这里会出现你的时间轨迹。</div>}</section><section className="report-panel year-panel"><div className="report-panel-heading"><div><p className="panel-kicker">BY YEAR</p><h2>年份分布</h2></div></div><div className="year-list">{report.years.map((item) => <div className="year-row" key={item.name}><div><strong>{item.name}</strong><span>{item.count} 次</span></div><div className="progress-track"><i style={{ width: `${(item.count / report.maxYear) * 100}%` }} /></div></div>)}</div><div className="year-foot"><span>已观影 {report.watched.length}</span><span>计划中 {store.events.filter((event) => event.status === 'planned').length}</span></div></section></div>
    <div className="report-layout report-layout-bottom"><section className="report-panel"><div className="report-panel-heading"><div><p className="panel-kicker">GENRE COMPASS</p><h2>类型偏好</h2></div><span>按观影事件计</span></div><div className="rank-list">{report.genreRows.length ? report.genreRows.map((item, index) => <div className="rank-row" key={item.name}><span className="rank-number">0{index + 1}</span><strong>{item.name}</strong><div className="progress-track"><i style={{ width: `${(item.count / report.maxGenre) * 100}%` }} /></div><em>{item.count}</em></div>) : <div className="report-muted">豆瓣类型资料还没有补齐。</div>}</div></section><section className="report-panel rating-panel"><div className="report-panel-heading"><div><p className="panel-kicker">RATING SHAPE</p><h2>你的评分分布</h2></div><span>{report.highRatingCount} 部 8 分以上</span></div><div className="rating-summary"><strong>{report.ratingCount ? report.averageRating.toFixed(1) : '—'}</strong><span>个人评分均值</span></div><div className="rating-list">{report.ratingBuckets.map((item) => <div className="rating-row" key={item.name}><span>{item.name}</span><div className="progress-track"><i style={{ width: `${(item.count / report.maxRating) * 100}%` }} /></div><em>{item.count}</em></div>)}</div></section></div>
    <div className="report-layout report-layout-triple"><section className="report-panel"><div className="report-panel-heading"><div><p className="panel-kicker">CALENDAR PULSE</p><h2>哪天最常看电影</h2></div><span>{report.exactDateCount} 次精确到日</span></div>{report.exactDateCount ? <div className="weekday-chart">{report.weekdayCounts.map((item) => <div className="weekday-bar" key={item.name}><span>{item.count || '—'}</span><div><i style={{ height: `${Math.max(item.count ? 10 : 2, (item.count / report.maxWeekday) * 100)}%` }} /></div><b>{item.name.replace('周', '')}</b></div>)}</div> : <div className="report-muted">目前大多记录到月份；补充具体日期后，这里会显示星期分布。</div>}</section><section className="report-panel"><div className="report-panel-heading"><div><p className="panel-kicker">DIRECTOR NOTES</p><h2>导演足迹</h2></div></div><div className="director-list">{report.directorRows.length ? report.directorRows.map((item, index) => <div key={item.name}><span>{index + 1}</span><strong>{item.name}</strong><em>{item.count} 部</em></div>) : <div className="report-muted">导演资料还没有补齐。</div>}</div></section><section className="report-panel"><div className="report-panel-heading"><div><p className="panel-kicker">WATCHING CONTEXT</p><h2>观影场景</h2></div></div><div className="director-list">{report.scenes.length ? report.scenes.map((item, index) => <div key={item.name}><span>{index + 1}</span><strong>{item.name}</strong><em>{item.count} 次</em></div>) : <div className="report-muted">记录“观影场景”后，这里会出现你的观看情境。</div>}</div></section></div>
    <div className="report-layout report-layout-bottom report-dimension-grid"><section className="report-panel"><div className="report-panel-heading"><div><p className="panel-kicker">CASTING MAP</p><h2>演员足迹</h2></div><span>出现次数</span></div>{report.actorRows.length ? <div className="dimension-list">{report.actorRows.map((item, index) => <div className="dimension-row" key={item.name}><span>{String(index + 1).padStart(2, '0')}</span><strong>{item.name}</strong><div className="progress-track"><i style={{ width: `${(item.count / report.maxActor) * 100}%` }} /></div><em>{item.count}</em></div>)}</div> : <div className="report-muted">演员资料还没有补齐。</div>}</section><section className="report-panel"><div className="report-panel-heading"><div><p className="panel-kicker">TIME CAPSULE</p><h2>上映年代</h2></div><span>按上映年份</span></div>{report.decadeRows.length ? <div className="dimension-list">{report.decadeRows.map((item) => <div className="dimension-row" key={item.name}><strong>{item.name}</strong><div className="progress-track"><i style={{ width: `${(item.count / report.maxDecade) * 100}%` }} /></div><em>{item.count}</em></div>)}</div> : <div className="report-muted">上映日期还没有补齐。</div>}</section><section className="report-panel"><div className="report-panel-heading"><div><p className="panel-kicker">WORLD MAP</p><h2>国家 / 地区</h2></div><span>按电影资料</span></div>{report.countryRows.length ? <div className="dimension-list">{report.countryRows.map((item) => <div className="dimension-row" key={item.name}><strong>{item.name}</strong><div className="progress-track"><i style={{ width: `${(item.count / report.maxCountry) * 100}%` }} /></div><em>{item.count}</em></div>)}</div> : <div className="report-muted">补资料后，这里会显示国家和地区。</div>}</section><section className="report-panel"><div className="report-panel-heading"><div><p className="panel-kicker">LANGUAGE TRACK</p><h2>语言偏好</h2></div><span>按电影资料</span></div>{report.languageRows.length ? <div className="dimension-list">{report.languageRows.map((item) => <div className="dimension-row" key={item.name}><strong>{item.name}</strong><div className="progress-track"><i style={{ width: `${(item.count / report.maxLanguage) * 100}%` }} /></div><em>{item.count}</em></div>)}</div> : <div className="report-muted">补资料后，这里会显示语言分布。</div>}</section><section className="report-panel runtime-panel"><div className="report-panel-heading"><div><p className="panel-kicker">RUNNING TIME</p><h2>观看时长</h2></div><span>按片长估算</span></div><div className="runtime-number"><strong>{report.runtimeFilmCount ? Math.round(report.runtimeTotal / 60) : '—'}</strong><span>小时</span></div><p className="runtime-note">{report.runtimeFilmCount ? `已收录 ${report.runtimeFilmCount} 部电影片长，平均每部 ${Math.round(report.runtimeTotal / report.runtimeFilmCount)} 分钟。` : '豆瓣片长资料还没有收录；批量补资料后会自动出现。'}</p></section><section className="report-panel top-title-panel"><div className="report-panel-heading"><div><p className="panel-kicker">MOST WATCHED</p><h2>观影榜单</h2></div><span>保留每次事件</span></div>{report.topTitles.length ? <div className="director-list">{report.topTitles.slice(0, 5).map((item, index) => <div key={item.name}><span>{index + 1}</span><strong>{item.name}</strong><em>{item.count} 次</em></div>)}</div> : <div className="report-muted">还没有观影记录。</div>}</section></div>
    <div className="report-insight"><span className="insight-mark">✦</span><div><p className="panel-kicker">A NOTE FROM YOUR ARCHIVE</p><p>{insight}</p></div><div className="insight-facts"><span><b>{report.exactDateCount}</b> 次精确到日</span><span><b>{report.releaseLagCount}</b> 次可算上映间隔</span><span><b>{report.repeatRows.length}</b> 部重复观看</span></div></div>
    <div className="report-layout report-layout-bottom"><section className="report-panel special-panel"><div className="report-panel-heading"><div><p className="panel-kicker">SPECIAL SCREENINGS</p><h2>特别观影</h2></div></div>{report.groups.length ? <div className="special-list">{report.groups.map((item) => <div key={item.name}><span>✦</span><strong>{item.name}</strong><em>{item.count} 次</em></div>)}</div> : <div className="report-muted">给一次观影加上分组，它会出现在这里。</div>}{report.releaseLagAverage !== null && <div className="metric-note">从上映到观看，平均相隔 <b>{report.releaseLagAverage}</b> 天 <small>（仅按同时拥有上映日期和精确观影日的记录计算）</small></div>}</section><section className="report-panel pending-panel"><div className="report-panel-heading"><div><p className="panel-kicker">DATA COMPLETENESS</p><h2>豆瓣缓存</h2></div><span>{report.pendingTitles.length} 部待确认</span></div><div className="coverage-list">{report.coverageRows.map((item) => <div className="coverage-row" key={item.name}><div><span>{item.name}</span><em>{item.percent}%</em></div><div className="progress-track"><i style={{ width: `${item.percent}%` }} /></div></div>)}</div><div className="batch-enrich-box"><div><strong>{batchBusy ? `正在刷新 ${batchProgress.done} / ${batchProgress.total}` : '有过期或缺失资料？'}</strong><small>{batchBusy ? '按低频顺序处理，歧义片名会跳过' : '服务器缓存默认 30 天有效，不覆盖你的观影信息'}</small></div><button className="secondary-button" type="button" onClick={onBatchEnrich} disabled={batchBusy || cloudLocked}>{batchBusy ? '处理中…' : '刷新豆瓣缓存'}</button></div>{report.pendingTitles.length ? <div className="pending-title-list report-pending-list">{report.pendingTitles.map((title) => <span key={title}>{title}</span>)}</div> : <div className="report-muted compact-muted">目前没有待确认的电影资料。</div>}</section></div>
  </div>;
}

function PosterVisual({ film, onRepair }: { film: Film; onRepair?: () => void }) {
  const localPoster = localPosterPath(film.poster);
  const mirrorPoster = posterMirrorUrl(film.poster);
  const initialSource: 'local' | 'mirror' | 'original' | 'failed' = localPoster ? 'local' : mirrorPoster ? 'mirror' : film.poster ? 'original' : 'failed';
  const [sourceState, setSourceState] = useState<{ poster: string; source: 'local' | 'mirror' | 'original' | 'failed' }>({ poster: film.poster, source: initialSource });
  const repairRequested = useRef(false);
  const source = sourceState.poster === film.poster ? sourceState.source : initialSource;
  if (source === 'failed') return <div className="poster-placeholder"><span>{initials(film.title)}</span><strong>{film.title}</strong><small>{film.poster ? '海报加载失败' : '海报待补'}</small></div>;
  const src = source === 'local' ? localPoster : source === 'mirror' ? mirrorPoster : film.poster;
  return <img src={src} alt={`${film.title} 海报`} loading="lazy" decoding="async" onError={() => { if (!repairRequested.current && onRepair && film.poster) { repairRequested.current = true; onRepair(); } setSourceState({ poster: film.poster, source: source === 'local' && mirrorPoster ? 'mirror' : source === 'mirror' && film.poster ? 'original' : 'failed' }); }} />;
}

function RecordCard({ event, film, cinema, viewMode, onEdit, onDelete, onToggle, onDuplicate, onPosterRepair, onRefresh, refreshing }: { event: WatchEvent; film: Film; cinema?: Cinema; viewMode: ViewMode; onEdit: () => void; onDelete: () => void; onToggle: () => void; onDuplicate: () => void; onPosterRepair?: () => void; onRefresh?: () => void; refreshing?: boolean }) {
  const tags = splitTags(film.genres);
  const ticketNumber = event.id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || '000001';
  const isFestival = event.watchGroup?.includes('影展') || event.watchGroup?.includes('北影节');
  return <article className={`record-card ticket-card ${event.status}`}>
    <div className="ticket-perforation" aria-hidden="true"><span /><span /><span /></div>
    <div className="poster-frame"><PosterVisual film={film} onRepair={onPosterRepair} /></div>
    <div className="record-main">
      <div className="record-topline"><span className={`status-badge ${event.status}`}><b aria-hidden="true">{event.status === 'watched' ? '●' : '○'}</b>{event.status === 'watched' ? '已观影' : '计划中'}</span>{event.watchGroup && <span className={`group-badge ${isFestival ? 'festival-badge' : ''}`}>✦ {event.watchGroup}</span>}{event.scene && <span className="scene-tag">{event.scene}</span>}<span className="ticket-no">NO. {ticketNumber}</span><span className="record-date">{formatDate(event.watchedDate)}</span></div>
      <div className="record-title-line"><h3>{film.doubanUrl ? <a className="movie-title-link" href={film.doubanUrl} target="_blank" rel="noreferrer">{film.title} <span aria-hidden="true">↗</span></a> : film.title}</h3><div className="rating-wrap">{event.myRating ? <><span className="rating-star">★</span><strong>{event.myRating}</strong><small>我的评分</small></> : <span className="muted-rating">未评分</span>}</div></div>
      <div className="record-meta"><span>{film.releaseDate ? `上映 ${formatDate(film.releaseDate)}` : '上映日期待补'}</span>{film.doubanRating && <><i /> <span>豆瓣 {film.doubanRating}</span></>}{film.director && <><i /> <span>导演 {film.director}</span></>}{film.doubanUrl && <><i /> <a className="douban-link" href={film.doubanUrl} target="_blank" rel="noreferrer">豆瓣条目</a></>}</div>
      {(cinema || event.hall || event.seat || event.watchedTime || event.ticketStatus) && <div className="screening-meta"><span className="screening-label">放映</span>{cinema && <strong>{cinema.name}</strong>}{event.hall && <span>{event.hall}</span>}{event.seat && <span>{event.seat}</span>}{event.watchedTime && <span>{event.watchedTime}</span>}{event.ticketStatus === 'refunded' && <em>已退款</em>}</div>}
      {viewMode === 'compact' ? <p className="review-snippet">{event.shortReview || film.synopsis || '还没有写下这次观影的感受。'}</p> : <ExpandedDetails event={event} film={film} cinema={cinema} tags={tags} />}
    </div>
    <div className="record-actions"><span className="ticket-stub-label" aria-hidden="true">TICKET</span><button type="button" onClick={onToggle} title={event.status === 'watched' ? '改为观影计划' : '标记为已观影'} aria-label={event.status === 'watched' ? '改为观影计划' : '标记为已观影'}>{event.status === 'watched' ? '↺' : '✓'}</button><button type="button" onClick={onRefresh} disabled={!onRefresh || refreshing} title="刷新豆瓣缓存" aria-label="刷新豆瓣缓存">{refreshing ? '…' : '⟳'}</button><button type="button" onClick={onEdit} title="编辑记录" aria-label="编辑记录">✎</button><button type="button" onClick={onDuplicate} title="复制为新的观影事件" aria-label="复制为新的观影事件">＋</button><button className="danger" type="button" onClick={onDelete} title="删除记录" aria-label="删除记录">×</button></div>
  </article>;
}

function ExpandedDetails({ event, film, cinema, tags }: { event: WatchEvent; film: Film; cinema?: Cinema; tags: string[] }) {
  const notes = [event.dateNote && `日期备注：${event.dateNote}`, film.sourceNote && `资料备注：${film.sourceNote}`].filter(Boolean).join('；');
  return <div className="expanded-details"><p className="synopsis">{film.synopsis || '还没有填写电影简介。'}</p><div className="detail-grid"><span><b>观影日期</b>{event.watchedDate ? formatDate(event.watchedDate) : '待补'}{event.watchedTime ? ` ${event.watchedTime}` : ''}</span><span><b>电影院</b>{cinema?.name || '未记录'}</span><span><b>影厅 / 座位</b>{[event.hall, event.seat].filter(Boolean).join(' · ') || '未记录'}</span><span><b>导演</b>{film.director || '待补'}</span><span><b>演员</b>{film.cast || '待补'}</span><span><b>观影场景</b>{event.scene || '未记录'}</span></div>{tags.length > 0 && <div className="tag-row">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}{event.shortReview && <blockquote>“{event.shortReview}”</blockquote>}{film.doubanUrl && <a className="source-link" href={film.doubanUrl} target="_blank" rel="noreferrer">打开豆瓣条目 ↗</a>}{notes && <div className="source-note">备注：{notes}</div>}</div>;
}

function RecordModal({ editing, form, onChange, onClose, onSubmit }: { editing: boolean; form: FormState; onChange: (key: keyof FormState, value: string) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const monthValue = monthInputValue(form.watchedDate);
  const dateValue = dateInputValue(form.watchedDate);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><p className="eyebrow">PERSONAL ARCHIVE</p><h2 id="modal-title">{editing ? '编辑观影记录' : '添加观影记录'}</h2></div><button className="modal-close" type="button" onClick={onClose} aria-label="关闭">×</button></div><form onSubmit={onSubmit}><div className="modal-body"><section className="form-section"><p className="form-section-title">电影资料 <span>电影本身的信息</span></p><div className="form-grid two-col"><label className="form-field full"><span>电影标题 <b>*</b></span><input autoFocus required value={form.title} onChange={(event) => onChange('title', fieldValue(event))} placeholder="保留你的原始标题" /></label><label className="form-field"><span>海报 URL</span><input value={form.poster} onChange={(event) => onChange('poster', fieldValue(event))} placeholder="可暂时留空" /></label><label className="form-field"><span>上映日期 <i>releaseDate</i></span><input value={form.releaseDate} onChange={(event) => onChange('releaseDate', fieldValue(event))} placeholder="YYYY-MM-DD" /></label><label className="form-field"><span>豆瓣评分</span><input inputMode="decimal" value={form.doubanRating} onChange={(event) => onChange('doubanRating', fieldValue(event))} placeholder="查到后再填" /></label><label className="form-field"><span>导演</span><input value={form.director} onChange={(event) => onChange('director', fieldValue(event))} placeholder="例如：王家卫" /></label><label className="form-field"><span>演员</span><input value={form.cast} onChange={(event) => onChange('cast', fieldValue(event))} placeholder="用顿号分隔" /></label><label className="form-field"><span>类型</span><input value={form.genres} onChange={(event) => onChange('genres', fieldValue(event))} placeholder="剧情、喜剧…" /></label><label className="form-field full"><span>电影简介</span><textarea rows={2} value={form.synopsis} onChange={(event) => onChange('synopsis', fieldValue(event))} placeholder="没有可靠资料时保持为空" /></label></div></section><section className="form-section"><p className="form-section-title">这一次观看 <span>观影事件的信息</span></p><div className="form-grid two-col"><label className="form-field"><span>状态</span><select value={form.status} onChange={(event) => onChange('status', fieldValue(event) as Status)}><option value="watched">已观影</option><option value="planned">观影计划</option></select></label><label className="form-field"><span>我的评分</span><input inputMode="decimal" value={form.myRating} onChange={(event) => onChange('myRating', fieldValue(event))} placeholder="0 - 10" /></label><div className="form-field full"><span>我的观影日期 <i>watchedDate · 选填</i></span><div className="date-picker-grid"><label className="date-picker-option"><span>只记录月份</span><input type="month" aria-label="观影月份" value={monthValue} onChange={(event) => onChange('watchedDate', fieldValue(event))} /></label><label className="date-picker-option"><span>精确到日期</span><input type="date" aria-label="具体观影日期" value={dateValue} onChange={(event) => onChange('watchedDate', fieldValue(event))} /></label></div><small className="field-help">页面按观影月份分组；记得具体日期时可选到日，记不清时只选月份。</small></div><label className="form-field"><span>观影分组 <i>可选标记</i></span><input value={form.watchGroup} onChange={(event) => onChange('watchGroup', fieldValue(event))} placeholder="例如：北影节" /></label><label className="form-field"><span>观影场景</span><input value={form.scene} onChange={(event) => onChange('scene', fieldValue(event))} placeholder="例如：和朋友、资料馆" /></label><label className="form-field"><span>日期备注</span><input value={form.dateNote} onChange={(event) => onChange('dateNote', fieldValue(event))} placeholder="例如：原文写作 2024.5，待确认" /></label><label className="form-field full"><span>我的短评</span><textarea rows={3} value={form.shortReview} onChange={(event) => onChange('shortReview', fieldValue(event))} placeholder="记下当时的感受…" /></label><label className="form-field full"><span>资料来源备注</span><input value={form.sourceNote} onChange={(event) => onChange('sourceNote', fieldValue(event))} placeholder="例如：待从豆瓣确认" /></label></div></section><p className="form-tip">提示：上映日期与我的观影日期分开保存；观影分组只是卡片标记，外层永远按观影月份排列。</p></div><div className="modal-footer"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit">{editing ? '保存修改' : '保存记录'} <span>→</span></button></div></form></div></div>;
}

void RecordModal;

function RecordModalWithLookup({ editing, form, cinemas, onChange, onClose, onSubmit, metadataBusy, candidates, onAutoFill, onSelectCandidate }: {
  editing: boolean;
  form: FormState;
  cinemas: Cinema[];
  onChange: (key: keyof FormState, value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  metadataBusy: boolean;
  candidates: MovieCandidate[];
  onAutoFill: () => void;
  onSelectCandidate: (candidate: MovieCandidate) => void;
}) {
  const monthValue = monthInputValue(form.watchedDate);
  const dateValue = dateInputValue(form.watchedDate);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-header"><div><p className="eyebrow">PERSONAL ARCHIVE</p><h2 id="modal-title">{editing ? '编辑观影记录' : '添加观影记录'}</h2></div><button className="modal-close" type="button" onClick={onClose} aria-label="关闭">×</button></div>
      <form onSubmit={onSubmit}>
        <div className="modal-body">
          <section className="form-section">
            <p className="form-section-title">电影资料 <span>电影本身的信息</span></p>
            <div className="form-grid two-col">
              <label className="form-field full"><span>电影标题 <b>*</b></span><div className="title-lookup-row"><input autoFocus required value={form.title} onChange={(event) => onChange('title', fieldValue(event))} placeholder="输入片名，例如：花样年华" /><button className="secondary-button lookup-button" type="button" onClick={onAutoFill} disabled={metadataBusy}>{metadataBusy ? '查询中…' : '✦ 匹配豆瓣条目'}</button></div><small className="field-help">输入片名后匹配豆瓣版本；电影资料由服务器缓存，不需要手动填写。</small></label>
              {candidates.length > 1 && <div className="candidate-picker full"><div className="candidate-picker-heading"><strong>请选择正确的电影版本</strong><span>只会把你选中的条目填入表单</span></div><div className="candidate-list">{candidates.map((candidate) => <button className="candidate-option" type="button" key={`${candidate.subjectId}-${candidate.year}`} onClick={() => onSelectCandidate(candidate)} disabled={metadataBusy}><span className="candidate-copy"><span className="candidate-title">{candidate.title}</span><small>{candidate.director ? `导演：${candidate.director}` : '导演待补'}{candidate.cast ? ` · 演员：${candidate.cast.split(' / ').slice(0, 4).join(' / ')}` : ' · 演员待补'}</small></span><span className="candidate-year">{candidate.year || '年份未知'}</span></button>)}</div></div>}
              <div className="douban-source-card full">
                <div className="douban-source-head"><div><span className="source-card-kicker">豆瓣条目 / SERVER CACHE</span><strong>{form.doubanUrl ? '已关联豆瓣电影条目' : '还没有关联豆瓣条目'}</strong><small>{form.doubanUrl ? (form.metadataFetchedAt ? '资料缓存于 ' + formatDate(form.metadataFetchedAt.slice(0, 10)) : '资料已缓存') : '输入片名后点击匹配，系统会自动查找并缓存资料。'}</small></div>{form.doubanUrl && <a className="secondary-button source-open-link" href={form.doubanUrl} target="_blank" rel="noreferrer">打开豆瓣 ↗</a>}</div>
                <div className="douban-cache-grid"><span><b>上映</b>{form.releaseDate || '待补'}</span><span><b>豆瓣评分</b>{form.doubanRating || '待补'}</span><span><b>导演</b>{form.director || '待补'}</span><span><b>类型</b>{form.genres || '待补'}</span><span><b>片长</b>{form.runtimeMinutes ? form.runtimeMinutes + ' 分钟' : '待补'}</span><span><b>缓存状态</b>{form.metadataExpiresAt ? '已缓存' : '待刷新'}</span></div>
              </div>
            </div>
          </section>
          <section className="form-section">
            <p className="form-section-title">这一次观看 <span>观影事件的信息</span></p>
            <div className="form-grid two-col">
              <label className="form-field"><span>状态</span><select value={form.status} onChange={(event) => onChange('status', fieldValue(event) as Status)}><option value="watched">已观影</option><option value="planned">观影计划</option></select></label>
              <label className="form-field"><span>我的评分</span><input inputMode="decimal" value={form.myRating} onChange={(event) => onChange('myRating', fieldValue(event))} placeholder="0 - 10" /></label>
              <div className="form-field full"><span>我的观影日期 <i>watchedDate · 选填</i></span><div className="date-picker-grid"><label className="date-picker-option"><span>只记录月份</span><input type="month" aria-label="观影月份" value={monthValue} onChange={(event) => onChange('watchedDate', fieldValue(event))} /></label><label className="date-picker-option"><span>精确到日期</span><input type="date" aria-label="具体观影日期" value={dateValue} onChange={(event) => onChange('watchedDate', fieldValue(event))} /></label></div><small className="field-help">页面按观影月份分组；记不清时只选月份。</small></div>
              <label className="form-field full"><span>电影院 <i>点击箭头查看全部，也可以直接输入新影院</i></span><CinemaPicker value={form.cinemaName} cinemas={cinemas} onChange={(value) => onChange('cinemaName', value)} /></label>
              <label className="form-field"><span>影厅 <i>本次放映</i></span><input value={form.hall} onChange={(event) => onChange('hall', fieldValue(event))} placeholder="例如：IMAX GT巨幕激光厅" /></label>
              <label className="form-field"><span>座位 <i>文字记录</i></span><input value={form.seat} onChange={(event) => onChange('seat', fieldValue(event))} placeholder="例如：7排2座" /></label>
              <label className="form-field"><span>放映时间 <i>可选</i></span><input type="time" value={form.watchedTime} onChange={(event) => onChange('watchedTime', fieldValue(event))} /></label>
              <label className="form-field"><span>票务状态 <i>截图可确认时填写</i></span><select value={form.ticketStatus} onChange={(event) => onChange('ticketStatus', fieldValue(event))}><option value="">未标记</option><option value="played">已放映</option><option value="refunded">已退款</option><option value="pending">待确认</option></select></label>
              <label className="form-field"><span>观影分组 <i>可选标记</i></span><input value={form.watchGroup} onChange={(event) => onChange('watchGroup', fieldValue(event))} placeholder="例如：北影节" /></label>
              <label className="form-field"><span>观影场景</span><input value={form.scene} onChange={(event) => onChange('scene', fieldValue(event))} placeholder="例如：和朋友、资料馆" /></label>
              <label className="form-field"><span>日期备注</span><input value={form.dateNote} onChange={(event) => onChange('dateNote', fieldValue(event))} placeholder="例如：原文写作 2024.5，待确认" /></label>
              <label className="form-field"><span>票根来源 <i>可选</i></span><input value={form.ticketSource} onChange={(event) => onChange('ticketSource', fieldValue(event))} placeholder="例如：大麦" /></label>
              <label className="form-field full"><span>我的短评</span><textarea rows={3} value={form.shortReview} onChange={(event) => onChange('shortReview', fieldValue(event))} placeholder="记下当时的感受…" /></label>
            </div>
          </section>
          <p className="form-tip">电影资料由豆瓣条目和腾讯云缓存提供；你只需要填写这一次观看的信息。查询不到或有歧义时会留空，不会编造。</p>
        </div>
        <div className="modal-footer"><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" type="submit">{editing ? '保存修改' : '保存记录'} <span>→</span></button></div>
      </form>
    </div>
  </div>;
}

function DeleteConfirmModal({ confirmation, onCancel, onAdvance }: { confirmation: DeleteConfirmation; onCancel: () => void; onAdvance: () => void }) {
  const isFinal = confirmation.step === 3;
  return <div className="modal-backdrop" role="presentation"><div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="modal-header"><div><p className="eyebrow">DELETE PROTECTION · {confirmation.step}/3</p><h2 id="delete-title">{isFinal ? '最后一次确认删除' : confirmation.step === 2 ? '请再次确认' : '确认删除这条记录？'}</h2></div><button className="modal-close" type="button" onClick={onCancel} aria-label="关闭">×</button></div><div className="modal-body"><p className="delete-target">《{confirmation.title}》</p><p className="delete-warning">{confirmation.step === 1 ? '这会删除本次观影记录。误删后不能在页面中直接恢复。' : confirmation.step === 2 ? confirmation.deletesFilm ? '这是这部电影唯一的一次观影记录，继续后电影资料也会一并删除。' : '这部电影还有其他观影记录，继续后只删除本次观看，电影资料会保留。' : '删除会立即同步到腾讯云数据库。请确认你已经选择了正确的电影和观看记录。'}</p><div className="delete-steps"><span className={confirmation.step >= 1 ? 'active' : ''}>1 记录</span><i /> <span className={confirmation.step >= 2 ? 'active' : ''}>2 后果</span><i /> <span className={confirmation.step >= 3 ? 'active' : ''}>3 永久删除</span></div></div><div className="modal-footer"><button className="secondary-button" type="button" onClick={onCancel}>取消，不删除</button><button className={isFinal ? 'danger-button' : 'primary-button'} type="button" onClick={onAdvance}>{isFinal ? '确认永久删除' : '继续确认'}</button></div></div></div>;
}

function CinemaPicker({ value, cinemas, onChange }: { value: string; cinemas: Cinema[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const query = value.trim().toLocaleLowerCase();
  const options = filtering && query ? cinemas.filter((cinema) => cinema.name.toLocaleLowerCase().includes(query)) : cinemas;
  const hasExactMatch = cinemas.some((cinema) => cinema.name.trim() === value.trim());

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [open]);

  return <div className="cinema-picker" ref={pickerRef}>
    <div className="cinema-input-wrap">
      <input role="combobox" aria-label="电影院" aria-controls="cinema-options" aria-expanded={open} aria-haspopup="listbox" value={value} onFocus={() => { setOpen(true); setFiltering(false); }} onChange={(event) => { onChange(event.target.value); setOpen(true); setFiltering(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }} placeholder="例如：中国电影博物馆影厅" />
      <button className="cinema-picker-toggle" type="button" aria-label={open ? '收起电影院列表' : '打开电影院列表'} onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen((current) => !current); setFiltering(false); }}>{open ? '⌃' : '⌄'}</button>
    </div>
    {open && <div className="cinema-options" id="cinema-options" role="listbox">
      <div className="cinema-options-heading"><span>已保存的电影院</span><b>{cinemas.length}</b></div>
      {options.map((cinema) => <button className="cinema-option" type="button" role="option" aria-selected={cinema.name === value} key={cinema.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(cinema.name); setOpen(false); setFiltering(false); }}><span>{cinema.name}</span>{cinema.address && <small>{cinema.address}</small>}</button>)}
      {options.length === 0 && <div className="cinema-empty">没有匹配的已保存影院，可以直接保存当前输入。</div>}
      {value.trim() && !hasExactMatch && <button className="cinema-new-option" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen(false); setFiltering(false); }}><span>＋ 使用当前输入</span><small>{value.trim()}</small></button>}
    </div>}
  </div>;
}

function CloudAuthModal({ mode, pendingSignup, busy, form, onModeChange, onChange, onClose, onSubmit }: { mode: 'signin' | 'signup'; pendingSignup: boolean; busy: boolean; form: { identifier: string; email: string; username: string; password: string; code: string }; onModeChange: (mode: 'signin' | 'signup') => void; onChange: (key: 'identifier' | 'email' | 'username' | 'password' | 'code', value: string) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const signupStep = mode === 'signup' && pendingSignup;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><div className="modal-header"><div><p className="eyebrow">SUPABASE ACCOUNT</p><h2 id="auth-title">{mode === 'signin' ? '登录你的云端档案' : signupStep ? '输入邮箱验证码' : '创建云端账号'}</h2></div><button className="modal-close" type="button" onClick={onClose} aria-label="关闭">×</button></div><form onSubmit={onSubmit}><div className="modal-body"><p className="auth-intro">登录后，电脑和手机会读取同一个 Supabase 数据库。这里不需要填写 Supabase 管理员密码，应用账号与 Supabase 控制台账号分开。</p>{mode === 'signin' ? <div className="form-grid"><label className="form-field"><span>邮箱</span><input autoFocus required type="email" value={form.identifier} onChange={(event) => onChange('identifier', fieldValue(event))} placeholder="your@email.com" /></label><label className="form-field"><span>密码</span><input required type="password" value={form.password} onChange={(event) => onChange('password', fieldValue(event))} placeholder="你的 Supabase 应用密码" /></label></div> : signupStep ? <div className="form-grid"><label className="form-field"><span>邮箱验证码</span><input autoFocus required inputMode="numeric" value={form.code} onChange={(event) => onChange('code', fieldValue(event))} placeholder="输入邮件中的验证码" /></label><p className="form-tip">验证码已发送到 {form.email}。如果没有收到，请检查垃圾邮件。</p></div> : <div className="form-grid"><label className="form-field"><span>邮箱</span><input autoFocus required type="email" value={form.email} onChange={(event) => onChange('email', fieldValue(event))} placeholder="your@email.com" /></label><label className="form-field"><span>用户名</span><input required value={form.username} onChange={(event) => onChange('username', fieldValue(event))} placeholder="英文或数字，至少 5 位" /></label><label className="form-field"><span>密码</span><input required minLength={8} type="password" value={form.password} onChange={(event) => onChange('password', fieldValue(event))} placeholder="至少 8 位" /></label></div>}<p className="auth-security"><span>●</span> 数据按 Supabase 登录用户隔离；Publishable Key 只用于浏览器端公开初始化，不是 service_role 密钥。</p></div><div className="modal-footer"><button className="text-button auth-switch" type="button" onClick={() => onModeChange(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? '第一次使用？创建账号' : '已有账号？返回登录'}</button><button className="secondary-button" type="button" onClick={onClose}>取消</button><button className="primary-button" disabled={busy} type="submit">{busy ? '处理中…' : mode === 'signin' ? '登录并同步' : signupStep ? '完成注册' : '发送验证码'} <span>→</span></button></div></form></div></div>;
}
