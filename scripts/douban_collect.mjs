import fs from 'node:fs';

const proxyBase = 'http://localhost:3456';
const inputPath = new URL('../movie-import-2024-2026.json', import.meta.url);
const outputPath = new URL('../douban-metadata.json', import.meta.url);
const titles = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
  .map((item) => item.title)
  .filter((title, index, all) => all.indexOf(title) === index);

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const [key, value] = process.argv[index].split('=');
  args.set(key.replace(/^--/, ''), value);
}
const start = Number(args.get('start') || 0);
const limit = Number(args.get('limit') || titles.length);
const pauseMs = Number(args.get('pause') || 900);
const onlyTitles = args.get('only') ? args.get('only').split('|').filter(Boolean) : null;

const manualSubjects = {
  '毒液3': 'https://movie.douban.com/subject/35087675/',
  '因果报应': 'https://movie.douban.com/subject/36934908/',
  '＂骗骗＂喜欢你': 'https://movie.douban.com/subject/36838707/',
  '床前明月＂咣＂': 'https://movie.douban.com/subject/36822783/',
  '封神第二部：战火西歧': 'https://movie.douban.com/subject/30181250/',
  '唐探1990': 'https://movie.douban.com/subject/36282639/',
  '还有明天': 'https://movie.douban.com/subject/36445098/',
  '白雪公主': 'https://movie.douban.com/subject/26908303/',
  '孤独的美食家': 'https://movie.douban.com/subject/36959346/',
  '雷霆特工队': 'https://movie.douban.com/subject/35927475/',
  '七宗罪': 'https://movie.douban.com/subject/1292223/',
  '水饺皇后': 'https://movie.douban.com/subject/33414470/',
  '猎金•游戏': 'https://movie.douban.com/subject/35929258/',
  '情书': 'https://movie.douban.com/subject/1292220/',
  '星际宝贝史迪奇': 'https://movie.douban.com/subject/30345743/',
  '天空之城': 'https://movie.douban.com/subject/1291583/',
  '新 ·驯龙高手': 'https://movie.douban.com/subject/36247731/',
  '恶意': 'https://movie.douban.com/subject/36809947/',
  '超人': 'https://movie.douban.com/subject/36188176/',
  '轻如鸿毛': 'https://movie.douban.com/subject/36782374/',
  '风林火山': 'https://movie.douban.com/subject/26351864/',
  '毕证明的证明': 'https://movie.douban.com/subject/36402017/',
  '赛德克·巴莱（上）': 'https://movie.douban.com/subject/10450409/',
  '赛德克·巴莱（下）': 'https://movie.douban.com/subject/6393127/',
  '阿凡达3': 'https://movie.douban.com/subject/5348089/',
  '寻秦记': 'https://movie.douban.com/subject/26389539/',
  '喜欢上"欠欠"的你': 'https://movie.douban.com/subject/36054516/',
  '夜王': 'https://movie.douban.com/subject/37375594/',
  '呼啸山庄': 'https://movie.douban.com/subject/36963690/',
  '密探': 'https://movie.douban.com/subject/37013352/',
  '再见，茱莉亚': 'https://movie.douban.com/subject/36070920/',
  '新蟒蛇之灾': 'https://movie.douban.com/subject/37014022/',
  '飞行家': 'https://movie.douban.com/subject/35700339/',
  '闪灵': 'https://movie.douban.com/subject/1292225/',
  '火遮眼': 'https://movie.douban.com/subject/36877245/',
  '小气鬼': 'https://movie.douban.com/subject/37457160/',
  '超级少女': 'https://movie.douban.com/subject/36225840/',
  '后室': 'https://movie.douban.com/subject/36235977/',
  '群星闪耀时': 'https://movie.douban.com/subject/35875462/',
  '茶馆': 'https://movie.douban.com/subject/1461403/',
  '奥德赛': 'https://movie.douban.com/subject/36808876/',
  '长安的荔枝': 'https://movie.douban.com/subject/36185502/',
  '神奇四侠：初露锋芒': 'https://movie.douban.com/subject/34825559/'
};

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function request(path, init = {}) {
  const response = await fetch(`${proxyBase}${path}`, init);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload;
}

async function createTarget(url) {
  const payload = await request('/new', { method: 'POST', body: url });
  return payload.targetId;
}

async function navigate(target, url) {
  await request(`/navigate?target=${encodeURIComponent(target)}`, { method: 'POST', body: url });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const info = await request(`/info?target=${encodeURIComponent(target)}`);
    const blocked = String(info.url || '').includes('sec.douban.com');
    if (info.ready === 'complete' && info.url && info.url !== 'about:blank' && !blocked) break;
    await sleep(500);
  }
  await sleep(500);
}

async function evaluate(target, code) {
  const payload = await request(`/eval?target=${encodeURIComponent(target)}`, { method: 'POST', body: code });
  return payload.value;
}

function cleanTitle(value) {
  return String(value || '')
    .replace(/\u200e/g, '')
    .replace(/\s*\(\d{4}\)\s*$/, '')
    .replace(/[‎]/g, '')
    .trim();
}

function baseTitle(value) {
  return cleanTitle(value).split(/\s+/)[0].trim();
}

function looseTitle(value) {
  return baseTitle(value)
    .toLowerCase()
    .replace(/[：:·・,，。！!？?、\-—_\s]/g, '');
}

