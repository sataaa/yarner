# 🧶 Yarner

**AI-Assisted Text Adventure Player**

Yarner is a web-based interface for playing classic text adventure games (z-machine format) with real-time AI assistance. Play your favorite interactive fiction while an AI companion helps you explore, track items, and progress through the story.

---

## ✨ Features (MVP v0.1.0)

- 🎮 **Play Z-Machine Games**: Load and play .z5 and .z8 game files directly in your browser
- 🤖 **AI Assistant**: Chat with Claude AI about the game in real-time
- 📊 **Split-View Interface**: Game on the left, AI assistant on the right
- 💾 **Progress Tracking**: Automatic saving of game history via IndexedDB
- 🌐 **Web-Based**: No installation needed - just open and play

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 🏗️ Tech Stack

- **Frontend**: SvelteKit (SPA mode)
- **Z-Machine Runtime**: Parchment.js
- **AI Integration**: Anthropic Claude API
- **Storage**: IndexedDB (via idb library)
- **Deployment**: Static hosting (Vercel/Netlify)

---

## 📁 Project Structure

```
yarner/
├── src/
│   ├── routes/              # SvelteKit pages
│   ├── lib/
│   │   ├── components/     # UI components
│   │   ├── stores/         # State management
│   │   ├── api/            # Claude API integration
│   │   └── zmachine/       # Parchment.js wrapper
│   └── app.html
├── static/                  # Static assets
├── MANDAMENTOS.md           # Project rules
├── MEMORIA-PROJETO.md       # Project memory/decisions
└── README.md               # This file
```

---

## 🎯 Roadmap

### v0.1.0 (MVP) - Current
- [x] Project setup and structure
- [ ] Parchment.js integration
- [ ] File upload component
- [ ] Split-view interface
- [ ] AI chat component
- [ ] Claude API integration
- [ ] IndexedDB storage

### Future Versions
- Visual map generation
- Multi-format support (Glulx)
- Advanced tracking features
- Save/load game states
- Sharing and social features

---

## 📜 Documentation

- **[MANDAMENTOS.md](./MANDAMENTOS.md)**: Project rules and guidelines
- **[MEMORIA-PROJETO.md](./MEMORIA-PROJETO.md)**: Project decisions and context

---

## 🤝 Contributing

This project is currently in early development. Check `MANDAMENTOS.md` for development guidelines.

---

## 📄 License

TBD

---

## 🙏 Acknowledgments

- Built with [SvelteKit](https://kit.svelte.dev/)
- Z-Machine interpretation by [Parchment.js](https://github.com/curiousdannii/parchment)
- AI powered by [Anthropic Claude](https://www.anthropic.com/claude)

---

**Project Started**: 2026-02-11
**Status**: 🚧 In Development
**Version**: 0.1.0-dev
