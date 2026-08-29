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

图标资源使用 `antd-mobile-icons`。项目不在浏览器加载 React，而是在构建时提取所需的官方 SVG 轮廓到 `public/antd-icons.js`。

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
- 价格单位支持 `CNY`、`HKD`、`JPY`、`USD`，下拉选项会随界面语言显示本地化名称
- 活动生成唯一 slug，通过 `/events/{slug}` 可直接访问
- 可设置可访问该活动的操作员账号，并在活动编辑页修改成员权限
- 活动卡片不展示商品或订单统计数据
- 销售数据入口仅对系统管理员和活动管理员可见，使用报表图标按钮
- 活动卡片不展示地址文本；数据、编辑、复制链接按钮位于“进入”活动按钮左侧

### 商品管理
- 每个活动下可创建多个商品
- 商品可编辑名称、价格、图片（上传至 R2）；价格按所选货币的主单位输入，支持两位小数，仍以最小单位整数存储
- 图片在编辑弹窗内上传、预览、移除；替换或移除时自动清理旧 R2 对象
- 商品可删除（软删除 active=0，不再显示在销售列表）
- 商品卡片分为上下两行：上层左上角显示 56px 商品缩略图，右侧显示名称和价格；下层数量步进器横向占满整行
- 商品网格按卡片实际最小宽度自适应列数：桌面端最小约 176px，移动端最小约 160px，容器不足时自动降为单列
- 活动编辑页支持拖拽调整商品展示顺序，顺序保存到 `sort_order`

### 订单录入
- 进入活动后可见商品卡片，点击 +/− 调整加购数量，或直接点击数量数字手动输入
- 数量可为负数（用于退货）；点击数字时全选并唤起数字键盘，便于快速修改
- 移动端页面锁定缩放，避免连续点击时误触放大
- 顶栏在页面滚动时固定在顶部；底部结算栏（圆角卡片，固定页面底部）显示满赠信息（有满赠时）和总金额
- 侧栏展开按钮在所有尺寸常驻：桌面/平板从侧边收起或展开，手机从顶部覆盖展开；移动端展开时显示遮罩，点击侧栏外区域即可收起
- 侧栏高度与浏览器视口保持一致，不随页面可滚动内容拉伸
- 商品列表滚动到底部时，最后一张商品卡片与结算栏之间保留间距
- 点击"确认下单"后二次确认，提交后订单立即计入统计
- 活动下单界面右上角可进入当前活动的订单记录
- 无退货时仅显示总额；有退货时在总额左侧显示销售金额和退货金额分项

### 满赠规则
- 按订单净额计算
- 可累加模式：`数量 = floor(净额 / 门槛)`
- 不可累加模式：取已满足条件中的最高门槛，数量为 1
- 未达到满赠时不显示满赠内容
- 管理员可在活动编辑页添加 / 编辑 / 删除满赠规则（软删除）
- 提交订单时由服务端按规则权威重算，满赠快照写入 `order_gifts` 表

### 订单管理
- 订单可取消（软删除，状态变为 cancelled）
- 取消的订单不计入销售统计，但保留审计记录
- 订单记录包含商品名称和价格快照、满赠名称与数量快照（历史准确性）
- 统计报表支持日期筛选、商品销量/退货明细、满赠发放统计和 CSV 导出；CSV 金额按主单位保留两位小数，货币单位写在金额列标题中
- 订单详情支持打印小票，并提供适配热敏打印机宽度的打印样式

### 审计日志
- 关键登录、账号、活动、商品、满赠、成员、图片和订单操作写入 `audit_logs`
- 系统管理员和管理员可在审计日志页面查看操作者、活动、动作、时间和载荷

### 国际化 (i18n)
- 支持简体中文 (zh-CN)、繁体中文 (zh-TW)、粤语（香港，zh-HK）、英语 (en)、日语 (ja)
- 默认语言偏好为“跟随系统”，按浏览器语言自动选择上述语言
- 用户可在设置中手动覆盖；顶栏语言按钮可快速循环切换

### 主题
- 浅色 / 深色 / 跟随系统
- 默认浅色，可在个人设置中切换
- 浅色模式固定使用浅色背景和深色文字，并声明 `color-scheme: light`，避免 Android 浏览器自动反色

### 账号管理
- 用户可在个人设置中修改用户名、显示名称和密码
- 系统管理员可在账号管理中编辑用户资料、角色及启用状态
- 修改密码时留空表示保留当前密码；用户不能禁用自己的账号或降级自己的权限

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

图标使用 `antd-mobile-icons` 的官方轮廓资源，构建时由 `scripts/extract-antd-icons.mjs` 提取到 `public/antd-icons.js`，无需在浏览器运行 React。

首次安装依赖或升级图标库后执行：

```bash
npm install
npm run icons:generate
```

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 退出 |
| PATCH | `/api/auth/preferences` | 更新语言/主题 |
| PATCH | `/api/auth/account` | 修改当前用户的用户名、显示名称或密码 |
| GET | `/api/bootstrap` | 初始化数据（用户、活动、商品、订单等） |
| GET | `/api/users` | 用户列表（管理员） |
| POST | `/api/users` | 创建用户（管理员） |
| PATCH | `/api/users/:id` | 编辑用户资料、角色、状态或密码（管理员） |
| POST | `/api/events` | 创建活动（管理员） |
| PATCH | `/api/events/:id` | 编辑活动（活动管理员+） |
| DELETE | `/api/events/:id` | 删除活动及其关联数据（系统管理员/管理员） |
| POST | `/api/events/:id/products` | 添加商品 |
| PATCH | `/api/products/:id` | 编辑商品 |
| DELETE | `/api/products/:id` | 删除商品 |
| PATCH | `/api/events/:id/products` | 批量保存商品排序 |
| POST/PATCH | `/api/events/:id/products/reorder` | 批量保存商品排序（兼容路由） |
| POST | `/api/events/:id/gifts` | 添加满赠规则 |
| PATCH | `/api/gifts/:id` | 编辑满赠规则 |
| DELETE | `/api/gifts/:id` | 删除满赠规则（软删除） |
| GET | `/api/events/:id/members` | 活动成员列表 |
| POST | `/api/events/:id/members` | 添加成员 |
| PATCH | `/api/events/:id/members/:userId` | 修改成员权限 |
| DELETE | `/api/events/:id/members/:userId` | 移除成员 |
| POST | `/api/events/:id/images` | 上传图片至 R2 |
| GET | `/api/events/:id/orders` | 活动订单列表 |
| GET | `/api/orders/:id` | 订单详情（商品与满赠快照） |
| POST | `/api/events/:id/orders` | 提交订单 |
| POST | `/api/orders/:id/cancel` | 取消订单 |
| GET | `/api/audit-logs` | 审计日志（系统管理员/管理员） |
| GET | `/media/:key` | 获取 R2 图片 |

## 业务约定

- 价格展示和录入使用所选货币的主单位（如 `12.34 CNY`），价格以最小单位整数（integer minor units）存储
- 订单数量允许负数，负数表示退货
- 满赠按订单净额计算；不可累加模式取已满足条件中的最高门槛
- 订单取消为软删除，不计入统计但保留审计字段
- 暂不支持完全断网下单；PWA 只缓存应用外壳，订单提交需要在线
- 密码使用 PBKDF2 (SHA-256, 100,000 iterations) 哈希存储
- 会话令牌以 SHA-256 摘要存入 D1，通过 HttpOnly Cookie 传递
