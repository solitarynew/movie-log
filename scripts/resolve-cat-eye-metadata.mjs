import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const input = JSON.parse(fs.readFileSync(new URL('./cat-eye-rating-import.json', import.meta.url), 'utf8'));
const envId = 'movie-d6g34ruu2ef5b97fe';
const ownerId = input.ownerId;

function runTcb(sql) {
  const output = execFileSync('tcb', ['db', 'execute', '-e', envId, '--json', '--sql', sql], { encoding: 'utf8' });
  const start = output.indexOf('{');
  if (start < 0) throw new Error(`CloudBase returned no JSON: ${output}`);
  const payload = JSON.parse(output.slice(start));
  if (payload.error) throw new Error(payload.error.message || 'CloudBase query failed');
  return payload;
}

function sql(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`;
}

function normalize(value) {
  return String(value || '')
    .replaceAll('“', '"').replaceAll('”', '"').replaceAll('＂', '"')
    .replaceAll('·', '•').replaceAll('．', '.')
    .replaceAll(' ', '').trim().toLowerCase();
}

function invokeMovieSearch(data) {
  const output = execFileSync('tcb', [
    'fn', 'invoke', 'movie-search', '--env-id', envId, '--json', '-d', JSON.stringify(data),
  ], { encoding: 'utf8' });
  const payload = JSON.parse(output.slice(output.indexOf('{')));
  const retMsg = payload?.data?.RetMsg || '';
  const result = typeof retMsg === 'string' ? JSON.parse(retMsg) : retMsg;
  if (!result?.ok) throw new Error(result?.error || '电影资料查询失败');
  return result;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function yearOfDate(value) {
  return String(value || '').match(/(19|20)\d{2}/)?.[0] || '';
}

const preferredYears = {
  '美人鱼': '2016',
  '惊奇队长': '2019',
  '阿凡达': '2009',
  '拆弹专家': '2017',
  '拆弹专家2': '2020',
  '爱情公寓': '2018',
  '飞驰人生': '2019',
  '哥斯拉大战金刚': '2021',
  '误杀': '2019',
  '年会不能停！': '2023',
  '万万没想到': '2015',
  '恶棍天使': '2015',
  '煎饼侠': '2015',
  '港囧': '2015',
};

const aliasTitles = {
  '熊出没·伴我"熊芯"': ['熊出没·伴我“熊芯”'],
};

const existingSql = `SELECT title FROM public.movie_films WHERE owner_id=${sql(ownerId)}`;
const existingPayload = runTcb(existingSql);
const existingTitles = new Set((existingPayload.data?.Rows || []).map((row) => JSON.parse(row)[0]));
const missing = input.records.filter((record) => !existingTitles.has(record.title));
const resolved = [];
const pending = [];

for (const [index, record] of missing.entries()) {
  const requested = record.title;
  const queryTitles = [requested, ...(aliasTitles[requested] || [])];
  let candidates = [];
  try {
    for (const queryTitle of queryTitles) {
      let result = invokeMovieSearch({ action: 'search', title: queryTitle });
      if (!result.candidates?.length) {
        await sleep(2200);
        result = invokeMovieSearch({ action: 'search', title: queryTitle });
      }
      candidates = [...candidates, ...(Array.isArray(result.candidates) ? result.candidates : [])];
    }
  } catch (error) {
    pending.push({ ...record, reason: `豆瓣搜索失败：${error instanceof Error ? error.message : String(error)}`, candidates: [] });
    continue;
  }
  const seen = new Set();
  candidates = candidates.filter((item) => {
    const id = String(item.id || '').replace(/\D/g, '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const exact = candidates.filter((candidate) => normalize(candidate.title) === normalize(requested));
  const preferredYear = preferredYears[requested];
  const yearFiltered = preferredYear ? exact.filter((candidate) => String(candidate.year || '') === preferredYear) : exact;
  const shortlist = preferredYear ? yearFiltered : exact;
  if (shortlist.length !== 1) {
    pending.push({
      ...record,
      reason: shortlist.length === 0 ? '没有唯一的同名豆瓣条目' : '同名豆瓣条目超过一个，未擅自选择',
      candidates: (shortlist.length ? shortlist : exact.length ? exact : candidates.slice(0, 8)).map((candidate) => ({
        subjectId: String(candidate.id || '').replace(/\D/g, ''),
        title: String(candidate.title || ''),
        year: String(candidate.year || ''),
      })),
    });
    await sleep(2500);
    continue;
  }
  const candidate = shortlist[0];
  const subjectId = String(candidate.id || '').replace(/\D/g, '');
  try {
    const detailResult = invokeMovieSearch({ action: 'detail', title: requested, subjectId, fallback: candidate });
    const subject = detailResult.metadata || {};
      const releaseDate = String(subject.releaseDate || '').trim();
    const releaseYearMonth = releaseDate.match(/(19|20)\d{2}-\d{2}/)?.[0] || '';
    if (!releaseYearMonth) {
      pending.push({ ...record, reason: '豆瓣条目没有可解析的上映年月', candidates: [{ subjectId, title: candidate.title, year: candidate.year }] });
    } else {
      const posterSource = String(subject.poster || candidate.poster || '').trim();
      const poster = posterSource ? `${posterSource}${posterSource.includes('?') ? '&' : '?'}mirror=1` : '';
      const directors = String(subject.director || '').split(' / ').filter(Boolean);
      const actors = String(subject.cast || '').split(' / ').filter(Boolean).slice(0, 12);
      const genres = String(subject.genres || '').split(' / ').filter(Boolean);
      const countries = String(subject.countries || '').split(' / ').filter(Boolean);
      const languages = String(subject.languages || '').split(' / ').filter(Boolean);
      const runtimeMinutes = String(subject.runtimeMinutes || '');
      resolved.push({
        title: requested,
        rating: record.rating,
        watchedDate: releaseYearMonth,
        releaseDate,
        subjectId,
        matchedTitle: String(subject.matchedTitle || subject.title || candidate.title || requested),
        poster,
        doubanUrl: `https://movie.douban.com/subject/${subjectId}/`,
        doubanRating: String(subject.doubanRating || '').trim(),
        synopsis: String(subject.synopsis || '').trim(),
        director: directors.join(' / '),
        cast: actors.join(' / '),
        genres: genres.join(' / '),
        countries: countries.join(' / '),
        languages: languages.join(' / '),
        runtimeMinutes,
        dateNote: '猫眼评分截图导入；观影月份未知，暂按上映日期月份归档',
        sourceNote: `猫眼评分截图导入；豆瓣资料：${`https://movie.douban.com/subject/${subjectId}/`}`,
      });
    }
  } catch (error) {
    pending.push({ ...record, reason: `豆瓣详情读取失败：${error instanceof Error ? error.message : String(error)}`, candidates: [{ subjectId, title: candidate.title, year: candidate.year }] });
  }
  if ((index + 1) % 10 === 0) console.log(`resolved ${index + 1}/${missing.length}`);
  await sleep(2200);
}

fs.writeFileSync(new URL('./cat-eye-resolved.json', import.meta.url), JSON.stringify({ ownerId, source: `${input.source}（${input.capturedAt}）`, resolved, pending }, null, 2));
console.log(JSON.stringify({ existing: existingTitles.size, input: input.records.length, missing: missing.length, resolved: resolved.length, pending: pending.length, pendingTitles: pending.map((item) => item.title) }, null, 2));
