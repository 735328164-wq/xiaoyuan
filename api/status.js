/**
 * GET /api/status
 * 服务端代理：Vercel 函数去请求樱花充电接口，再把自己的域名下的同源 JSON 返回给前端。
 * 这样浏览器就不受对方服务器没有 CORS 头的限制（原来看板必须跑在你电脑上，就是为了绕这个）。
 */

const API = "https://ev.ying-power.cn/Manage/api/app/ebike/charger/getEbikeChargerInfo";

// 樱花充电小程序下发的应用级凭证（可以在 Vercel 环境变量 YP_AUTH 里覆盖）
const AUTH =
  process.env.YP_AUTH ||
  "Basic ZWRmMjQ0NDUxYTA2NGFkMTg0ZjQzNTY0ZDA0ZDkzN2E6NDJiODJlOWUxNzA3NDgxN2I4NjA1ODM1MTMwM2ZmMGI=";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/144.0.0.0 Safari/537.36 MicroMessenger/7.0.20.1781(0x6700143B) NetType/WIFI " +
  "MiniProgramEnv/Windows WindowsWechat/WMPF XWEB/25799";
const REFERER = "https://servicewechat.com/wx38bb30266746a1ed/1/page-frame.html";

const STATION = "佛山科学技术学院充电站";
const FEE = "0~500W 0.35 元/小时 · 500~1000W 0.5 元/小时";

// ======= 区域划分：想改名 / 改桩号，改这里就行 =======
const ZONES = [
  { name: "就近区域", sns: [6138800575, 6138800572, 6138800582] },
  { name: "其他桩",   sns: [6138800576, 6138800578, 6138800579] },
];
// 失联 / 无数据 / 查询失败 的桩直接不显示
const HIDE_STATES = new Set(["lost", "nodata", "error"]);
// ==================================================

async function probe(sn) {
  try {
    const r = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: AUTH,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
        "xweb_xhr": "1",
        Referer: REFERER,
      },
      body: "sn=" + sn,
      cache: "no-store",
    });
    if (!r.ok) return { sn, state: "error", free: [], busy: [], total: 0 };
    const d = await r.json();
    const c = d && d.content;
    if (!c) return { sn, state: "nodata", free: [], busy: [], total: 0 };

    const plugs = c.plugsInfo || [];
    const free = plugs
      .filter((p) => p.statusCode === 1)
      .map((p) => p.plugNum)
      .sort((a, b) => a - b);
    const busy = plugs
      .filter((p) => p.statusCode !== 1)
      .map((p) => p.plugNum)
      .sort((a, b) => a - b);

    const state = c.lost ? "lost" : free.length ? "free" : "full";
    return { sn, state, free, busy, total: plugs.length };
  } catch (e) {
    return { sn, state: "error", free: [], busy: [], total: 0 };
  }
}

module.exports = async (req, res) => {
  try {
    const all = [];
    for (const z of ZONES) for (const sn of z.sns) if (!all.includes(sn)) all.push(sn);

    // 并行请求，比串行快很多
    const results = await Promise.all(all.map(probe));
    const info = {};
    results.forEach((p) => (info[p.sn] = p));

    const rank = { free: 0, full: 1 };
    let free_total = 0;
    const hidden = [];
    const zones = ZONES.map((z) => {
      const piles = z.sns.map((sn) => info[sn]).filter(Boolean);
      piles.forEach((p) => {
        if (HIDE_STATES.has(p.state)) hidden.push(p.sn);
      });
      const shown = piles
        .filter((p) => !HIDE_STATES.has(p.state))
        .sort((a, b) => (rank[a.state] ?? 9) - (rank[b.state] ?? 9) || a.sn - b.sn);
      const zfree = shown.reduce((s, p) => s + (p.state === "free" ? p.free.length : 0), 0);
      free_total += zfree;
      return { name: z.name, piles: shown, free_total: zfree };
    });

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).send(
      JSON.stringify({
        station: STATION,
        fee: FEE,
        ts: Math.floor(Date.now() / 1000),
        free_total,
        zones,
        hidden,
      })
    );
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};