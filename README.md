# 📑 AI PDF Assistant

Upload a PDF, extract its text **entirely in the browser**, and chat with its
contents using a lightweight simulated RAG (Retrieval-Augmented Generation)
retrieval engine.

Built with **React (Vite)**, **pdfjs-dist**, and **Axios**.

---

## ✨ Features

- 📤 Upload PDFs (drag & drop or click)
- 🧾 Display PDF name, page count, size, and word count
- 🔍 Extract all text from every page (in-browser, via `pdfjs-dist`)
- 📜 Scrollable extracted-text preview
- 💬 ChatGPT-style chat interface with chat bubbles
- 🧠 Ask questions → simulated RAG finds the most relevant paragraphs
- ⏳ Loading spinner / typing indicator while answering
- 🧹 Clear the PDF and chat history
- 📱 Responsive layout (desktop & mobile)

### Bonus

- 🌙 Dark mode toggle (persisted to `localStorage`)
- ⬇️ Download chat history as a `.txt` file
- ✨ One-click PDF summary
- 📋 Copy any AI answer to the clipboard

---

## 🗂️ Project Structure

```
ai-pdf-assistant/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── components/
    │   ├── Header.jsx
    │   ├── PdfUploader.jsx
    │   ├── PdfViewer.jsx
    │   ├── ChatBox.jsx
    │   └── Message.jsx
    ├── services/
    │   ├── pdfService.js     # PDF text extraction (pdfjs-dist)
    │   └── aiService.js      # Simulated RAG retrieval + helpers (Axios)
    └── styles/
        ├── index.css         # globals + theme variables
        ├── App.css
        ├── Header.css
        ├── PdfUploader.css
        ├── PdfViewer.css
        ├── ChatBox.css
        └── Message.css
```

---

## 🚀 Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Run the development server

```bash
npm run dev
```

Then open the URL printed in the terminal (default
[http://localhost:5173](http://localhost:5173)).

### 3. Build for production (optional)

```bash
npm run build
npm run preview
```

---

## 🧠 How the "AI" works

The app runs in **two modes**, decided automatically in
`src/services/aiService.js`:

### Mode A — No key (default): local keyword RAG

1. The extracted PDF text is split into paragraph **chunks**.
2. Each chunk is scored against your question by **keyword overlap** plus an
   exact-phrase bonus.
3. The top-scoring paragraphs are returned as the answer.

### Mode B — Real GPT via your OpenAI API key

If `VITE_OPENAI_API_KEY` is set, `answerQuestion()` instead:

1. Retrieves the top 5 relevant PDF passages locally (keeps the prompt small
   and cheap).
2. Sends those passages + your question to the **OpenAI Chat Completions API**
   using **Axios** (`askOpenAI()`).
3. Returns GPT's grounded answer. If the API call fails, it gracefully falls
   back to Mode A.

#### Setup

```bash
# 1. Copy the example env file
cp .env.example .env        # Windows: copy .env.example .env

# 2. Edit .env and add your key
VITE_OPENAI_API_KEY=sk-...your key...
# optional:
VITE_OPENAI_MODEL=gpt-4o-mini

# 3. Restart the dev server (Vite only reads .env at startup)
npm run dev
```

Get a key at <https://platform.openai.com/api-keys>.

#### The Axios call (simplified)

```js
await axios.post(
  'https://api.openai.com/v1/chat/completions',
  {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'Answer using only the PDF excerpts...' },
      { role: 'user', content: `PDF excerpts:\n${chunks}\n\nQuestion: ${q}` },
    ],
    temperature: 0.2,
  },
  { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
)
```

> ⚠️ **Note:** Vite inlines every `VITE_*` variable into the browser bundle,
> so the key is visible in a deployed site. That's fine for local use and demos
> — just don't publish a public site with your real key baked in.

---

## 📝 Notes

- Text extraction works on **text-based PDFs**. Scanned/image-only PDFs contain
  no selectable text and will return an empty result (OCR is out of scope).
- Maximum upload size is capped at **50 MB** to keep the browser responsive.
