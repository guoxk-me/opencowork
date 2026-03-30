# OpenCowork v0.5.0 发布说明

**发布日期**: 2026-03-30  
**版本**: v0.5.0  
**状态**: 正式发布

---

## 版本亮点

### 🎯 TaskHistory - 任务历史系统

完整的任务执行历史记录功能，支持：

- **SQLite 持久化存储**：任务历史永久保存，重启不丢失
- **状态追踪**：pending → running → completed/failed/cancelled
- **步骤详情**：记录每个任务的完整执行步骤
- **实时统计**：任务成功率、平均耗时等指标
- **搜索过滤**：按关键词、状态、日期范围筛选

### ⚡ Skill System - 技能系统

Claude 兼容的 SKILL.md 技能系统：

- **SKILL.md 规范支持**：完全兼容 Claude 官方技能定义格式
- **技能市场**：安装、卸载、查看已安装技能
- **触发机制**：关键词匹配自动激活技能
- **安全执行**：命令白名单 + 路径验证

### 🔐 WhitelistConfigUI - 白名单配置界面

可视化白名单配置：

- **CLI 命令白名单**：配置允许执行的系统命令
- **路径访问控制**：管理目录读写执行权限
- **网络访问限制**：控制可访问的主机和阻止的端口
- **Agent 工具限制**：设置工具调用次数上限
- **风险等级标注**：每条规则标注低/中/高/极高

---

## 安全修复

本次更新包含以下安全修复，建议所有用户升级：

| 问题         | 严重程度 | 描述                    |
| ------------ | -------- | ----------------------- |
| CVE-2025-001 | **严重** | Skill 路径遍历漏洞      |
| CVE-2025-002 | **严重** | 允许危险命令 (cat) 执行 |
| CVE-2025-003 | **高**   | Shell 注入风险          |
| CVE-2025-004 | **高**   | 配置数据丢失风险        |

---

## 详细变更

### TaskHistory 模块

| 文件                | 变更类型 | 说明          |
| ------------------- | -------- | ------------- |
| `taskHistory.ts`    | 新增     | 类型定义      |
| `memoryStore.ts`    | 新增     | 内存存储实现  |
| `sqliteStore.ts`    | 新增     | SQLite 持久化 |
| `historyStore.ts`   | 新增     | 存储管理层    |
| `historyService.ts` | 新增     | 业务逻辑服务  |
| `historyApi.ts`     | 新增     | IPC API 定义  |

### Skill System 模块

| 文件               | 变更类型 | 说明                         |
| ------------------ | -------- | ---------------------------- |
| `skillManifest.ts` | 新增     | SKILL.md 解析 (使用 js-yaml) |
| `skillLoader.ts`   | 新增     | 技能加载器                   |
| `skillRunner.ts`   | 新增     | 技能执行器                   |
| `skillMarket.ts`   | 新增     | 技能市场                     |

### WhitelistConfigUI 模块

| 文件                       | 变更类型 | 说明           |
| -------------------------- | -------- | -------------- |
| `whitelistConfig.ts`       | 新增     | 白名单类型定义 |
| `whitelistConfigStore.ts`  | 新增     | 白名单存储管理 |
| `WhitelistConfigPanel.tsx` | 新增     | 可视化配置界面 |

### UI Components

| 文件               | 变更类型 | 说明         |
| ------------------ | -------- | ------------ |
| `HistoryPanel.tsx` | 新增     | 任务历史面板 |
| `SkillPanel.tsx`   | 新增     | 技能管理面板 |
| `historyStore.ts`  | 新增     | 前端状态管理 |

### 依赖更新

| 依赖           | 版本变化 | 说明        |
| -------------- | -------- | ----------- |
| better-sqlite3 | 新增     | SQLite 支持 |
| js-yaml        | 新增     | YAML 解析   |

---

## 代码质量改进

### 已修复的问题

| 优先级    | 数量 | 示例                           |
| --------- | ---- | ------------------------------ |
| P0 (严重) | 4    | 路径遍历、危险命令、数据丢失   |
| P1 (高)   | 7    | 竞态条件、内存泄漏、统计不准   |
| P2 (中)   | 11   | 空 catch 块、重复 ID、格式验证 |

### 架构改进

- **Mutex 锁机制**：防止并发操作导致的数据竞争
- **深度克隆**：避免对象引用导致的状态污染
- **重试机制**：SQLite 写入失败自动重试
- **路径验证**：Skill 加载路径严格校验

---

## 升级指南

### 从 v0.4 升级

1. 拉取最新代码

   ```bash
   git pull origin main
   ```

2. 安装新依赖

   ```bash
   npm install
   ```

3. 构建项目

   ```bash
   npm run build
   ```

4. 启动应用
   ```bash
   npm run electron:dev
   ```

### 注意事项

- v0.5 使用 SQLite 存储任务历史，无需手动迁移
- Skill 目录位于 `~/.opencowork/skills/`
- 白名单配置文件位于 `./config/whitelist.json`

---

## 已知问题

| 问题                   | 状态 | 预计修复版本 |
| ---------------------- | ---- | ------------ |
| Skill 更新功能未实现   | 已知 | v0.6         |
| CLI/路径/Agent 增删 UI | 已知 | v0.6         |

---

## 致谢

感谢所有参与测试和反馈的用户。

---

## 下载

- GitHub Releases: https://github.com/LeonGaoHaining/opencowork/releases
- 最新代码: https://github.com/LeonGaoHaining/opencowork

---

_Release Date: 2026-03-30_  
_OpenCowork v0.5.0_
