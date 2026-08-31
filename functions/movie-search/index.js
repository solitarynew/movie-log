const DOUBAN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; PersonalMovieJournal/1.0)',
  Accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
  Referer: 'https://movie.douban.com/',
};

function inputOf(event) {
  if (typeof event === 'string') {
    try { return JSON.parse(event); } catch { return {}; }
  }
  if (event && typeof event === 'object' && event.data && typeof event.data === 'object') return event.data;
  return event || {};
}

async function getText(url, accept = 'text/html') {
  const response = await fetch(url, { headers: { ...DOUBAN_HEADERS, Accept: accept } });
  if (!response.ok) throw new Error(`资料源暂时无法访问（${response.status}）`);
  return response.text();
}

async function getImageDataUrl(url) {
  if (!url) return '';
  try {
    const response = await fetch(url, { headers: { ...DOUBAN_HEADERS, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' } });
    if (!response.ok) return '';
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > 400000) return '';
    return `data:${contentType.split(';')[0]};base64,${bytes.toString('base64')}`;
  } catch {
    return '';
  }
}

async function searchSubjects(title) {
  const raw = await getText(`https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(title)}`, 'application/json');
  let items;
  try { items = JSON.parse(raw); } catch { throw new Error('资料源返回格式异常'); }
  const candidates = (Array.isArray(items) ? items : []).slice(0, 8).map((item) => ({
    subjectId: String(item.id || '').replace(/\D/g, ''),
    title: String(item.title || item.sub_title || '').trim(),
    year: String(item.year || '').trim(),
    poster: String(item.img || '').trim(),
    doubanUrl: String(item.url || (item.id ? `https://movie.douban.com/subject/${item.id}/` : '')).trim(),
  })).filter((item) => item.subjectId && item.title);
  const enriched = [];
  for (const candidate of candidates) {
    try {
      const metadata = await getSubject(candidate.subjectId, candidate, { includePosterData: false });
      enriched.push({
        ...candidate,
        director: metadata.director,
        cast: metadata.cast,
        genres: metadata.genres,
        releaseDate: metadata.releaseDate,
      });
    } catch {
      enriched.push(candidate);
    }
  }
  return enriched;
}

async function getSubject(subjectId, fallback, options = {}) {
  const id = String(subjectId || '').replace(/\D/g, '');
  if (!id) throw new Error('电影条目标识无效');
  const doubanUrl = `https://movie.douban.com/subject/${id}/`;
  const raw = await getText(`https://m.douban.com/rexxar/api/v2/subject/${id}`, 'application/json');
  let subject;
  try { subject = JSON.parse(raw); } catch { throw new Error('电影资料返回格式异常'); }
  const title = String(subject.title || fallback?.title || '').trim();
  const posterSource = String(subject?.pic?.normal || subject.cover_url || fallback?.poster || '').trim();
  const poster = posterSource ? `${posterSource}${posterSource.includes('?') ? '&' : '?'}mirror=1` : '';
  const posterDataUrl = options.includePosterData === false ? '' : await getImageDataUrl(poster);
  const releaseDates = Array.isArray(subject.pubdate) ? subject.pubdate.map((value) => String(value).trim()).filter(Boolean) : [];
  const directors = Array.isArray(subject.directors) ? subject.directors.map((item) => String(item?.name || '').trim()).filter(Boolean) : [];
  const cast = Array.isArray(subject.actors) ? subject.actors.map((item) => String(item?.name || '').trim()).filter(Boolean).slice(0, 12) : [];
  const genres = Array.isArray(subject.genres) ? subject.genres.map((value) => String(value).trim()).filter(Boolean) : [];
  const countries = Array.isArray(subject.countries) ? subject.countries.map((value) => String(value).trim()).filter(Boolean) : [];
  const languages = Array.isArray(subject.languages) ? subject.languages.map((value) => String(value).trim()).filter(Boolean) : [];
  const durationValues = Array.isArray(subject.durations) ? subject.durations : subject.duration ? [subject.duration] : [];
  const runtimeMinutes = durationValues.map((value) => String(value).match(/\d+/)?.[0] || '').find(Boolean) || '';
  const synopsis = String(subject.intro || '').trim();
  const doubanRating = String(subject?.rating?.value || '').trim();
  return {
    subjectId: id,
    title: title || fallback?.title || '',
    matchedTitle: title || fallback?.title || '',
    poster,
    posterDataUrl,
    doubanRating,
    synopsis,
    director: directors.join(' / '),
    cast: cast.join(' / '),
    genres: genres.join(' / '),
    countries: countries.join(' / '),
    languages: languages.join(' / '),
    runtimeMinutes,
    releaseDate: releaseDates.join(' / '),
    doubanUrl,
    sourceNote: `豆瓣：${doubanUrl}`,
  };
}

exports.main = async (event) => {
  const input = inputOf(event);
  const title = String(input.title || '').trim();
  if (!title || title.length > 80) return { ok: false, error: '请输入 1-80 个字符的电影名' };
  try {
    if (input.action === 'poster') {
      const originalUrl = String(input.posterUrl || '').trim();
      const posterId = originalUrl.match(/\/(p\d+)\.(?:webp|jpg|jpeg|png)(?:\?.*)?$/i)?.[1] || '';
      const mirrorUrl = posterId ? `https://img3.doubanio.com/view/photo/s_ratio_poster/public/${posterId}.jpg?mirror=1` : originalUrl;
      const posterDataUrl = await getImageDataUrl(mirrorUrl);
      return posterDataUrl ? { ok: true, posterDataUrl } : { ok: false, error: '海报图片暂时无法获取' };
    }
    if (input.action === 'detail') {
      return { ok: true, metadata: await getSubject(input.subjectId, input.fallback) };
    }
    return { ok: true, candidates: await searchSubjects(title) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '电影资料查询失败' };
  }
};
