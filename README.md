# What Changed?

A learning site for students in grades 7–9. You solve a maths problem your own way. Then the app gives you an almost identical question where **one thing changes**: you **guess** whether your method still works, **see what happens**, and pick **why**. Then a **new question** on your own shows whether it stuck.

It is built for the CSC Back-to-School Hackathon.


---

## What a session looks like

Every step has a plain name and a one-line "what you do here" banner, written for students in grades 7–9.

1. **Try it**: Solve the problem and show your working: **type it, or draw it on the whiteboard** (pen, eraser, undo; works with a mouse, finger or stylus). With AI on, the app reads your board and writes it out as text for you to check and correct before anything else uses it. (Stuck? "I don't know where to start" gives a short refresher.)
2. **Check**: The app restates what it thinks you did, quoting your exact words as evidence. You confirm it or pick what you actually did. Then one quick question, such as *"Did the car spend the same time at each speed?"*
3. **Test it**: Your question (A) sits next to an almost identical question (B), with the one difference highlighted.
   - **Guess** where your method gives the right answer: both, only A, only B, or neither.
   - **See what happens**: a picture (time bars, substitution table or cost bars) and the right answer for each question. A **"Why? Show me the maths"** button explains each question step by step with its own numbers (written by the app, not the AI).
   - **Why?** Pick the best reason from a few choices, then optionally put it in your own words for AI feedback.
4. **Your turn**: A new question with the same idea, with the same **Type | Draw** choice as Try it. Getting it right is how you show you've fixed your method. Hints appear only if you ask ("I'm stuck") or get it wrong. The outcome is recorded honestly as *Completed independently*, *with a hint*, *after explanation* or *Not yet*. An optional bonus "one thing changes" question follows.
5. **Results**: Built only from what you did: your first try, your guess, the reason you picked, your own words, and how your turn went. You can print it or save it as a PDF.

The route adapts to your attempt:

| Your attempt | Route |
| --- | --- |
| Right answer and a sound method | **Extend**: test the method, then your turn |
| Sound method with a calculation slip | **Find the slip**: step-by-step checks, then test it, then your turn |
| Shortcut that relies on an assumption, unclear method, or no attempt | **Explore**: test it, then your turn |
| Ambiguous answer (e.g. "40 or 45") | **Clarify** first; never force a diagnosis |

### The three checked concept packs

| Pack | Shortcut under test | Visual test |
| --- | --- | --- |
| **Average speed**: equal distances vs equal times | Averaging the two speeds (works only with equal *times*) | Time bars on the same scale |
| **Cancelling in fractions**: factors vs terms | Crossing out the x's (works only when x is a *factor*) | Substitution table, including "one match isn't proof" |
| **Proportional reasoning**: proportional vs fixed fee | Scaling the whole cost (works only with *no fixed fee*) | Stacked cost bars with the fee shaded |

Every pack contains its own reference answers, accepted alternative methods, hint ladders, contrast cases, transfer problems and an answer checker. The expression checker uses a small, safe parser of its own and never uses `eval`. **The AI never decides whether an answer is right.**

---

## How AI is used (and isn't)

The app calls an AI model from the server for five narrow tasks. It supports **Google Gemini** (free tier available), any other **OpenAI-compatible** provider (e.g. Featherless.ai, Backboard.io), or **Anthropic Claude**; see `.env.example`. Each task returns JSON that is validated against a schema:

| Task | What the AI does | What the app checks afterwards |
| --- | --- | --- |
| `assess_attempt` | Maps your working to one of the pack's approved methods and quotes the words that show it | The method ID must be on the approved list. Every quote must appear in your text, or it is dropped. With no valid quote, confidence is set to low. |
| `interpret_question` | Reads a question you typed into a supported pack's numbers | The numbers are re-validated by the pack. Unsupported questions are refused, never replaced. |
| `reflect_feedback` | Short feedback on your explanation and whether it names the condition | The quote must be real. Only approved hint IDs can be suggested. |
| `session_summary` | A 3–4 sentence report summary | It is grounded in recorded facts, and quotes are checked against your text. |
| `read_board` | Transcribes the whiteboard image into text, exactly as written (mistakes kept, nothing solved) | Only small PNG/JPEG images are accepted. **The student checks and edits the transcript**; the app then uses that confirmed text, never the image, for method detection and quotes, so every quote still comes from words the student approved. |

