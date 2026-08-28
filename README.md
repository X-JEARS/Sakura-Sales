# 场贩订单台 (Field Market Orders)

一个面向场贩（现场贩售活动）的订单录入与统计 PWA，全部基于 Cloudflare 服务实现，无需额外云服务器。

工作人员（非顾客）通过此应用快速录入商品数量、自动计算金额与满赠，并实时生成销量统计。管理员可在系统内创建贩售活动、管理商品与人员权限。

## 技术架构

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | 原生 HTML/CSS/JS，无框架 | 单文件 SPA，作为静态资源由 Worker 托管 |
| API | Cloudflare Workers | 路由、鉴权、业务逻辑 |
| 数据库 | Cloudflare D1 (SQLite) | 用户、活动、商品、订单等持久化 |
| 对象存储 | Cloudflare R2 | 商品图片 |
| 缓存 | Cloudflare KV | 预留（会话/配置缓存） |
| PWA | Service Worker + Manifest | 可安装到主屏幕，离线缓存应用外壳 |

## 项目结构

```
offline-order-website/
├── public/                 # 静态资源（由 Workers Assets 托管）
│   ├── index.html          # 入口 HTML
│   ├── app.js              # 前端 SPA（全部逻辑）
│   ├── styles.css          # 全部样式（含暗色主题）
│   ├── sw.js               # Service Worker
│   └── manifest.webmanifest
├── worker.js               # Cloudflare Worker API
├── schema.sql              # D1 数据库建表语句
├── scripts/
│   └── hash-password.mjs   # PBKDF2 密码哈希工具
├── wrangler.toml           # Cloudflare 配置（绑定 D1/R2/KV/Assets）
├── package.json
└── README.md
```

## 角色与权限

| 角色 | 能力 |
|------|------|
| 超级管理员 (super_admin) | 全部操作，包括管理其他管理员 |
| 管理员 (admin) | 创建/编辑活动、管理商品、查看统计、创建操作员账号 |
| 活动管理员 (event_admin) | 管理所属活动（商品、人员、信息）、查看统计 |
| 操作员 (operator) | 进入被授权的活动、录入订单、查看订单记录 |

系统不开放外部注册。所有账号由管理员在内部创建。

## 核心功能

### 贩售活动管理
- 每个活动包含名称、价格单位、开售/停售时间、销售状态（草稿/销售中/待开始/已结束）
- 活动生成唯一 slug，通过 `/events/{slug}` 可直接访问
- 可设置可访问该活动的操作员账号
- 销售数据按钮仅对系统管理员和活动管理员可见

### 商品管理
- 每个活动下可创建多个商品
- 商品可编辑名称、价格（存储为分）、图片（上传至 R2）
- 商品卡片为横向布局：左侧正方形图片，右侧名称、价格和数量步进器

### 订单录入
- 进入活动后可见商品卡片，点击 +/− 调整加购数量
- 数量可为负数（用于退货）
- 底部结算栏显示满赠信息（有满赠时）和总金额
- 点击"确认下单"后二次确认，提交后订单立即计入统计
- 无退货时仅显示总额；有退货时在总额左侧显示销售金额和退货金额分项

### 满赠规则
- 按订单净额计算
- 可累加模式：`数量 = floor(净额 / 门槛)`
- 不可累加模式：取已满足条件中的最高门槛，数量为 1
- 未达到满赠时不显示满赠内容

### 订单管理
- 订单可取消（软删除，状态变为 cancelled）
- 取消的订单不计入销售统计，但保留审计记录
- 订单记录包含商品名称和价格快照（历史准确性）

### 国际化 (i18n)
- 支持简体中文 (zh-CN)、繁体中文 (zh-TW)、英语 (en)、日语 (ja)
- 默认跟随浏览器系统语言
- 用户可在设置中手动覆盖

### 主题
- 浅色 / 深色 / 跟随系统
- 默认浅色，可在个人设置中切换

## 本地预览

```bash
npm run dev
```

打开 <http://127.0.0.1:8765>。本地静态预览会自动使用演示数据（`admin / admin`），订单保存到浏览器 `localStorage`。

## Cloudflare 部署

### 1. 创建资源

在 Cloudflare Dashboard 创建以下资源：
- D1 数据库
- R2 存储桶（用于商品图片）
- KV 命名空间

将各资源 ID 填入 `wrangler.toml`。

### 2. 初始化数据库

```bash
npx wrangler d1 execute field-market-orders --remote --file=schema.sql
```

### 3. 创建超级管理员

生成密码哈希：

```bash
node scripts/hash-password.mjs 'your-strong-password'
```

将哈希写入 D1：

```bash
npx wrangler d1 execute field-market-orders --remote --command \
  "INSERT INTO users (id, username, display_name, role, password_hash) \
   VALUES ('u_super', 'admin', '超级管理员', 'super_admin', 'PASTE_HASH_HERE');"
```

### 4. 部署

```bash
npm run check        # 语法检查
npx wrangler deploy  # 部署 Worker + 静态资源
```

### 更新 PWA 缓存

每次部署前需要同步递增三个文件中的版本号：
- `public/index.html` — `app.js?v=N`
- `public/app.js` — `navigator.serviceWorker.register('/sw.js?v=N')`
- `public/sw.js` — `CACHE` 常量

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 退出 |
| PATCH | `/api/auth/preferences` | 更新语言/主题 |
| GET | `/api/bootstrap` | 初始化数据（用户、活动、商品、订单等） |
| GET | `/api/users` | 用户列表（管理员） |
| POST | `/api/users` | 创建用户（管理员） |
| POST | `/api/events` | 创建活动（管理员） |
| PATCH | `/api/events/:id` | 编辑活动（活动管理员+） |
| POST | `/api/events/:id/products` | 添加商品 |
| PATCH | `/api/products/:id` | 编辑商品 |
| DELETE | `/api/products/:id` | 删除商品 |
| GET | `/api/events/:id/members` | 活动成员列表 |
| POST | `/api/events/:id/members` | 添加成员 |
| DELETE | `/api/events/:id/members/:userId` | 移除成员 |
| POST | `/api/events/:id/images` | 上传图片至 R2 |
| GET | `/api/events/:id/orders` | 活动订单列表 |
| POST | `/api/events/:id/orders` | 提交订单 |
| POST | `/api/orders/:id/cancel` | 取消订单 |
| GET | `/media/:key` | 获取 R2 图片 |

## 业务约定

- 价格以分为单位（integer minor units）存储
- 订单数量允许负数，负数表示退货
- 满赠按订单净额计算；不可累加模式取已满足条件中的最高门槛
- 订单取消为软删除，不计入统计但保留审计字段
- 暂不支持完全断网下单；PWA 只缓存应用外壳，订单提交需要在线
- 密码使用 PBKDF2 (SHA-256, 100,000 iterations) 哈希存储
- 会话令牌以 SHA-256 摘要存入 D1，通过 HttpOnly Cookie 传递
