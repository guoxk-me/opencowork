# OpenCowork v0.10.1 发布说明

**发布日期**: 2026-04-09
**版本**: v0.10.1
**状态**: 正式发布

---

## 版本亮点

### 🎯 IM 配置面板 - IM 平台可视化配置

新增 IMConfigPanel UI 组件，支持飞书、钉钉、企业微信、Slack 平台的图形化配置。无需手动编辑配置文件，通过可视化界面即可完成 IM 集成配置。

### 🔧 飞书连接状态实时显示

ControlBar 新增 IM 按钮，实时显示飞书连接状态（已连接/未配置/连接错误/连接中）。状态指示器一目了然，方便用户快速了解 IM 服务状态。

### 🛠️ 代码审核修复

修复多个 P0/P1 问题，提升系统稳定性和可靠性。包括 TaskEngine.cancel() 错误调用、IPC 返回值包装问题、配置文件路径解析等问题。

---

## 核心变更

| 功能                     | 变更类型 | 说明                                               |
| ------------------------ | -------- | -------------------------------------------------- |
| IMConfigPanel            | 新功能   | IM 平台配置 UI 组件，支持飞书/钉钉/企微/Slack      |
| IMButton                 | 新功能   | ControlBar 状态指示器，显示连接状态                |
| im:load/save/test/status | 新功能   | IPC handlers，支持配置的加载/保存/测试/状态查询    |
| ConnectionStatusManager  | 新功能   | 连接状态管理器，实时跟踪 IM 连接状态               |
| TaskEngine.cancel()      | Bug修复  | 正确调用 executor.cancel() 而非 pause()            |
| Agent 预初始化           | 优化     | 启动时初始化 sharedMainAgent，加快飞书消息处理     |
| IPC 层优化               | 优化     | 添加 NO_WRAP_CHANNELS，避免查询类 API 返回值被包装 |

---

## 详细变更

### 新增文件

- `src/config/imConfig.ts` - IM 配置存储和验证
- `src/config/connectionStatusManager.ts` - 连接状态管理器
- `src/renderer/stores/imStore.ts` - IM 状态管理（Zustand）
- `src/renderer/components/IMConfigPanel.tsx` - 配置面板组件

### 修改文件

- `src/main/ipc.ts` - IPC 层优化，添加 NO_WRAP_CHANNELS
- `src/main/ipcHandlers.ts` - IM 相关 IPC handlers
- `src/main/index.ts` - Agent 预初始化
- `src/im/feishu/FeishuBot.ts` - 连接状态更新支持
- `src/im/feishu/FeishuService.ts` - cleanup 方法
- `src/core/runtime/TaskEngine.ts` - cancel() 方法修复

### 删除文件（无）

---

## 代码审核修复记录

| 优先级 | 问题                           | 文件             | 修复                  |
| ------ | ------------------------------ | ---------------- | --------------------- |
| P1     | TaskEngine.cancel() 调用错误   | TaskEngine.ts    | 改为调用 cancel()     |
| P1     | IPC 返回值自动包装             | ipc.ts           | 添加 NO_WRAP_CHANNELS |
| P1     | 配置文件路径解析错误           | imConfig.ts      | 使用 \_\_dirname      |
| P1     | Agent 未初始化导致消息处理失败 | index.ts         | 启动时预初始化        |
| P1     | UI 状态不更新                  | imStore.ts       | 修复 IPC 响应格式     |
| P2     | FeishuService 无 cleanup       | FeishuService.ts | 添加 cleanup() 方法   |
| P2     | FeishuBot 无 close 方法        | FeishuBot.ts     | 添加 close() 方法     |

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                     用户界面层 (React)                       │
├─────────────────────────────────────────────────────────────┤
│  ControlBar    │  IMConfigPanel   │  PlanViewer  │ 其他   │
├─────────────────────────────────────────────────────────────┤
│                    状态管理层 (Zustand)                      │
│  taskStore  │  imStore  │  historyStore  │ schedulerStore │
├─────────────────────────────────────────────────────────────┤
│                       IPC 层                                │
│  im:load  │  im:save  │  im:test  │  im:status  │ im:statusAll │
├─────────────────────────────────────────────────────────────┤
│                    IM 服务层                                │
│  FeishuBot  │  FeishuService  │  DispatchService           │
├─────────────────────────────────────────────────────────────┤
│                 ConnectionStatusManager                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 升级指南

### 从 v0.9.x 升级

无需特殊操作，正常更新即可。配置文件格式兼容。

### 从更低版本升级

建议全新安装，避免配置文件格式不兼容。

### 首次配置飞书

1. 点击 ControlBar 右侧的 IM 按钮
2. 在弹窗中选择"飞书"Tab
3. 填写 App ID 和 App Secret
4. 启用飞书集成开关
5. 点击"测试连接"验证配置
6. 点击"保存"生效

---

## 已知问题

| 问题              | 状态 | 备注                       |
| ----------------- | ---- | -------------------------- |
| 树莓派 GPU 警告   | 已知 | 不影响功能，硬件限制       |
| Skills 目录不存在 | 已知 | 可忽略，首次运行会自动创建 |

---

## 致谢

感谢所有参与测试和反馈问题的用户。

---

## 下载

- **GitHub Releases**: https://github.com/LeonGaoHaining/opencowork/releases
- **最新代码**: https://github.com/LeonGaoHaining/opencowork
- **文档**: https://github.com/LeonGaoHaining/opencowork/tree/main/docs

---

_Release Date: 2026-04-09_
_OpenCowork v0.10.1_