Classification (for example *wrong assumption* vs *wrong, unclear*) is **deterministic** (`shared/policy.ts`). A "wrong assumption" label needs both the shortcut answer *and* evidence of the assumption, either from the method you confirmed or from your diagnostic answer.

**Demo mode** applies when no API key is set or `AI_MODE=demo`. In demo mode, no AI calls are made and the same flow runs on the app's checked rules. The header always shows **"Demo mode · no AI calls"** or **"AI on · model"**. Every piece of guidance is tagged *AI reading · checked by the app*, *Checked guidance*, or *Checked guidance (AI unavailable)*. If the AI fails mid-session, you keep your progress and get labelled fallback guidance. The app never pretends an AI call happened.

Server-side details (`api/_lib/handler.ts`):
- The API key is read only on the server and never sent to the browser.
- Request size is limited to 12 kB (600 kB for a whiteboard image, which is downscaled to a 1200×675 JPEG first, usually well under 150 kB).
- Rate limit: 30 requests per minute per IP (in memory, per instance).
- **Saving AI requests** (`api/_lib/saver.ts`, on by default; `AI_SAVER=off` disables it). Free tiers limit requests per minute and per day, so the server avoids calls it doesn't need:
  - *Checked-first:* if the app's own rules confidently identify the method (with the student's exact words as evidence), or can read a typed question themselves, that answer is used and labelled **Checked guidance**. No AI call is made.
  - *Cache:* an identical request (e.g. the demo sample attempt, clicked by several judges) reuses the earlier AI answer for up to an hour.
  - *No "thinking" on Gemini Flash:* the request sets `reasoning_effort: "none"`, so answers are faster and use fewer tokens. If a provider rejects it, the server retries without it.
  - A typical session now makes about 1–3 AI requests (feedback on your own words, the results summary, and reading a whiteboard if you draw), down from 4–5.
- Timeout is 20 s, with 1 retry.
- Student text is wrapped as data, and the prompt says never to follow instructions inside it.
- **OpenAI-compatible providers (Gemini etc.)** — `api/_lib/openaiCompat.ts`:
  - The app first asks for strict JSON-schema output. If the provider rejects that, it falls back to JSON mode with the schema written into the prompt.
  - Every response is validated with Zod.
  - Rate limits and server errors get one retry.
- **Anthropic:** the default model is `claude-opus-5-5`; change it with `AI_MODEL`. The request enables Anthropic's **server-side refusal fallback** (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`). If the main model declines a request, Anthropic may retry it on a fallback model. If your account doesn't accept that beta, the server retries once without it.

## Privacy

- No accounts, no names and no personal information are collected. The start page asks students not to type personal details.
- Nothing is stored: there is no database, no cookies and no analytics, and refreshing the page clears the session.
- **When AI is on, what the student types, and a picture of the whiteboard if they choose to draw, is sent to the configured AI provider.** Whiteboard images are kept in the page's memory only and never stored. The start page asks students not to write or draw their name. The start page and header name the provider. Server logs record only the task name and a short error reason, never the student's text.
- **Check your provider's data terms.** For example, on Gemini's *free* tier Google may use submitted content to improve its products, and people may review it. For a real classroom deployment, use a paid tier or a provider that doesn't train on API data.

---

## Run it on your computer (beginner steps)

You need **Node.js 20 or newer** (we used 24). Check with `node -v`.

