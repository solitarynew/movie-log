import fs from 'node:fs';
import crypto from 'node:crypto';

const base = JSON.parse(fs.readFileSync(new URL('../movie-import-2024-2026.json', import.meta.url), 'utf8'));
const douban = JSON.parse(fs.readFileSync(new URL('../douban-metadata.json', import.meta.url), 'utf8'));
const catEye = JSON.parse(fs.readFileSync(new URL('./cat-eye-rating-import.json', import.meta.url), 'utf8')).records;
const catEyeManual = JSON.parse(fs.readFileSync(new URL('./cat-eye-new-manual.json', import.meta.url), 'utf8')).records;
const tickets = JSON.parse(fs.readFileSync(new URL('./ticket-ocr-import.json', import.meta.url), 'utf8')).records;

const timestamp = '2026-08-31T00:00:00.000Z';
const expiry = '2026-09-30T00:00:00.000Z';
const hash = (value) => crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
const subjectId = (value) => String(value || '').match(/\/subject\/(\d+)/)?.[1] || '';
const filmMap = new Map();
const events = [];
const cinemas = new Map();

function metadataFor(title, fallback = {}) {
  const item = douban[title] || {};
  const matched = item.status === 'matched';
  return {
    title,
    doubanSubjectId: item.subjectId || subjectId(item.doubanUrl),
    doubanUrl: item.doubanUrl || '',
    metadataFetchedAt: matched ? timestamp : '',
    metadataExpiresAt: matched ? expiry : '',
    poster: item.poster || '',
    releaseDate: item.releaseDate || fallback.releaseDate || '',
    doubanRating: item.doubanRating || '',
    synopsis: item.synopsis || '',
    director: item.director || '',
    cast: item.cast || '',
    genres: item.genres || '',
    countries: item.countries || '',
    languages: item.languages || '',
    runtimeMinutes: item.runtimeMinutes || '',
    sourceNote: matched ? `豆瓣资料缓存；原始清单标题：${title}` : `资料待确认${item.note ? `：${item.note}` : ''}`,
  };
}

function ensureFilm(title, fallback = {}) {
  if (!filmMap.has(title)) {
    const metadata = metadataFor(title, fallback);
    filmMap.set(title, {
      id: `film-recovery-${hash(title)}`,
      ...metadata,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }
  return filmMap.get(title);
}

function blankEvent(id, film, watchedDate = '', extra = {}) {
  return {
    id,
    filmId: film.id,
    watchedDate,
    watchGroup: '',
    status: 'watched',
    myRating: '',
    shortReview: '',
    scene: '',
    dateNote: '',
    cinemaId: '',
    hall: '',
    seat: '',
    watchedTime: '',
    ticketStatus: '',
    ticketSource: '',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...extra,
  };
}

for (const [index, item] of base.entries()) {
  const film = ensureFilm(item.title);
  events.push(blankEvent(`event-recovery-${String(index + 1).padStart(3, '0')}`, film, item.watchedDate || '', {
    watchGroup: item.watchGroup || '',
    status: item.status === 'planned' ? 'planned' : 'watched',
    dateNote: item.dateNote || '',
  }));
}

const ratings = new Map(catEye.map((item) => [item.title, item.rating]));

for (const [index, item] of catEyeManual.entries()) {
  const film = ensureFilm(item.title, { releaseDate: item.releaseDate || '' });
  events.push(blankEvent(`event-cat-eye-${hash(item.title)}`, film, item.releaseDate || '', {
    myRating: item.rating || '',
    dateNote: '猫眼评分导入；没有观影月份，暂按上映日期月份归档',
    ticketSource: '猫眼评分截图导入（OCR/人工复核）',
  }));
}

const unresolvedCatEye = catEye.find((item) => item.title === '大将军师' && !catEyeManual.some((manual) => manual.title === item.title));
if (unresolvedCatEye) {
  const film = ensureFilm(unresolvedCatEye.title);
  events.push(blankEvent(`event-cat-eye-${hash(unresolvedCatEye.title)}`, film, '', {
    myRating: unresolvedCatEye.rating || '',
    dateNote: '猫眼评分导入；上映日期和观影月份待确认',
    ticketSource: '猫眼评分截图导入（OCR/人工复核）',
  }));
}

function ensureCinema(name) {
  if (!name) return '';
  if (!cinemas.has(name)) cinemas.set(name, {
    id: `cinema-recovery-${hash(name)}`,
    name,
    address: '',
    sourceNote: '由大麦票根截图导入；影院作为独立资料保存',
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return cinemas.get(name).id;
}

for (const ticket of tickets) {
  const matches = events.filter((event) => event.filmId === ensureFilm(ticket.title).id && event.watchedDate.startsWith(ticket.month) && (event.watchGroup || '') === (ticket.watchGroup || ''));
  const event = matches[0];
  if (!event) continue;
  event.watchedDate = ticket.date || event.watchedDate;
  event.watchedTime = ticket.time || '';
  event.cinemaId = ensureCinema(ticket.cinema || '');
  event.hall = ticket.hall || '';
  event.seat = ticket.seat || '';
  event.ticketStatus = ticket.status || '';
  event.ticketSource = '大麦电影票订单截图（OCR/人工复核）';
  event.dateNote = ticket.note || event.dateNote;
  event.updatedAt = timestamp;
}

for (const event of events) {
  const title = [...filmMap.keys()].find((key) => filmMap.get(key).id === event.filmId);
  const rating = ratings.get(title);
  if (rating && !event.myRating) event.myRating = rating;
}

const output = { films: [...filmMap.values()], events, cinemas: [...cinemas.values()] };
const outputPath = new URL('../movie-recovery-import.json', import.meta.url);
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ films: output.films.length, events: output.events.length, cinemas: output.cinemas.length, output: outputPath.pathname }, null, 2));
