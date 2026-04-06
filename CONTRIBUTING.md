# 贡献指南

感谢您对 OpenCowork 项目的兴趣！我们欢迎任何形式的贡献，包括但不限于：

- 🐛 报告 Bug
- 💡 提出新功能建议
- 📝 完善文档
- 💻 提交代码修复或新功能
- 🌍 翻译文档或界面
- 📣 帮助推广项目

---

## 代码贡献流程

### 1. Fork 项目

点击 GitHub 仓库页面右上角的 "Fork" 按钮，将项目复制到您的 GitHub 账户。

### 2. 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/opencowork.git
cd opencowork
```

### 3. 创建分支

请基于 `main` 分支创建功能分支：

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/bug-description
```

### 4. 开发环境设置

```bash
# 安装依赖
npm install

# 运行开发模式
npm run electron:dev
```

### 5. 进行修改

- 请遵循项目的代码风格
- 确保修改后代码能正常编译运行
- 添加必要的注释说明复杂逻辑
- 更新相关文档（如果需要）

### 6. 提交修改

```bash
# 暂存修改的文件
git add .

# 提交修改
git commit -m "feat: add new feature"
# 或
git commit -m "fix: resolve bug description"
```

提交信息格式建议：

```
<type>(<scope>): <subject>

[可选正文]

[可选脚注]
```

类型（type）说明：

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `test`: 添加测试
- `chore`: 构建或辅助工具变动

### 7. 推送分支

```bash
git push origin feature/your-feature-name
```

### 8. 创建 Pull Request

1. 访问您的 GitHub 仓库
2. 点击 "Compare & pull request"
3. 填写 PR 描述：
   - 描述修改内容
   - 关联相关 Issue（如果有）
   - 说明测试情况
4. 点击 "Create pull request"

---

## 开发规范

### 代码风格

- 使用 TypeScript
- 使用 2 空格缩进
- 使用 ESLint 进行代码检查：`npm run lint`
- 使用 Prettier 格式化代码：`npm run format`

### Git 提交规范

- 提交信息使用中文或英文
- 保持提交信息简洁明了
- 一个提交只做一件事

### 测试要求

- 新功能尽量添加测试
- 修改代码后确保不影响现有功能
- 运行测试：`npm test`

---

## 项目结构

```
opencowork/
├── src/
│   ├── main/           # Electron 主进程
│   ├── renderer/       # React UI
│   ├── core/           # 核心业务逻辑
│   ├── agents/         # AI Agent
│   ├── llm/            # LLM 客户端
│   ├── im/             # IM 集成（飞书等）
│   ├── scheduler/      # 定时任务
│   ├── history/        # 任务历史
│   └── skills/         # 技能系统
├── docs/               # 文档
└── dist/               # 构建输出
```

---

## 行为准则

请尊重并体谅所有参与者：

- ❌ 不要发布攻击性、歧视性内容
- ❌ 不要重复提交已报告的 Bug
- ✅ 使用友善的语言
- ✅ 耐心回答新手问题
- ✅ 欢迎并感谢每个贡献

---

## 获得帮助

- 📮 GitHub Issues：报告问题或提出建议
- 💬 GitHub Discussions：社区问答讨论
- 📖 docs/USER_GUIDE.md：用户使用文档

---

感谢您的贡献！ 🎉