1. Open the project folder in a terminal. In Windows File Explorer, open the `HACKATHON1` folder, click the address bar, type `powershell`, and press Enter. A PowerShell window opens in that folder.
2. Install the dependencies (first time only):
   ```bash
   npm install
   ```
3. Start the site:
   ```bash
   npm run dev
   ```
   The terminal prints `Local: http://localhost:5173/`. Open that address in your browser. Leave the terminal open while you use the site, and press `Ctrl + C` to stop it.

The site starts in **demo mode**. To turn AI on:

4. Get a free Gemini API key at https://aistudio.google.com/apikey.
5. Copy `.env.example` to a new file called `.env` in the same folder. Under **Option A**, remove the `#` from the three lines and paste your key after `AI_API_KEY=`. Never share this file; it is already in `.gitignore`.
6. Stop the server (`Ctrl + C`) and run `npm run dev` again. The header should now say **AI on · gemini-…**.

Other providers work the same way: use Option B (e.g. Featherless) or Option C (Anthropic) in `.env.example` instead.

Other commands:

```bash
npm test
```
Runs 55 automated checks: the maths, every pack, the classification policy, quote validation, the API handler, the provider adapter, whiteboard reading, request saving and the calculator.

```bash
npm run build
```
Type-checks the code and builds the production site into `dist/`.

## Deploy to Vercel

1. Put the project on GitHub. Install Git if needed (`winget install Git.Git`), create an empty repository on github.com, then in the project folder run `git init`, `git add .`, `git commit -m "What Changed?"`, `git branch -M main`, `git remote add origin <your repo URL>` and `git push -u origin main`.
2. Go to https://vercel.com, sign in with GitHub, choose **Add New → Project**, and import the repository. Vercel detects Vite. The `vercel.json` file sets the build, and the files in `api/` become server functions automatically.
3. Optional: to turn AI on, open **Settings → Environment Variables** and add the same variables as your `.env` (for Gemini: `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`). Then redeploy. Without them, the live site runs in demo mode.
4. Open the deployed URL and check the header badge.

---

## Demo script (about 2 minutes)

1. **(0:00) Start page.** "What Changed? helps a student find the condition that makes their own method work." Point at the badge: demo mode or AI on.
2. **(0:10) Average speed → Start → "Fill in a sample student attempt"** (45 km/h by averaging the speeds) **→ Continue.**
   *Optional whiteboard moment (AI on):* choose **Draw** instead, write "30 + 60 = 90" and "90 ÷ 2 = 45", click **Read my board**, and show the transcript you can correct. Then continue as normal.
3. **(0:25) Check.** The app quotes the student's own words, "(30 + 60) ÷ 2". Click **Yes, that's it**, then "Yes, the same time at each speed", which shows the hidden assumption.
4. **(0:40) Test it.** Question B changes only one thing: equal distances become equal times (highlighted). Guess **"On both questions"**, then click **Show me what happens**. The time bars show 2 h vs 1 h in A against equal bars in B: averaging fails in A and works in B. "Surprise!" — that's the learning moment.
5. **(1:05) Why?** Pick "When the time spent at each speed is equal" and see the explanation. Optionally type "It works when the car drives for the same time at each speed" and click **Check my words**.
6. **(1:20) Your turn** (cyclist, 12 km at 12 and 6 km/h). Answer 8 → **You got it on your own!** Optionally open the bonus.
7. **(1:40) Results.** First try, the guess, the reason picked, the student's own words as evidence, and how their turn went. Close with: "The AI reads the reasoning; the app checks the maths."

## Completed features

