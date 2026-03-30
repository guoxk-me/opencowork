# OpenCowork v0.5 使用说明

| 项目     | 内容       |
| -------- | ---------- |
| 版本     | v0.5       |
| 更新日期 | 2026-03-30 |
| 状态     | 正式版     |

---

## 目录

1. [项目简介](#1-项目简介)
2. [TaskHistory 任务历史](#2-taskhistory-任务历史)
3. [Skill System 技能系统](#3-skill-system-技能系统)
4. [WhitelistConfigUI 白名单配置](#4-whitelistconfigui-白名单配置)
5. [快速开始](#5-快速开始)
6. [目录结构](#6-目录结构)
7. [常见问题](#7-常见问题)

---

## 1. 项目简介

OpenCowork v0.5 是一款 **AI Native Desktop Agent**，让AI像人类一样使用电脑完成复杂任务。

### v0.5 新增功能

| 功能                  | 说明                                           |
| --------------------- | ---------------------------------------------- |
| **TaskHistory**       | 完整的任务执行历史记录，支持 SQLite 持久化存储 |
| **Skill System**      | Claude 兼容的 SKILL.md 技能系统                |
| **WhitelistConfigUI** | 可视化白名单配置界面                           |

### 核心能力

| 能力         | 说明                          |
| ------------ | ----------------------------- |
| 浏览器自动化 | AI自主操作浏览器完成网页任务  |
| 任务规划     | 将复杂任务分解为可执行步骤    |
| 实时预览     | 侧边栏实时观看AI操作（24fps） |
| 人工接管     | 随时接管AI的控制权            |
| 任务历史     | 完整记录所有任务执行历史      |
| 技能系统     | 安装和管理自定义技能          |

---

## 2. TaskHistory 任务历史

### 功能特点

- **SQLite 持久化**：任务历史存储在本地数据库，重启后保留
- **状态追踪**：支持 pending/running/completed/failed/cancelled 五种状态
- **步骤详情**：记录每个任务的执行步骤和耗时
- **实时统计**：显示任务成功/失败/取消统计

### 使用方法

1. 点击控制栏中的 **历史** 按钮打开任务历史面板
2. 查看所有任务的执行记录
3. 点击任务查看详细信息（步骤、耗时、结果）
4. 支持搜索和按状态筛选

### 数据存储

- 数据库路径：`./history.db`
- 内存缓存：最近任务缓存在内存中提高查询速度
- 自动同步：任务完成后自动同步到 SQLite

---

## 3. Skill System 技能系统

### 什么是 Skill？

Skill 是一种可扩展的功能模块，通过 `SKILL.md` 文件定义，符合 Claude 官方规范。

### 使用 Skill

1. 打开 **Skill 管理** 面板（控制栏按钮）
2. 点击 **安装 Skill** 输入技能目录路径
3. 已安装的技能会自动显示在列表中
4. 在任务输入框中触发技能（通过关键词匹配）

### SKILL.md 示例

```yaml
---
name: git-helper
description: Git 操作助手
triggers:
  - type: keyword
    value: [git, github]
    priority: 80
    exclusive: false
shell: bash
---

# Git Helper Skill

使用 git 命令帮助完成版本控制任务。

## 可用命令

$ARGUMENTS
```

### 目录结构

```
~/.opencowork/skills/
├── git-helper/
│   ├── SKILL.md
│   └── package.json
└── code-review/
    ├── SKILL.md
    └── package.json
```

### 安全机制

- **路径验证**：Skill 只能在指定目录下加载
- **命令白名单**：仅允许预定义的命令执行
- **Shell 注入保护**：默认关闭 shell 注入

---

## 4. WhitelistConfigUI 白名单配置

### 功能特点

- **可视化配置**：图形界面管理 CLI/路径/网络/Agent 白名单
- **风险等级**：每条规则标注风险等级（低/中/高/极高）
- **实时生效**：保存后立即生效

### 配置项

| 类型       | 说明                               |
| ---------- | ---------------------------------- |
| CLI 命令   | 允许执行的系统命令及参数           |
| 路径访问   | 允许访问的目录及权限（读/写/执行） |
| 网络访问   | 允许访问的主机和阻止的端口         |
| Agent 工具 | 允许使用的工具和最大调用次数       |

### 使用方法

1. 打开 **设置** 或 **白名单配置** 面板
2. 切换标签页查看不同类型的配置
3. 修改后点击 **保存** 按钮
4. 点击 **重置** 恢复默认配置

---

## 5. 快速开始

### 5.1 安装依赖

```bash
cd opencowork
npm install
```

### 5.2 配置 LLM

编辑 `config/llm.json`，填入你的 Azure OpenAI 配置：

```json
{
  "provider": "openai",
  "model": "gpt-4-turbo",
  "apiKey": "你的API Key",
  "baseUrl": "https://your-resource.openai.azure.com/openai/v1"
}
```

### 5.3 启动应用

```bash
npm run electron:dev
```

### 5.4 创建任务

在输入框中描述你想完成的任务：

```
打开百度并搜索高海宁
在小红书搜索护肤教程
使用 git-helper 提交代码
```

---

## 6. 目录结构

```
opencowork/
├── src/
│   ├── history/              # TaskHistory 模块 (v0.5 新增)
│   │   ├── taskHistory.ts     # 类型定义
│   │   ├── memoryStore.ts    # 内存存储
│   │   ├── sqliteStore.ts    # SQLite 持久化
│   │   ├── historyStore.ts    # 存储管理
│   │   ├── historyService.ts  # 业务逻辑
│   │   └── historyApi.ts      # API 定义
│   │
│   ├── skills/               # Skill 系统 (v0.5 新增)
│   │   ├── skillManifest.ts   # SKILL.md 解析
│   │   ├── skillLoader.ts     # 技能加载
│   │   ├── skillRunner.ts     # 技能执行
│   │   └── skillMarket.ts     # 技能市场
│   │
│   ├── config/               # 配置模块
│   │   ├── whitelistConfig.ts        # 白名单类型
│   │   └── whitelistConfigStore.ts   # 白名单存储
│   │
│   └── renderer/
│       └── components/
│           ├── HistoryPanel.tsx        # 任务历史面板
│           ├── SkillPanel.tsx         # 技能管理面板
│           └── WhitelistConfigPanel.tsx # 白名单配置面板
│
└── docs/
    ├── USER_GUIDE.md         # 本文档
    ├── CHANGELOG.md          # 变更日志
    └── RELEASE_v0.5.0.md     # v0.5 发布说明
```

---

## 7. 常见问题

### Q1: TaskHistory 数据存储在哪里？

**A**: 默认存储在 `./history.db` 文件中，使用 SQLite 数据库。

### Q2: 如何安装新的 Skill？

**A**:

1. 准备好包含 `SKILL.md` 的技能目录
2. 打开 Skill 管理面板
3. 点击"安装 Skill"按钮
4. 输入技能目录的完整路径

### Q3: Skill 不起作用怎么办？

**A**:

1. 确认 `SKILL.md` 文件存在且格式正确
2. 检查触发关键词是否匹配
3. 查看控制台是否有加载错误

### Q4: 白名单配置保存失败？

**A**:

1. 检查配置格式是否正确
2. 确认没有重复的主机名或命令
3. 查看验证错误信息并修正

---

## 版本历史

- **v0.5** (2026-03-30) - TaskHistory + Skill System + WhitelistConfigUI
- **v0.4** (2026-03-30) - LangChain/LangGraph 重构
- **v0.3** (2026-03-29) - 工业级 Browser Agent 架构
- **v0.2.3** (2026-03-29) - 元素滚动 + PressEnter 支持

---

_OpenCowork v0.5_
_最后更新: 2026-03-30_
