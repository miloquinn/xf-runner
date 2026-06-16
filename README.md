# 雪峰快跑

一个轻量级网页跑酷小游戏。玩家控制角色不断向前跑，跳过地面障碍，下蹲躲避空中障碍，收集空中道具获得短时强化，并把成绩提交到排行榜。

在线版本：

https://zxf.oorigo.tech/

## 功能

- 跳跃、下蹲、空中快速落地
- 简单、普通、困难三档难度
- 障碍物：地面雪糕、空中雪碧瓶等
- 道具：5 倍分、10 倍分、小飞机
- 复活机制：完整玩 5 局获得 1 次复活，最多攒 3 次，每局最多复活 2 次
- 排行榜：按难度分榜，每个玩家只显示最高成绩，榜单显示前 100 名
- 排行榜统计：“更多”Tab 内展示地区排名和局数排名
- 本地身份：玩家姓名保存在当前浏览器，删除浏览器数据后需要重新输入
- 移动端适配：支持横屏、竖屏和触控按钮
- 音效和背景音乐开关

## 技术结构

项目是原生 HTML、CSS、Canvas 和 ES Modules 实现的静态网页游戏，不依赖构建工具。

```text
.
├── index.html
├── assets/
│   ├── audio/
│   ├── runner-*.png
│   ├── icecream-*.png
│   ├── soda-bottle.png
│   └── power-*.png
├── src/
│   ├── main.js
│   ├── api/
│   ├── config/
│   ├── core/
│   ├── systems/
│   └── ui/
└── server/
    └── xuefeng-runner-api.py
```

主要模块：

- `src/core/game.js`：主游戏状态、输入、循环、复活和结算
- `src/systems/renderSystem.js`：Canvas 渲染
- `src/systems/spawnSystem.js`：障碍物和道具生成
- `src/systems/collisionSystem.js`：碰撞盒
- `src/systems/effectSystem.js`：道具效果和无敌状态
- `src/systems/scoring.js`：分数和速度倍率
- `src/ui/leaderboard.js`：排行榜读取、提交和展示
- `src/config/*.js`：难度、物理、道具和常量配置

## 本地运行

因为项目使用 ES Modules，建议通过本地静态服务器访问，不要直接双击打开 `index.html`。

```bash
cd /Users/xiaoyuan/work/xf-runner
python3 -m http.server 4173
```

然后打开：

```text
http://127.0.0.1:4173/
```

也可以用任意静态服务器，例如 `npx serve`、Caddy、Nginx 或 Node.js 简易服务器。

## 排行榜 API

前端默认访问同源接口：

- `GET /api/leaderboard`
- `GET /api/session?difficulty=简单`
- `POST /api/score`

线上后端脚本位于 `/usr/local/bin/xuefeng-runner-api.py`，仓库副本在 `server/xuefeng-runner-api.py`。后端会拒绝非法难度、空名字、`__` 开头的探测名、非整数分数和明显不可能的超高分。提交成绩前必须先领取服务端签名的一次性开局令牌；服务端会按令牌签发时间校验真实耗时和分数上限，避免直接 POST 假成绩。地区统计按服务端收到的网络地区聚合，不在 API 响应或 Git 仓库中保存明文 IP。后端会优先使用 Cloudflare 省/地区请求头；缺失时读取 `CF-Connecting-IP` / `X-Forwarded-For` 中的真实公网 IP，并通过 `ipapi.co` 查询省/地区，带超时和内存缓存。

`GET /api/leaderboard` 返回示例：

```json
{
  "scores": [
    {
      "name": "同学",
      "score": 12345,
      "difficulty": "简单",
      "at": "2026-06-15T10:00:00Z"
    }
  ],
  "total_games": 100,
  "total_players": 20,
  "region_stats": [
    { "region": "中国大陆", "games": 88 }
  ],
  "player_games": [
    { "name": "同学", "games": 12 }
  ]
}
```

`POST /api/score` 请求示例：

```json
{
  "name": "同学",
  "score": 12345,
  "difficulty": "简单"
}
```

如果云端 API 不可用，前端会回退到浏览器本地缓存排行榜。

## 本地存储

游戏会在浏览器中保存以下数据：

- 玩家姓名
- 历史最高分
- 声音开关
- 当前难度
- 本地排行榜缓存
- 复活券数量和进度

这些数据只存在当前浏览器环境中，清理浏览器数据或更换浏览器后会丢失。

## 部署

这是静态前端项目，部署时同步整个目录到 Web 根目录即可。线上需要反向代理 `/api/leaderboard` 和 `/api/score` 到排行榜后端。

示例：

```bash
rsync -rvct --delete --exclude='.DS_Store' ./ user@server:/var/www/zxf.oorigo.tech/
```

线上部署前建议先备份：

- Web 根目录
- 排行榜数据目录

## 资源说明

游戏内角色、障碍物和道具素材位于 `assets/`。新增角色动作帧时要保持同一套画布、比例和脚底锚点，否则容易出现跑步或跳跃时人物忽大忽小。

当前稳定角色帧：

- `assets/runner-run-1.png`
- `assets/runner-run-2.png`
- `assets/runner-jump.png`
- `assets/runner-duck.png`

## 免责声明

本小游戏仅供娱乐、学习和技术演示使用。角色、道具和玩法均为原创趣味化表达，不代表任何真实人物或品牌立场。
