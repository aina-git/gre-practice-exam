# GRE Ready

GRE General Test practice with published timing, adaptive practice sets, and an optional AI Teacher. One HTML file that runs in any browser, as a phone home-screen app, or as a desktop app.

**Use it now:** https://aina-git.github.io/gre-practice-exam/

## What it does

- **Full practice simulation** — one Issue essay, two Verbal and two Quant sections with published section counts and 118 minutes of section time. Every mode has Pause and Resume. Teaching pauses the clock; closing or reloading saves a paused copy. Questions, answers, flags, completed sections, and remaining time are preserved.
- **Practice questions** — generated quantitative questions and a rotating verbal bank. Reading passages have one question per screen, including single-answer, multiple-answer and sentence selection. Full quantitative sets include two-box fraction entry. Questions can repeat, and the bank’s difficulty labels are not calibrated to ETS.
- **AI Fresh Verbal** — original questions must pass response-format checks, a separate answer-key-blind solve, and an automated review of the key and each choice rationale. This automated screen can miss errors; it is not human review or ETS calibration.
- **Honest timing** — the clock is a wall-clock deadline (switching apps never adds time), every question's time is recorded, and results show your pacing against the real test's budget.
- **Learn Mathematics** — six worked foundation lessons reveal one step at a time, explain each calculation, and offer a question for the learner to try. These lessons work without an AI key. The live teacher accepts arbitrary maths questions, gives hints, asks comprehension questions, and can teach the current practice question before submission.
- **Tools and feedback** — mark and review questions within the current section, change answers before submission, use timed section help, hide the timer, and use a basic quantitative calculator with precedence, parentheses, square roots, memory and display transfer to single-box numeric answers. The optional AI Teacher receives the stored answer key, but AI explanations can still be wrong.
- **Your data stays yours** — scores and settings are saved on your device (Settings → Backup moves them between devices). No account, no password.

### AI (optional, your own key)

Gemini and Groq offer free keys. OpenAI and Anthropic API keys work (note: a ChatGPT or Claude.ai subscription does not include API access). OpenRouter gives access to many models with one key. A local model via Ollama or LM Studio works with no key, on the computer running it. Multiple-choice and numeric grading use stored answer keys. Optional writing feedback uses separate AI calls and a 0–6 practice rubric. Essays receive no automatic score based on length or keywords.

### GPT-6.1 Terra with High reasoning

On this Mac, double-click **Start GRE Terra.command**, or run `node server.mjs` with Node.js 22 or newer. Open [the local app](http://127.0.0.1:8787), choose **Connect AI**, enter your OpenAI API key, and click **Connect AI and start teaching**. The local connection is fixed to `gpt-6.1-terra` with `reasoning.effort: high` for the AI Teacher, essay feedback, study coach, and generated verbal items. Quant answer keys remain computed by the existing engine.

The local server keeps the key in memory and sends it only to OpenAI. It does not write the key to browser storage, backups, or files. Restarting the server clears a key entered in Settings. Alternatively, start the server with `OPENAI_API_KEY` already set in its environment. The server binds only to `127.0.0.1` and rejects other web origins. It is a personal local service, not a public hosting configuration.

The static app uses the same simple Connect AI dialog for direct OpenAI requests. It keeps the key for the current page session unless the learner explicitly selects **Remember this key on this device**. Other providers remain under Advanced AI settings. The local and online apps have separate browser storage; use the existing Backup controls to move practice history. Existing provider selections remain available under Advanced AI settings. This source must be published before those changes appear on GitHub Pages.

OpenAI requests use the Responses API, omit sampling parameters during reasoning, reserve an output budget that includes reasoning tokens, and report unfinished or refused responses as errors. High reasoning can take longer and use more tokens. There is no fallback to a different model. A live successful connection requires an API key whose account can access the requested model.

References: [GPT-6.1 Terra model](https://developers.openai.com/api/docs/models/gpt-6.1-terra), [GPT-6 migration parameters](https://developers.openai.com/api/docs/guides/latest-model#migration-quickstart), [reasoning and token budgets](https://developers.openai.com/api/docs/guides/reasoning).

Run the connection checks with `node --test tests/terra-connection.test.mjs`. These use mocked OpenAI responses to check routing, error handling, key isolation, and request parameters; they do not demonstrate live account access.

## Question pool and repetition

The embedded bank contains **418 written verbal questions** (including reading subquestions), **36 Issue prompts**, and **80 quantitative generator templates**. Maths templates produce many numerical variations; this count describes templates, not 80 calibrated difficulty levels or a guaranteed number of distinct problem types. The added written bank has 100 original questions in `content/verbal-expansion.json`; `node scripts/sync-content.cjs` embeds it into the offline HTML after content edits.

Written items and essay prompts rotate toward unseen content before reuse. Generated quantitative practice prefers instances absent from the last 5,000 stored fingerprints. Finite pools and generator families can repeat. New questions and difficulty labels have not undergone external editorial or psychometric calibration.

## Desktop app (Mac and Windows)

Download from the **Releases** page:

- **Mac** — `GRE-Ready-…-mac-arm64.dmg` for Apple Silicon (M1/M2/M3/M4) or `…-mac-x64.dmg` for Intel. Open it and drag **GRE Ready** into **Applications**. The app is not signed with an Apple developer certificate, so the first launch says it "cannot be opened": go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway** (older macOS: right-click the app → **Open**). Once.
- **Windows** — `…-windows-setup.exe` (installer) or `…-windows-portable.exe` (no install). SmartScreen may warn because the app is unsigned: **More info → Run anyway**.

The desktop app is the same `index.html`, works fully offline, and keeps its own scores.

### Build or run it yourself

```bash
cd desktop
npm install
npm start            # run in development
npm test             # launches the real app and checks pause-on-close / resume
npm run build:mac    # or build:win / build:linux — installers land in desktop/dist
```

To publish installers: run the **Desktop app** workflow from the Actions tab (artifacts), or push a tag such as `desktop-v3.0.0` to create a GitHub Release with the installers attached.

## Practice scores and exam fidelity

Raw accuracy and pacing are the primary progress measures. The existing 130–170 internal scoring formula is retained for history continuity and explicitly labelled **uncalibrated**. The route thresholds, difficulty labels, score caps and formula are app choices, not ETS parameters. No percentile or prediction error guarantee is provided. Existing history and settings are preserved. Older saved sessions retain their original study-style recovery behavior.

Use [ETS POWERPREP](https://www.ets.org/gre/test-takers/general-test/prepare/powerprep.html) for an official practice benchmark. This app uses original practice content and does not reproduce the confidential question bank, calibrated difficulty, proprietary scoring, or the exact POWERPREP interface.

See the [question-content standard](docs/Question%20content%20standard.md) for the item-writing, review, and score-reporting criteria.

See [the source-linked fidelity audit](docs/Exam%20fidelity%20audit.md) for requirements, differences and verification limits.

## Development

The whole web app is `index.html` — no build step. Open it in a browser, or serve the folder with any static server. GitHub Pages deploys `main` automatically.

Run the dependency-free engine checks with:

```bash
node tests/exam-engine.test.cjs
```

An optional GitHub Actions template is provided in [docs/Exam checks workflow.yml](docs/Exam%20checks%20workflow.yml). It is not active. The suite covers section counts, ordering, response formats, deadlines and recovery, calculator arithmetic, practice pause/resume, and honest score labels. It does not establish that the full question bank is psychometrically equivalent to ETS.

Practice simulation for study purposes. Not affiliated with ETS.