function chooseCandidate(title, candidates) {
  const exact = candidates.filter((item) => cleanTitle(item.title) === title);
  if (exact.length === 1) return { ...exact[0], match: 'exact' };
  const base = candidates.filter((item) => baseTitle(item.title) === title);
  if (base.length === 1) return { ...base[0], match: 'base' };
  const loose = candidates.filter((item) => looseTitle(item.title) === looseTitle(title));
  if (loose.length === 1) return { ...loose[0], match: 'loose' };
  return { match: 'ambiguous', candidates: candidates.slice(0, 5) };
}

async function search(target, title) {
  if (manualSubjects[title]) return { title, href: manualSubjects[title], match: 'manual' };
  const url = `https://movie.douban.com/j/subject_suggest?q=${encodeURIComponent(title)}`;
  await navigate(target, url);
  const raw = await evaluate(target, `document.body.innerText.split('\\n闪记')[0].trim()`);
  let candidates = [];
  try {
    candidates = JSON.parse(raw || '[]').map((item) => ({
      title: item.title || item.sub_title || '',
      href: item.url || `https://movie.douban.com/subject/${item.id}/`,
      text: `${item.title || ''} ${item.year || ''}`,
      poster: item.img || '',
      year: item.year || ''
    }));
  } catch { candidates = []; }
  return chooseCandidate(title, candidates);
}

async function detail(target, title, candidate) {
  await navigate(target, candidate.href);
  const raw = await evaluate(target, `JSON.stringify((() => {
    const text = (selector) => document.querySelector(selector)?.innerText?.trim() || '';
    const texts = (selector) => [...document.querySelectorAll(selector)].map((item) => item.innerText.trim()).filter(Boolean);
    const attrs = (selector, attr) => [...document.querySelectorAll(selector)].map((item) => item.getAttribute(attr) || '').filter(Boolean);
    const releaseDates = texts('[property="v:initialReleaseDate"]');
    return {
      title: text('#content h1'),
      poster: document.querySelector('#mainpic img')?.getAttribute('src') || document.querySelector('#mainpic img')?.getAttribute('data-src') || '',
      doubanRating: text('strong[property="v:average"]'),
      synopsis: text('span[property="v:summary"]'),
      director: texts('a[rel="v:directedBy"]').join(' / '),
      cast: texts('a[rel="v:starring"]').slice(0, 12).join(' / '),
      genres: texts('span[property="v:genre"]').join(' / '),
      releaseDate: releaseDates.join(' / '),
      releaseDates,
      doubanUrl: location.href,
      pageTitle: document.title,
      infoText: text('#info'),
      images: attrs('#mainpic img', 'src')
    };
  })())`);
  let data = {};
  try { data = JSON.parse(raw || '{}'); } catch { data = {}; }
  const actualTitle = cleanTitle(data.title);
  return {
    title,
    matchedTitle: actualTitle,
    match: candidate.match,
    doubanUrl: data.doubanUrl || candidate.href,
    poster: data.poster || '',
    doubanRating: data.doubanRating || '',
    synopsis: data.synopsis || '',
    director: data.director || '',
    cast: data.cast || '',
    genres: data.genres || '',
    releaseDate: data.releaseDate || '',
      status: actualTitle && (looseTitle(actualTitle) === looseTitle(title) || baseTitle(actualTitle) === title || candidate.match === 'exact' || candidate.match === 'manual') ? 'matched' : '待确认',
    note: candidate.match === 'manual' && actualTitle && actualTitle !== title ? `清单标题与豆瓣条目标题不同：豆瓣为“${actualTitle}”` : (actualTitle && (looseTitle(actualTitle) === looseTitle(title) || baseTitle(actualTitle) === title) ? '' : '豆瓣搜索结果标题与清单标题存在差异，待确认')
  };
}

const existing = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, 'utf8')) : {};
const target = await createTarget('https://movie.douban.com/');
const workTitles = onlyTitles ? titles.filter((title) => onlyTitles.includes(title)) : titles;
console.log(`开始处理 ${start + 1}-${Math.min(start + limit, workTitles.length)} / ${workTitles.length}，target=${target}`);

try {
  for (let index = start; index < Math.min(start + limit, workTitles.length); index += 1) {
    const title = workTitles[index];
    const record = { title, status: '待确认', note: '豆瓣未找到可确认的同名条目' };
    try {
      const candidate = await search(target, title);
      if (candidate.match !== 'ambiguous') {
        Object.assign(record, await detail(target, title, candidate));
      } else {
        record.status = '待确认';
        record.candidates = candidate.candidates;
      }
    } catch (error) {
      record.status = '待确认';
      record.note = `豆瓣读取失败：${error instanceof Error ? error.message : String(error)}`;
    }
    existing[title] = record;
    fs.writeFileSync(outputPath, `${JSON.stringify(existing, null, 2)}\n`);
    const filled = ['doubanRating', 'poster', 'releaseDate', 'synopsis', 'director', 'cast', 'genres'].filter((field) => record[field]).length;
    console.log(`${index + 1}/${workTitles.length} ${title} -> ${record.status}, fields=${filled}`);
    await sleep(pauseMs);
  }
} finally {
  await request(`/close?target=${encodeURIComponent(target)}`).catch(() => {});
}

console.log(`已写入 ${outputPath.pathname}`);
