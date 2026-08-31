const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DOUBAN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; PersonalMovieJournal/1.0)',
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  Referer: 'https://movie.douban.com/',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
}

async function getText(url: string, accept = 'text/html') {
  const response = await fetch(url, { headers: { ...DOUBAN_HEADERS, Accept: accept } });
  if (!response.ok) throw new Error(`资料源暂时无法访问（${response.status}）`);
  return response.text();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function getImageDataUrl(url: string) {
  if (!url) return '';
  try {
    const response = await fetch(url, { headers: { ...DOUBAN_HEADERS, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' } });
    if (!response.ok) return '';
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 400000) return '';
    const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
    return `data:${contentType};base64,${bytesToBase64(bytes)}`;
  } catch {
    return '';
  }
}

function subjectId(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

async function getSubject(idValue: string, fallback: Record<string, unknown> = {}, includePosterData = true) {
  const id = subjectId(idValue);
  if (!id) throw new Error('电影条目标识无效');
  const doubanUrl = `https://movie.douban.com/subject/${id}/`;
  const raw = await getText(`https://m.douban.com/rexxar/api/v2/subject/${id}`, 'application/json');
  let subject: Record<string, unknown>;
  try { subject = JSON.parse(raw) as Record<string, unknown>; } catch { throw new Error('电影资料返回格式异常'); }
  const title = String(subject.title || fallback.title || '').trim();
  const pic = subject.pic as Record<string, unknown> | undefined;
  const posterSource = String(pic?.normal || subject.cover_url || fallback.poster || '').trim();
  const poster = posterSource ? `${posterSource}${posterSource.includes('?') ? '&' : '?'}mirror=1` : '';
  const posterDataUrl = includePosterData ? await getImageDataUrl(poster) : '';
  const array = (key: string) => Array.isArray(subject[key]) ? subject[key] as unknown[] : [];
  const releaseDates = array('pubdate').map(String).map((value) => value.trim()).filter(Boolean);
  const directors = array('directors').map((item) => String((item as Record<string, unknown>)?.name || '').trim()).filter(Boolean);
  const cast = array('actors').map((item) => String((item as Record<string, unknown>)?.name || '').trim()).filter(Boolean).slice(0, 12);
  const genres = array('genres').map(String).map((value) => value.trim()).filter(Boolean);
  const countries = array('countries').map(String).map((value) => value.trim()).filter(Boolean);
  const languages = array('languages').map(String).map((value) => value.trim()).filter(Boolean);
  const durationValues = Array.isArray(subject.durations) ? subject.durations : subject.duration ? [subject.duration] : [];
  const runtimeMinutes = durationValues.map((value) => String(value).match(/\d+/)?.[0] || '').find(Boolean) || '';
  return {
    subjectId: id, title: title || String(fallback.title || ''), matchedTitle: title || String(fallback.title || ''), poster, posterDataUrl,
    doubanRating: String((subject.rating as Record<string, unknown> | undefined)?.value || '').trim(),
    synopsis: String(subject.intro || '').trim(), director: directors.join(' / '), cast: cast.join(' / '), genres: genres.join(' / '), countries: countries.join(' / '), languages: languages.join(' / '), runtimeMinutes, releaseDate: releaseDates.join(' / '), doubanUrl,
    sourceNote: `豆瓣：${doubanUrl}`,
  };
}

async function searchSubjects(title: string) {
  const raw = await getText(`https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(title)}`, 'application/json');
  let items: unknown[];
  try { items = JSON.parse(raw) as unknown[]; } catch { throw new Error('资料源返回格式异常'); }
  const candidates = (Array.isArray(items) ? items : []).slice(0, 8).map((item) => {
    const value = item as Record<string, unknown>;
    const id = subjectId(value.id);
    return { subjectId: id, title: String(value.title || value.sub_title || '').trim(), year: String(value.year || '').trim(), poster: String(value.img || '').trim(), doubanUrl: String(value.url || (id ? `https://movie.douban.com/subject/${id}/` : '')).trim() };
  }).filter((item) => item.subjectId && item.title);
  const enriched = [];
  for (const candidate of candidates) {
    try {
      const metadata = await getSubject(candidate.subjectId, candidate, false);
      enriched.push({ ...candidate, director: metadata.director, cast: metadata.cast, genres: metadata.genres, releaseDate: metadata.releaseDate });
    } catch {
      enriched.push(candidate);
    }
  }
  return enriched;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, error: '只支持 POST 请求' }, 405);
  try {
    const input = await request.json() as Record<string, unknown>;
    const title = String(input.title || '').trim();
    if (!title || title.length > 80) return json({ ok: false, error: '请输入 1-80 个字符的电影名' }, 400);
    if (input.action === 'poster') {
      const originalUrl = String(input.posterUrl || '').trim();
      const posterId = originalUrl.match(/\/(p\d+)\.(?:webp|jpg|jpeg|png)(?:\?.*)?$/i)?.[1] || '';
      const mirrorUrl = posterId ? `https://img3.doubanio.com/view/photo/s_ratio_poster/public/${posterId}.jpg?mirror=1` : originalUrl;
      const posterDataUrl = await getImageDataUrl(mirrorUrl);
      return posterDataUrl ? json({ ok: true, posterDataUrl }) : json({ ok: false, error: '海报图片暂时无法获取' }, 502);
    }
    if (input.action === 'detail') return json({ ok: true, metadata: await getSubject(String(input.subjectId || ''), (input.fallback || {}) as Record<string, unknown>) });
    return json({ ok: true, candidates: await searchSubjects(title) });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : '电影资料查询失败' }, 500);
  }
});
