# 🔌 空闲充电桩 · 实时看板

佛山科学技术学院充电站，空闲充电口实时查询。手机打开即用，可分享给任何人。

## 它解决什么问题

樱花充电小程序只能扫码进入，看一眼有没有空位很麻烦。这个看板把接口数据抓出来，实时展示每根桩哪几个口是空的。

**关键技术点**：接口 `ev.ying-power.cn` 没有返回 CORS 头，浏览器不能直接跨域请求，所以放了一个 Serverless 函数做同源代理 —— 前端只请求自己域名下的 `/api/status`，由 Vercel 的服务端去调樱花充电的接口。

## 目录结构

```
.
├── index.html        前端看板（纯静态，无依赖）
├── api/status.js     Serverless 函数：代理 + 聚合各桩状态
├── vercel.json       Vercel 配置（香港节点、函数超时、缓存头）
└── package.json
```

## 部署到 Vercel

1. 把本目录推到 GitHub 仓库
2. 打开 https://vercel.com/new ，Import 这个仓库
3. 配置：
   - **Framework Preset**：`Other`
   - **Root Directory**：`./`
   - Build Command / Output Directory：**留空**
4. Deploy，拿到 `https://xxx.vercel.app`

## 改配置

**换桩号 / 改区域名**：编辑 `api/status.js`

```js
const ZONES = [
  { name: "就近区域", sns: [6138800575, 6138800572, 6138800582] },
  { name: "其他桩",   sns: [6138800576, 6138800578, 6138800579] },
];
```

**改站点名 / 计费文案**：同文件里的 `STATION`、`FEE`。

**换凭证**：Vercel 项目 → Settings → Environment Variables 加一个 `YP_AUTH`（值就是代码里那个 `Basic xxxxx`），代码会优先用环境变量。

**改刷新频率**：`index.html` 里的 `const REFRESH = 12;`（秒）；`api/status.js` 里 `s-maxage` 建议同步调整。

## 状态字段说明

| statusCode | 含义 | 看板表现 |
|---|---|---|
| 1 | 空闲 | 🟢 绿色，可用 |
| 3 | 充电中 | ⚪ 灰色，已占用 |

桩级别还有 `lost: true` —— 表示桩**通信失联**，小程序里会显示成"可选"但实际不通电。本看板遇到 `lost` / 无数据 / 请求失败会**自动整根隐藏**，避免你白跑一趟。

## 本地开发

```bash
npx vercel dev      # 起本地服务，含 api 函数
```

## 免责声明

数据抓取自樱花充电小程序公开接口，仅供查位参考，**能否充上以小程序实际预约为准**。接口由第三方提供，可能随时变更或失效。