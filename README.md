# 个人工作台 · Personal Workbench

一个采用 Apple 设计风格的个人工作台 Web 应用，集网址导航、待办管理、书签导入、背景定制于一体。前端为单文件 HTML，后端为零依赖的 Node.js 原生 HTTP 服务，数据持久化采用 **PostgreSQL** 数据库。

---

## 目录

- [项目结构](#项目结构)
- [功能概览](#功能概览)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [Docker 部署](#docker-部署)
- [后端服务（server.js）](#后端服务serverjs)
- [前端应用（workbench.html）](#前端应用workbenchhtml)
- [数据结构](#数据结构)
- [API 接口](#api-接口)
- [功能详解](#功能详解)
- [注意事项](#注意事项)

---

## 项目结构

```
workbench/
├── server.js              # Node.js 后端服务（零依赖，仅用内置模块）
├── workbench.html         # 前端单页应用（HTML + CSS + JS 合一）
├── favicon.ico            # 站点图标（多尺寸 ICO）
├── Dockerfile             # Docker 镜像构建文件
├── docker-compose.yml     # Docker Compose 一键部署配置
└── .dockerignore          # Docker 构建忽略列表
```

| 文件 | 说明 |
| --- | --- |
| `server.js` | 原生 `http` + `pg` 模块搭建的服务，提供静态文件托管与数据读写 REST API |
| `workbench.html` | 包含完整 UI、样式与交互逻辑的前端单页应用 |
| `favicon.ico` | 多尺寸 favicon 图标（16/32/48/64/128/256） |

---

## 功能概览

| 模块 | 功能 |
| --- | --- |
| 🔒 密码保护 | 首次访问需输入密码，SHA-256 加密缓存到浏览器 localStorage，后续免验证 |
| 🗂️ 站点导航 | 按分组展示站点卡片，支持拖拽排序、跨组拖动、增删改、折叠展开 |
| 🔍 站点搜索 | 按站点名称或网址实时过滤 |
| ✅ 待办事项 | 新增、勾选完成、删除；已完成待办可查看历史，支持表格展示、分页、搜索、批量删除 |
| 🕐 实时时钟 | 每秒刷新的时分秒 + 日期星期 |
| 🎨 背景定制 | 纯色 / 渐变 / 网络图片 / 本地上传图片 |
| 🌗 主题切换 | 亮色 / 暗色主题，Apple 风格设计系统 |
| 📑 书签导入 | 解析浏览器导出的 HTML 书签文件，作为数据源供挑选 |
| 💾 数据管理 | JSON 备份导出 / 导入 / 一键清空 |
| 🔄 数据持久化 | PostgreSQL 数据库持久化，容器重建不丢失 |

---

## 技术栈

**后端**
- Node.js 原生 `http` / `path` 模块 + `pg` (PostgreSQL 客户端)
- 零其他第三方依赖

**前端**
- 原生 HTML / CSS / JavaScript（无框架）
- [SortableJS](https://sortablejs.github.io/Sortable/)（CDN 引入，拖拽排序）
- [DM Sans](https://fonts.google.com/specimen/DM+Sans) 字体（Google Fonts CDN）

**数据库**
- PostgreSQL（通过 Docker Compose 部署）

---

## 快速开始

### 环境要求
- Node.js（建议 v14+）
- PostgreSQL 数据库

### 启动服务

```bash
node server.js
```

启动后控制台输出：

```
工作台服务已启动: http://localhost:3110
```

### 访问应用

浏览器打开 `http://localhost:3110`。

---

## Docker 部署

项目前后端一体化，已支持打包为单个 Docker 镜像部署。PostgreSQL 通过 Docker Compose 统一编排。

### Docker Compose（推荐）

```bash
# 构建镜像并后台启动
docker compose up -d --build

# 查看运行日志
docker compose logs -f

# 停止服务
docker compose down
```

启动后访问 `http://localhost:3110`。

**自定义端口**：修改 `docker-compose.yml` 中 `ports` 的左侧端口即可，例如改为 `8080:3110` 后访问 `http://localhost:8080`。

### Docker 镜像特性

| 特性 | 说明 |
| --- | --- |
| 基础镜像 | `node:20-alpine`（轻量，约 50MB） |
| 非 root 运行 | 使用 `appuser` 用户运行，提升安全性 |
| 健康检查 | 内置 `HEALTHCHECK`，每 30 秒检测 `/api/data` |
| 数据持久化 | 接入 PostgreSQL 数据库，容器重建数据不丢失 |
| 自动重启 | `restart: unless-stopped`，异常退出自动拉起 |
| 零依赖 | 无需 `npm install`，镜像极简 |
| 密码保护 | 首次访问需输入密码，SHA-256 加密缓存到浏览器 localStorage |
| favicon | 内置多尺寸 ICO 图标 |

---

## 后端服务（server.js）

基于 Node.js 原生 `http` 模块 + `pg` 实现，无其他第三方依赖。

### 核心配置

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3110`（可由环境变量 `PORT` 覆盖） | 服务监听端口 |
| `DATABASE_URL` | `postgresql://lgc2025:***@postgresql:5432/workbench` | PostgreSQL 连接字符串 |

### MIME 类型支持

内置常见静态资源的 Content-Type 映射：

`.html` `.js` `.css` `.json` `.png` `.jpg` `.svg`，未匹配类型回退为 `application/octet-stream`。

### 路由设计

| 方法 | 路径 | 功能 |
| --- | --- | --- |
| `GET` | `/api/data` | 读取数据，返回所有站点、待办、书签等 |
| `PUT` | `/api/data` | 接收 JSON body 写入数据库 |
| `GET` | `/api/todos/history?from=&to=` | 查询已完成待办历史，按完成时间范围筛选 |
| `DELETE` | `/api/todos` | 删除指定 ID 的待办（支持批量），body: `{ "ids": [1, 2] }` |
| `OPTIONS` | `*` | CORS 预检请求，返回 204 |
| `GET` | `/` | 返回 `workbench.html` |
| `GET` | `/favicon.ico` | 返回站点图标 |
| `GET` | `/<静态文件>` | 托管静态资源 |

### 安全机制

- **CORS 支持**：允许所有来源（`*`），支持 `GET / PUT / DELETE / OPTIONS` 方法。
- **目录逃逸防护**：通过 `filePath.startsWith(__dirname)` 校验，阻止通过路径穿越访问项目目录外的文件。

### 请求头设置

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

数据接口额外设置 `Cache-Control: no-cache, no-store, must-revalidate`，避免浏览器缓存。

---

## 前端应用（workbench.html）

前端为单文件应用，包含完整的 CSS 设计系统与 JavaScript 交互逻辑。

### 页面结构

```
app-container
├── app-header（顶栏）
│   ├── 应用标题
│   ├── 搜索框（searchInput）
│   └── 操作按钮（主题切换 / 背景设置 / 添加站点 / 书签导入 / 待办面板开关）
├── main-area（主区域）
│   └── groupWrap（分组站点卡片区域）
└── sidePanel（侧边面板）
    ├── 实时时钟（timeText / dateText）
    ├── 待办事项面板（todoPanel）
    └── 数据管理区（导出 / 导入 / 清空 / 书签数据源信息）
```

### 弹窗（Modal）

| 弹窗 | 用途 |
| --- | --- |
| `siteModal` | 新增 / 编辑站点，支持从书签数据源挑选 |
| `bgModal` | 背景设置（纯色 / 渐变预设 / 图片 URL / 本地上传） |
| `bookmarkModal` | 书签导入预览与选择 |
| `historyModal` | 已完成待办历史（表格、分页、搜索、批量删除） |

### 浮动按钮

- `fabGroup`：右下角浮动按钮，用于新增分组。

---

## 数据结构

前端 `DEFAULTS` 定义了默认数据结构：

```javascript
{
  sites: [
    {
      id: Number,        // 站点唯一 ID（自增）
      group: String,     // 所属分组名
      name: String,      // 站点名称
      url: String,       // 站点网址
      icon: String,      // 图标 URL（为空时自动用 Google favicon 服务）
      sort: Number       // 组内排序序号
    }
  ],
  groups: ["开发", "办公", "生活"],   // 分组名称数组（顺序即展示顺序）
  todos: [
    {
      id: Number,        // 待办唯一 ID（自增）
      text: String,      // 待办内容
      done: Boolean,     // 是否完成
      created_at: String,// 创建时间（ISO 8601）
      completed_at: String|null // 完成时间（ISO 8601）
    }
  ],
  bookmarkSource: [
    {
      name: String,      // 书签名称
      url: String,       // 书签网址
      icon: String       // 图标 URL
    }
  ],
  theme: "light",        // 主题："light" | "dark"
  bgConfig: {
    type: "gradient",    // 背景类型："color" | "gradient" | "image"
    value: "linear-gradient(135deg,#e0eafc,#cfdef3)"  // 背景值
  }
}
```

### 数据合并策略

读取数据时通过 `mergeData(raw)` 与默认值合并，确保字段完整：

```javascript
function mergeData(raw) {
  return { ...DEFAULTS, ...raw, bgConfig: raw.bgConfig || DEFAULTS.bgConfig };
}
```

---

## API 接口

### GET /api/data

读取持久化数据。

**响应示例（200）：**
```json
{
  "sites": [...],
  "groups": [...],
  "todos": [...],
  "theme": "light",
  "bgConfig": { "type": "gradient", "value": "..." }
}
```

### PUT /api/data

保存数据。

**请求体：** 完整的 JSON 数据对象

**响应：**
- 成功：`{ "ok": true }`
- JSON 解析失败：`400 { "error": "无效的 JSON" }`
- 写入失败：`500 { "error": "保存数据失败" }`

### GET /api/todos/history?from=&to=

查询已完成待办历史，按完成时间范围筛选。

**参数：**
- `from`：开始日期（YYYY-MM-DD），默认 `1970-01-01`
- `to`：结束日期（YYYY-MM-DD），默认 `2099-12-31`

**响应：** 已完成待办数组，按完成时间倒序

### DELETE /api/todos

删除指定 ID 的待办，支持批量删除。

**请求体：** `{ "ids": [1, 2, 3] }`

---

## 功能详解

### 数据持久化（PostgreSQL）

采用 **PostgreSQL** 数据库持久化，数据表包括 `sites`、`todos`、`bookmark_source`、`app_groups`，容器重建、删除后重新创建，数据依然保留。

### 站点卡片

- **图标获取**：优先使用配置的 `icon`，为空时自动调用 `https://www.google.com/s2/favicons?domain=<域名>&sz=64`；加载失败时显示站点名首字母占位符。
- **拖拽排序**：基于 SortableJS，支持组内排序与**跨组拖动**（自动更新 `group` 与 `sort` 字段）。
- **折叠展开**：单组站点超过 25 个时自动折叠，显示「展开 (N 项)」按钮。
- **右键编辑**：在站点卡片上右键可直接打开编辑弹窗。

### 待办清单

- **主页列表**：仅展示未完成待办，创建时间默认隐藏，鼠标悬停显示。
- **历史记录**：点击「历史」按钮打开弹窗，表格形式展示已完成待办（内容、完成时间、创建时间）。
- **分页**：每页默认 10 条，支持翻页。
- **搜索**：按内容实时过滤。
- **删除**：单条删除（行内 ✕ 按钮）和批量选择删除（勾选后点「删除选中」）。

### 背景设置

| 类型 | 说明 |
| --- | --- |
| `color` | 纯色背景，通过颜色选择器选取 |
| `gradient` | 预设渐变方案，点击按钮应用 |
| `image` | 网络图片 URL 或本地上传（转 Base64 Data URL 存储） |

### 书签导入

1. 上传浏览器导出的书签 HTML 文件（`bookmarks.html`）
2. 前端使用 `DOMParser` 解析所有 `<a href>` 链接，去重并补全协议、自动抓取 favicon
3. 预览列表，勾选要导入的书签
4. 导入后存入 `bookmarkSource` 作为数据源

> 导入的书签不会直接变成站点，而是作为**数据源**，在新增/编辑站点时可通过「从书签挑选」按钮快速选择填充。

### 主题切换

通过在 `<html>` 根元素切换 `.dark` 类实现亮/暗主题，所有颜色基于 CSS 变量（Apple Design System Tokens），切换平滑过渡。

---

## 注意事项

- **CORS 完全开放**：`Access-Control-Allow-Origin: *`，适合本地或内网使用，不建议直接暴露到公网。
- **密码保护**：默认密码 `lgc123`，通过 SHA-256 加密缓存到浏览器 localStorage，首次访问需输入密码。如需修改密码，编辑 `workbench.html` 中的 `PASSWORD` 常量。
- **localStorage 同步**：每次读取服务端数据会同步覆盖本地缓存，多设备数据不会自动合并，以最后一次写入为准。
- **图片背景 Base64**：本地上传的背景图片以 Base64 编码存入数据，大图会显著增大数据体积。
- **数据备份**：数据存储在 PostgreSQL 中，如需备份请使用数据库导出工具（如 `pg_dump`）。

---

## 开发与扩展

本项目结构简洁，易于扩展：

- **新增站点字段**：在 `DEFAULTS.sites` 与编辑弹窗中增加字段即可
- **新增分组逻辑**：分组存储在 `groups` 数组，顺序即展示顺序
- **自定义主题**：修改 `:root` 与 `.dark` 中的 CSS 变量即可全局换肤
