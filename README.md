# Scribe ✍️

Scribe is a premium, full-stack web application designed to turn YouTube videos into polished, SEO-optimized blog posts in seconds. Powered by AI and TanStack Start, Scribe helps content creators and marketers repurpose video content into high-ranking, readable written articles.

---

## 🚀 Key Features

*   **YouTube to Blog Conversion:** Paste a YouTube URL, extract transcripts/audio, and generate structured, markdown-formatted blog articles.
*   **Brand Voice Customization:** Customize and save your brand's unique tone, target audience, and formatting preferences.
*   **Rich Text Inline Editor:** Fine-tune generated content in real-time with an intuitive, document-style editor.
*   **SEO Score Dashboard:** Analyze readability, keyword density, headings, meta descriptions, and get actionable suggestions to rank on search engines.
*   **Batch Queueing:** Repurpose multiple YouTube videos at once with background queues.
*   **Multi-Workspace Folders:** Organize your generation history and blog posts into workspace folders.
*   **Publishing Integrations:** Push completed articles to CMS platforms directly from the application.

---

## 🛠️ Technology Stack

*   **Frontend & SSR:** React 19, [TanStack Start](https://tanstack.com/router/v1/docs/start/overview) (for file-based routing, server functions, and Server-Side Rendering)
*   **Styling:** Tailwind CSS (modern, utility-first styling)
*   **Database & Auth:** [Supabase](https://supabase.com/) (User authentication, settings, folders, and generation history)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Testing:** [Playwright](https://playwright.dev/) (End-to-end browser testing)
*   **Deployment Targets:** Cloudflare Pages (Edge Worker + Static Assets) or Render / Node.js Web Service

---

## 💻 Local Setup & Development

### 1. Prerequisites
Make sure you have Node.js (v18+) and npm installed.

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory (you can copy the structure from `example.env`):
```env
SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-key"
SUPABASE_URL="your-supabase-url"
VITE_SUPABASE_PROJECT_ID="your-supabase-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-key"
VITE_SUPABASE_URL="your-supabase-url"
SUPADATA_API_KEY="your-supadata-api-key"
OPENROUTER_API_KEY="your-openrouter-api-key"
```

### 4. Start the Dev Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🧪 Testing

Scribe uses Playwright for end-to-end and regression testing.

Run all tests:
```bash
npx playwright test
```

Run tests in UI mode:
```bash
npx playwright test --ui
```

---

## 🌐 Deployment Guides

### Option A: Deploying to Cloudflare Pages (Native & Recommended)
The codebase includes a `wrangler.jsonc` and uses the `@cloudflare/vite-plugin` out of the box, making Cloudflare Pages the native hosting choice (zero cold-starts, global edge locations, completely free).

#### CLI Deployment:
```bash
# 1. Build the production build (defaults to Cloudflare target)
npm run build

# 2. Deploy to Cloudflare Pages
npx wrangler pages deploy dist/client
```

---

### Option B: Deploying to Render (Node.js Web Service)
To run this server on a standard Node.js environment like Render, you will use the pre-configured conditional build option and the custom Node.js runner (`serve-node.js`).

1.  Connect your Git repository on the [Render Dashboard](https://dashboard.render.com/).
2.  Create a **Web Service** with the following settings:
    *   **Runtime:** `Node`
    *   **Build Command:** `CLOUDFLARE=false npm install && CLOUDFLARE=false npm run build`
    *   **Start Command:** `node serve-node.js`
3.  Add the environment variables in your Render Service dashboard:
    *   `SUPABASE_PUBLISHABLE_KEY`
    *   `SUPABASE_URL`
    *   `VITE_SUPABASE_PROJECT_ID`
    *   `VITE_SUPABASE_PUBLISHABLE_KEY`
    *   `VITE_SUPABASE_URL`
    *   `SUPADATA_API_KEY`
    *   `OPENROUTER_API_KEY`
    *   `CLOUDFLARE` = `false` *(crucial to output Node.js compatible builds)*

#### Using Render Blueprint (Fastest)
A `render.yaml` file is included in the root of the project. To deploy using the Blueprint:
1. Go to the **Blueprints** page in the Render dashboard.
2. Click **New Blueprint Instance**.
3. Connect your repository.
4. Render will automatically configure the Web Service and prompt you to input the values for the required environment variables.

