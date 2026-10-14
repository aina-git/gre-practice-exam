# GRE Ready

GRE General Test practice with published timing, adaptive practice sets, and an optional AI Teacher. One HTML file that runs in any browser, as a phone home-screen app, or as a desktop app.

**Use it now:** https://aina-git.github.io/gre-practice-exam/

## What it does

- **Full exam mode** — one Issue essay, two Verbal and two Quant sections with the published 118-minute timing. Writing comes first. The remaining order varies, with each measure’s first section preceding its second. Sections advance automatically without a scheduled break. The current section clock keeps running through dialogs, reloads and app closure. Difficulty labels and pacing coaching are hidden during the exam.
- **Practice questions** — generated quantitative questions and a rotating verbal bank. Reading passages have one question per screen, including single-answer, multiple-answer and sentence selection. Full quantitative sets include two-box fraction entry. Questions can repeat, and the bank’s difficulty labels are not calibrated to ETS.
- **Honest timing** — the clock is a wall-clock deadline (switching apps never adds time), every question's time is recorded, and results show your pacing against the real test's budget.
- **Study at your pace** — study sets and drills can pause and resume. Full exam mode can only continue or end as a partial attempt. If the current section expires while the app is closed, it is submitted when you return. Later sections start on return, so leaving the app can extend the overall session.
- **Tools and feedback** — mark and review questions within the current section, change answers before submission, use timed section help, hide the timer, and use a basic quantitative calculator with precedence, parentheses, square roots, memory and display transfer to single-box numeric answers. The optional AI Teacher receives the stored answer key, but AI explanations can still be wrong.
- **Your data stays yours** — scores and settings are saved on your device (Settings → Backup moves them between devices). No account, no password.

### AI (optional, your own key)

Gemini and Groq offer free keys. OpenAI and Anthropic API keys work (note: a ChatGPT or Claude.ai subscription does not include API access). OpenRouter gives access to many models with one key. A local model via Ollama or LM Studio works with no key, on the computer running it. Multiple-choice and numeric grading use stored answer keys. Optional writing feedback uses independent AI passes and a 0–6 practice rubric. Essays receive no automatic score based on length or keywords.

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

See [the source-linked fidelity audit](docs/Exam%20fidelity%20audit.md) for requirements, differences and verification limits.

## Development

The whole web app is `index.html` — no build step. Open it in a browser, or serve the folder with any static server. GitHub Pages deploys `main` automatically.

Run the dependency-free engine checks with:

```bash
node tests/exam-engine.test.cjs
```

An optional GitHub Actions template is provided in [docs/Exam checks workflow.yml](docs/Exam%20checks%20workflow.yml). It is not active. The suite covers section counts, ordering, response formats, deadlines and recovery, calculator arithmetic, practice pause/resume, and honest score labels. It does not establish that the full question bank is psychometrically equivalent to ETS.

Practice simulation for study purposes. Not affiliated with ETS.
