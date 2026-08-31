import type { DoubanMetadata } from './cloudbase';

// The 11 ambiguous titles were manually confirmed by the owner of this archive.
// Keep the original list title as the key so the migration can update the
// existing film row without creating a second film or losing its watch event.
export const CONFIRMED_METADATA_VERSION = '2026-08-24-confirmed-v1';

export const confirmedDoubanMetadata: DoubanMetadata = {
  '攻壳机动队': {
    title: '攻壳机动队', status: 'matched', doubanUrl: 'https://movie.douban.com/subject/1291936/',
    poster: 'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2921045013.webp', doubanRating: '9.1',
    releaseDate: '1995-11-18(日本)', director: '押井守',
    cast: '田中敦子 / 大塚明夫 / 山寺宏一 / 大木民夫 / 家弓家正 / 玄田哲章 / 山内雅人 / 小川真司',
    genres: '动作 / 科幻 / 动画',
    synopsis: '公元2029年，未来世界是高科技与信息化的世界。人类生活水平的提高伴随着犯罪活动的高科技化，于是，专门镇压高科技犯罪的特殊部队——公安9课成立了。队长草薙素子作为一名全身“义体化”的女警，带领公安9课卷入了传说中的黑客“傀儡师”事件。',
  },
  '小王子': {
    title: '小王子', status: 'matched', doubanUrl: 'https://movie.douban.com/subject/20645098/',
    poster: 'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2922618792.webp', doubanRating: '8.3',
    releaseDate: '2015-10-16(中国大陆) / 2015-07-29(法国)', director: '马克·奥斯本',
    cast: '杰夫·布里吉斯 / 麦肯吉·弗依 / 瑞秋·麦克亚当斯 / 瑞利·奥斯本 / 詹姆斯·弗兰科 / 玛丽昂·歌迪亚 / 本尼西奥·德尔·托罗 / 保罗·路德 / 保罗·吉亚玛提 / 黄忆慈 / 易烊千玺 / 袁泉 / 黄渤',
    genres: '动画 / 奇幻 / 冒险',
    synopsis: '住在都市中的小女孩与老飞行员成为朋友，飞行员向她讲述自己在撒哈拉沙漠遇见小王子的故事。影片以定格动画重现原著，并用新的小女孩故事串联起这段童话。',
  },
  '奇遇': {
    title: '奇遇', status: 'matched', doubanUrl: 'https://movie.douban.com/subject/36522427/',
    poster: 'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2920978322.webp', doubanRating: '7.1',
    releaseDate: '2025-08-08(中国大陆)', director: '马多',
    cast: '贾冰 / 王皓 / 李梦 / 郑合惠子 / 杨皓宇 / 翟子路 / 于洋 / 费启鸣 / 李乃文 / 马旭东 / 邓帅 / 李治良 / 冯满 / 郝瀚 / 李飞 / 小沈阳',
    genres: '喜剧',
    synopsis: '43岁的中年社畜黄遇奇与18岁的自己因一次意外发生灵魂互换。两个不同年龄的自己在错位的人生中重新面对家庭、事业和梦想，经历了一连串啼笑皆非的故事。',
  },
  '女孩': {
    title: '女孩', status: 'matched', doubanUrl: 'https://movie.douban.com/subject/36986482/',
    poster: 'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2926252007.webp', doubanRating: '7.2',
    releaseDate: '2025-11-01(中国大陆) / 2025-10-31(中国台湾) / 2025-09-04(威尼斯电影节)', director: '舒淇',
    cast: '邱泽 / 汤毓绮 / 白小樱 / 林品彤 / 赖雨霏 / 刘品言 / 陈竹升 / 曾珮瑜 / 梁正群 / 谢琼煖 / 黄镫辉 / 刘冠廷',
    genres: '剧情',
    synopsis: '1988年，基隆港烟尘蔽日，林小丽在迷惘中长大，渴望逃离家庭的黑暗。直到遇见无惧眼光、自在生活的李莉莉，她第一次看见世界的色彩；女孩与女人，在交错的命运中互相映照。',
  },
  '鹿鼎记': {
    title: '鹿鼎记', status: 'matched', doubanUrl: 'https://movie.douban.com/subject/1297223/',
    poster: 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2927572266.webp', doubanRating: '8.3',
    releaseDate: '1992-07-30(中国香港)', director: '王晶 / 程小东',
    cast: '周星驰 / 吴孟达 / 张敏 / 吴君如 / 邱淑贞 / 刘松仁 / 陈百祥 / 温兆伦 / 徐锦江 / 林青霞 / 陈德容 / 袁洁莹',
    genres: '喜剧 / 动作 / 武侠 / 古装',
    synopsis: '市井小混混韦小宝偶然卷入江湖纷争，被天地会带入宫中执行任务，阴差阳错成为康熙身边的红人，并在天地会、皇宫和各方势力之间周旋。',
  },
  '控方证人': {
    title: '控方证人', status: 'matched', doubanUrl: 'https://movie.douban.com/subject/1296141/',
    poster: 'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2927451337.webp', doubanRating: '9.6',
    releaseDate: '1957-12-17(美国)', director: '比利·怀尔德',
    cast: '泰隆·鲍华 / 玛琳·黛德丽 / 查尔斯·劳顿 / 埃尔莎·兰彻斯特 / 约翰·威廉姆斯 / 亨利·丹尼尔 / 伊安·沃尔夫',
    genres: '剧情 / 悬疑 / 惊悚 / 犯罪',
    synopsis: '伦敦著名刑案辩护律师韦菲爵士接受一宗富婆遇害案，为被控谋杀的沃尔辩护。沃尔唯一的重要证人是他的妻子克里斯汀，但她的证词和态度让案件不断出现新的疑点。影片改编自阿加莎·克里斯蒂作品。',
  },
  '纵横四海': {
    title: '纵横四海', status: 'matched', doubanUrl: 'https://movie.douban.com/subject/1295409/',
    poster: 'https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2931740648.webp', doubanRating: '8.8',
    releaseDate: '1991-02-02(中国香港)', director: '吴宇森',
    cast: '周润发 / 张国荣 / 钟楚红 / 朱江 / 曾江 / 胡枫 / 唐宁 / 邓一君',
    genres: '剧情 / 喜剧 / 动作',
    synopsis: '砵仔糕、阿占和红豆从小一起长大，在养父栽培下成为国际大盗。一次艺术品盗窃行动后，三人遭到陷害并失散多年，重逢后再次卷入危险的盗画计划。',
  },
  '记忆碎片': {
    title: '记忆碎片', status: 'matched', doubanUrl: 'https://movie.douban.com/subject/1304447/',
    poster: 'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p2931989223.webp', doubanRating: '8.7',
    releaseDate: '2000-09-05(威尼斯电影节) / 2000-10-20(英国) / 2001-05-25(美国)', director: '克里斯托弗·诺兰',
    cast: '盖·皮尔斯 / 凯瑞-安·莫斯 / 乔·潘托里亚诺 / 小马克·布恩 / 乔雅·福克斯 / 斯蒂芬·托布罗斯基 / 哈里特·桑塞姆·哈里斯',
    genres: '剧情 / 悬疑 / 惊悚 / 犯罪',
    synopsis: '患有短期记忆障碍的伦纳德用拍立得照片、纹身和笔记追查杀害妻子的凶手。影片用交错、非线性的叙事，让观众与主人公一起拼接被打碎的真相。',
  },
  '哈姆雷特': {
    title: '哈姆雷特', status: 'matched', doubanUrl: 'https://movie.douban.com/subject/26588017/',
    poster: 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2933721596.webp', doubanRating: '',
    releaseDate: '2015-10-15(英国国家剧院现场)', director: '林赛·特纳 / Robin Lough',
    cast: '本尼迪克特·康伯巴奇 / 塞伦·希德 / 希安·布鲁克 / 吉姆·诺顿 / 里奥·比尔 / 卡尔·约翰逊',
    genres: '剧情 / 戏剧 / 舞台录像',
    synopsis: '国家剧院现场录制的莎士比亚悲剧。丹麦王子哈姆雷特得知父亲被杀、母亲改嫁叔父后，开始在复仇、道德和国家危机之间挣扎。',
  },
  '痴迷': {
    title: '痴迷', status: 'matched', doubanUrl: 'https://movie.douban.com/subject/37450627/',
    poster: 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2934049524.webp', doubanRating: '7.7',
    releaseDate: '2025-09-05(多伦多电影节) / 2026-05-15(美国) / 2026-07(中国大陆)', director: '库里·巴克',
    cast: '迈克尔·约翰斯顿 / 印达·纳瓦雷特 / Cooper Tomlinson / 梅根·劳利斯',
    genres: '恐怖',
    synopsis: '一个看似普通的愿望逐渐变成无法摆脱的恐怖执念，人物在欲望、爱情与超自然力量之间失控。',
    note: '公开简介较简略。',
  },
  '杀死比尔：血色前传': {
    title: '杀死比尔：血色全传', matchedTitle: '杀死比尔：血色全传', status: 'matched',
    doubanUrl: 'https://www.lionsgate.com/movies/kill-bill-the-whole-bloody-affair', poster: '', doubanRating: '',
    releaseDate: '2026-03-07(中国香港) / 2026-03-20(中国台湾)', director: '昆汀·塔伦蒂诺',
    cast: '乌玛·瑟曼 / 刘玉玲 / 薇薇卡·福克斯 / 迈克尔·马德森 / 达丽尔·汉娜 / 大卫·卡拉丁 / 栗山千明 / 千叶真一 / 刘家辉',
    genres: '动作 / 犯罪 / 惊悚',
    synopsis: '《杀死比尔》第一、二部的完整合并剪辑版，围绕新娘 Beatrix Kiddo 对“死亡蛇蝮帮”展开的复仇。它不是前传。',
    note: '用户已确认：原始清单写作“杀死比尔：血色前传”，按公开准确片名“杀死比尔：血色全传”保存；无豆瓣准确条目，未填豆瓣评分和海报。',
  },
};
