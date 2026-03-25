<h1 align="center">Astra</h1>

<p align="center">
  <strong>Self-hosted AI assistant for WhatsApp & Telegram</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Alpha-orange" alt="Status">
  <img src="https://img.shields.io/badge/License-Personal%20Use-blue" alt="License">
  <img src="https://img.shields.io/badge/Tests-221%20passing-brightgreen" alt="Tests">
</p>

---

## What is Astra?

Astra is a self-hosted AI agent that connects to your messaging apps. Chat with AI through WhatsApp or Telegram instead of switching between apps.

**Status**: This is an alpha project for trying out and learning. Not production-ready.

---

## What's Included

### Messaging Bridges
- **WhatsApp** - Connect via QR code (using Baileys)
- **Telegram** - Connect via Bot Token
- **Discord** - Bot integration
- **Slack** - App integration

### AI Features
- **Multi-LLM Support** - OpenAI, Anthropic, Google AI
- **Local RAG** - Vector search with LanceDB
- **Multi-tenant** - Support multiple users

### API & Dashboard
- **REST API** - Full API with Swagger docs
- **Web Dashboard** - Simple management interface

### Shell System (Custom AI Agents)
- **Create Custom Agents** - Build AI agents with specific roles and capabilities
- **Multi-Agent Communication** - 100+ agents can talk to each other
- **n8n Integration** - Connect workflows via webhooks
- **14 Pre-built Templates** - Coder, Researcher, Writer, Planner, and more
- **Supervisor Monitoring** - Watch and control all agents from one place

### Code Structure
- **Voice Processing** - Framework for voice message handling
- **Screenshot Analysis** - Framework for image understanding
- **Integration Scaffolding** - Calendar, Email, Notion connectors (requires API setup)

---

## Quick Start

### Requirements
- Node.js 20+
- An LLM API key (OpenAI, Anthropic, or Google)

### Install

```bash
git clone https://github.com/YOUR_USERNAME/astra.git
cd astra
./setup.sh
```

### Configure

Edit `.env` and add your API key:
```bash
OPENAI_API_KEY=sk-...
```

### Run

```bash
npm run start:api
```

Open `http://localhost:3000`

---

## Docker

```bash
cp .env.example .env
# Edit .env with your API keys
docker-compose up -d
```

---

## Shell System (Custom AI Agents)

Create and orchestrate multiple AI agents ("shells") that work together.

### Quick Example

```bash
# Create a coder agent
curl -X POST http://localhost:3000/api/shells/from-template \
  -H "Content-Type: application/json" \
  -d '{"templateId": "template_coder"}'

# Assign a task
curl -X POST http://localhost:3000/api/shells/{id}/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Write a Python function to sort a list"}'
```

### Available Templates

| Template | Role | Description |
|----------|------|-------------|
| Coder | `coder` | Writes and debugs code |
| Code Reviewer | `reviewer` | Reviews code for issues |
| Debugger | `coder` | Finds and fixes bugs |
| Researcher | `researcher` | Searches and analyzes info |
| Data Analyst | `analyst` | Analyzes data patterns |
| Writer | `writer` | Creates content |
| Technical Writer | `writer` | Technical documentation |
| Planner | `planner` | Breaks down tasks |
| Architect | `planner` | Designs systems |
| Executor | `executor` | Runs tasks and commands |
| Automator | `executor` | Creates automations |
| Communicator | `communicator` | Handles messaging |
| Supervisor | `supervisor` | Monitors other agents |
| QA Tester | `reviewer` | Tests and verifies |

### API Endpoints

```
GET    /api/shells              # List all shells
POST   /api/shells              # Create custom shell
POST   /api/shells/from-template # Create from template
GET    /api/shells/:id          # Get shell details
DELETE /api/shells/:id          # Remove shell

POST   /api/shells/:id/tasks    # Assign task
POST   /api/shells/:id/messages # Send message
POST   /api/shells/broadcast    # Message all shells

GET    /api/shells/supervisor   # Monitoring dashboard
GET    /api/shells/stats        # Statistics
POST   /api/shells/pause-all    # Pause all shells
POST   /api/shells/resume-all   # Resume all shells

POST   /api/shells/webhook/n8n  # n8n integration
```

### n8n Integration

Connect shells to n8n workflows:

```json
// POST /api/shells/webhook/n8n
{
  "action": "assign_task",
  "data": {
    "shellId": "shell_abc123",
    "task": {
      "title": "Process incoming data",
      "description": "Analyze and summarize",
      "priority": "high"
    }
  }
}
```

---

## Project Structure

```
astra/
├── src/
│   ├── api/          # REST API server
│   ├── bridge/       # WhatsApp, Telegram, Discord, Slack
│   ├── core/         # AI orchestrator
│   ├── llm/          # LLM provider adapters
│   ├── memory/       # RAG & vector search
│   ├── shells/       # Custom AI agent system
│   ├── integrations/ # Calendar, Email, Notion (scaffolding)
│   └── visual/       # Ghost cursor system
├── web/              # Dashboard
├── tests/            # 221 tests
└── docker-compose.yml
```

---

## Configuration

```bash
# Required
OPENAI_API_KEY=sk-...          # Or use Anthropic/Google

# Optional - Messaging
TELEGRAM_BOT_TOKEN=...         # From @BotFather

# Optional - Database
DATABASE_URL=postgres://...    # Default: SQLite
REDIS_URL=redis://...          # For sessions
```

See `.env.example` for all options.

---

## Development

```bash
npm install       # Install dependencies
npm run build     # Compile TypeScript
npm test          # Run tests (221 tests)
npm run dev       # Watch mode
```

---

## Current Limitations

- WhatsApp connection may disconnect (Baileys is unofficial)
- Integration APIs require OAuth setup (Google, Notion)
- Voice/Screenshot features need LLM API calls
- Not tested at scale

---

## License

**Personal use only.** Free to try, learn, and experiment.

See [LICENSE](LICENSE) for details.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
./setup.sh
npm run dev
```

---

<p align="center">
  <em>An experimental AI assistant project. Try it out!</em>
</p>
