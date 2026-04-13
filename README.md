<h1 align="center">

  OpenCowork
  <br>
</h1>

<p align="center">
  <b>AI Native Desktop Agent</b> — Let AI control your computer like a human to complete complex tasks
</p>

<p align="center">
  <a href="https://github.com/LeonGaoHaining/opencowork/stargazers">
    <img src="https://img.shields.io/github/stars/LeonGaoHaining/opencowork?style=social" alt="stars">
  </a>
  <a href="https://github.com/LeonGaoHaining/opencowork/releases">
    <img src="https://img.shields.io/github/v/release/LeonGaoHaining/opencowork?include_prereleases" alt="release">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/LeonGaoHaining/opencowork" alt="license">
  </a>
  <a href="https://github.com/LeonGaoHaining/opencowork/issues">
    <img src="https://img.shields.io/github/issues/LeonGaoHaining/opencowork" alt="issues">
  </a>
  <a href="https://github.com/LeonGaoHaining/opencowork/pulls">
    <img src="https://img.shields.io/github/issues-pr/LeonGaoHaining/opencowork" alt="prs">
  </a>
  <a href="https://opencowork.me">
    <img src="https://img.shields.io/badge/Website-opencowork.me-brightgreen" alt="website">
  </a>
</p>

---

## ✨ Key Features

| Feature                   | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| 🧠 **AI Planning**        | LLM-driven task planning and decomposition             |
| 🌐 **Browser Automation** | AI autonomously operates browser to complete web tasks |
| 🔍 **Web Fetch**          | Lightweight HTTP requests for web content extraction   |
| 🔎 **Real-time Search**   | Exa AI real-time web search                            |
| ⏰ **Scheduled Tasks**    | Cron/Interval task scheduling                          |
| 💬 **IM Integration**     | Feishu, DingTalk, WeCom support                        |
| 📝 **Task History**       | Complete execution history records                     |
| 🛠️ **Skill System**       | Extensible custom skills                               |
| 👁️ **Live Preview**       | Real-time preview in sidebar                           |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Python 3.8+ (for some skill scripts)

### Installation

```bash
# Clone the project
git clone https://github.com/LeonGaoHaining/opencowork.git
cd opencowork

# Install dependencies
npm install

# Configure LLM
# Edit config/llm.json with your API configuration

# Start development mode
npm run electron:dev
```

### Configure LLM

Create `config/llm.json`:

```json
{
  "provider": "openai",
  "model": "gpt-4-turbo",
  "apiKey": "your-api-key",
  "baseUrl": "https://api.openai.com/v1",
  "timeout": 60000
}
```

---

## 📖 Usage Examples

### Basic Tasks

```
Open Baidu and search for "latest AI news"
Check Beijing weather for me
Create a PPT introducing our company products
```

### IM Control (Feishu)

```
Task: Check Beijing weather
Status: abc123
List
Takeover abc123
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     OpenCowork                           │
├─────────────────────────────────────────────────────────┤
│  UI Layer (React + Electron)                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │   Chat UI   │ │  ControlBar  │ │  Preview    │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────┤
│  Main Process                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │    IPC      │ │   Session   │ │  Scheduler  │        │
│  │  Manager    │ │  Manager    │ │   Manager   │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────┤
│  Core Layer                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │ TaskEngine  │ │  TaskPlan   │ │   Agent     │        │
│  │             │ │   -er       │ │   (LLM)     │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────┤
│  Executor Layer                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │  Browser    │ │     CLI     │ │  AskUser    │        │
│  │  Executor   │ │  Executor   │ │  Executor   │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
├─────────────────────────────────────────────────────────┤
│  Tools Layer                                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │  WebFetch   │ │ WebSearch   │ │   Skills    │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
```

---

## 📂 Project Structure

```
opencowork/
├── src/
│   ├── main/              # Electron main process
│   ├── renderer/         # React UI
│   ├── core/             # Core business logic
│   │   ├── action/       # Action definitions
│   │   ├── executor/     # Executors
│   │   ├── planner/      # Task planning
│   │   └── runtime/      # Runtime
│   ├── agents/           # AI Agent
│   ├── llm/              # LLM client
│   ├── im/               # IM integration
│   ├── scheduler/         # Scheduled tasks
│   ├── history/         # Task history
│   └── skills/           # Skill system
├── docs/                 # Documentation
├── config/                # Config files (not committed)
└── dist/                 # Build output
```

---

## 🛠️ Development

```bash
# Development
npm run electron:dev

# Build
npm run build:main     # Main process
npm run build:preload  # Preload script
npm run build:renderer # Renderer process

# Testing
npm test

# Code quality
npm run lint
npm run format
```

---

## 📜 License

This project is licensed under the [Apache License 2.0](LICENSE).

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 🔒 Security

For security vulnerabilities, please read [SECURITY.md](SECURITY.md) for reporting guidelines.

---

## 📬 Contact

- GitHub Issues: https://github.com/LeonGaoHaining/opencowork/issues
- GitHub Discussions: https://github.com/LeonGaoHaining/opencowork/discussions
- Website: https://opencowork.me

---

<p align="center">
  ⭐ If this project helps you, please give it a star!
</p>