- Three complete concept packs, each with an example, a contrast question, a "why" question, a quick check question, hint ladders, slip steps, three practice questions, a bonus and a harder case.
- All three entry paths (extend, slip, explore), the clarify step, and "I don't know where to start" with a refresher.
- A simple "Test it" step for each pack: one guess → see what happens (with a picture) → pick the reason.
- Plain step names, a one-line explainer on every step, and friendly wording aimed at grades 7–9 (the AI is told to write the same way).
- Hints on demand ("I'm stuck", hint 1, hint 2, "Show explanation"), with hint use recorded in the results.
- Typed own questions are read into a pack (checked parser, or AI with re-validation). Unsupported questions get an honest refusal, and inconsistent numbers are flagged.
- An evidence-based report that can be printed or saved as a PDF. It only shows AI quotes that appear in the student's text.
- Live and demo modes with visible labels, labelled fallback when the AI fails, size limits, rate limiting and timeouts.
- A **🧮 calculator** in Try it and Your turn (keypad or keyboard; + − × ÷, brackets, ^, √, %). It uses its own safe evaluator (no `eval`), keeps your last 5 calculations, and can add a line like "30 + 60 = 90" straight into your working.
- A whiteboard for showing working in **Try it** and **Your turn**, with AI transcription that the student checks before it is used. In demo mode the board still works for thinking, and the student types their main steps.
- A "maths workbook" design: ivory graph-paper background, crimson ink with oxblood panels for contrast, Fraunces headings, Atkinson Hyperlegible body text (designed for readability) and IBM Plex Mono for numbers and working. A Δ ("change") logo, a phone-width layout, keyboard focus styles and print styles. Light theme only.

## Known limitations

- **Only three concepts.** Questions outside them are declined, not guessed.
- **The typed-question parser is narrow.** It handles common phrasings; unusual wording may need the AI path or rewording.
- The expression checker supports one variable (x), integer powers up to 8, and the forms listed above.
- The rate limiter is in memory, so each server instance counts separately. That's fine for a demo, but not production-grade.
- No saved progress or accounts, by design.
- **Whiteboard:** in Try it and Your turn (not in Test it, which is multiple choice). Reading it needs AI (demo mode asks for typed steps instead). Messy handwriting can be misread; that's why the student checks the transcript. On phones the board is small, so short working fits best.
- The hint and feedback text is written by us and has not yet been reviewed by a teacher, and no classroom pilot has been run yet.

## Blocked or untested integrations

- **Live AI has been tested with Google Gemini (gemini-2.5-flash)** on all five tasks, including a prompt-injection attempt and reading a drawn board ("30 + 60 = 90 / 90 / 2 = 45" was transcribed exactly). **Anthropic and Featherless/Backboard have not been tested live** (no keys); their code paths are type-checked and covered by mocked tests.
- **Gemini free-tier limits:** the free tier allows only about 10 requests a minute (each board read or "Continue" is one), so fast clicking or several judges at once can hit it. The app then says the AI is busy and shows labelled checked guidance; reading the board can be retried after a minute. For judging, a paid key or a second provider avoids this.
- **The Vercel deployment has not been done yet.** It needs the team's Vercel and GitHub accounts.

## Project structure

```
api/            Vercel server functions: /api/tutor, /api/status (+ _lib: handler, prompts, schemas, rate limit, config)
shared/         Code used by both server and browser
  packs/        speed.ts, cancel.ts, proportion.ts — the checked concept packs
  math/         safe expression parser + polynomial arithmetic
  ai.ts         AI task contract, sanitisers, checked (demo) implementations
  policy.ts     deterministic classification and routing
src/            React app: views (Start, Workspace, Report), stages, visuals
tests/          Vitest tests
```

## Credits

- Built with React, Vite, TypeScript, Zod and the Anthropic TypeScript SDK, with an OpenAI-compatible adapter for Gemini and other providers. Designed for deployment on Vercel.
- The ideas draw on variation theory (contrasting cases), diagnostic questions, and research on learning from erroneous examples (see the links in the project brief).

## AI-use disclosure

- **In the product:** the configured AI model (Gemini, or Claude or another provider) reads students' working and explanations in live mode, as described above.
- **In development:** this codebase was written with the help of Claude Code (an AI coding assistant), directed and reviewed by the team. The team should be ready to explain each part. The best places to start are `shared/policy.ts`, `shared/ai.ts` and one pack.
