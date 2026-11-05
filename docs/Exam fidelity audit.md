# GRE General Test exam fidelity audit

**November 5, 2026 update:** At the learner’s request, every practice mode now supports a genuine paused clock, including full simulation. Opening the teacher pauses the current question; closing or reloading saves a paused snapshot. Teaching is available before submission, and the learner can request hints, one-step instruction, or a full solution. The October 14 timing and no-pause observations below are historical and superseded by this change. Current checks cover repeated pause/resume through all five sections and preservation of completed work. The app is a learning and practice tool; pausable, assisted attempts do not reproduce uninterrupted test-day conditions.

The bank now has 418 written verbal questions, 36 Issue prompts, and 80 maths generator templates. These counts are content inventory, not proof of equivalent ETS difficulty. A live GPT-6.1-Terra response remains unverified until API access is supplied.

Reviewed against ETS public materials on October 14, 2026. This is an independent practice implementation. It is not affiliated with ETS. The authenticated POWERPREP application and paid tests were not accessed. Requirements below come from ETS's published pages and calculator guide, rather than inspection of proprietary software or source code.

## Published requirements and implementation

| Measure | Questions | Time | Implementation |
| --- | ---: | ---: | --- |
| Analytical Writing | 1 Issue task | 30 minutes | First section, basic text editor, task-specific directions |
| Verbal 1 | 12 | 18 minutes | Exact count, one reading question per screen |
| Verbal 2 | 15 | 23 minutes | Exact count, practice route based on Verbal 1 |
| Quantitative 1 | 12 | 21 minutes | Exact count, calculator and numeric-entry controls |
| Quantitative 2 | 15 | 26 minutes | Exact count, practice route based on Quantitative 1 |

The five section budgets sum to 118 minutes. After writing, the implementation varies the order of the two measures while preserving each measure's first-to-second order. The outdated 10-minute scheduled break has been removed.

[ETS test structure](https://www.ets.org/gre/test-takers/general-test/prepare/test-structure.html) specifies the counts, timings, writing-first order, section adaptation, and within-section navigation, mark/review and answer changes. ETS describes the first section of each measure as average difficulty. The app's medium label is a bank label and does not establish equivalent difficulty.

[ETS verbal guidance](https://www.ets.org/gre/test-takers/general-test/prepare/content/verbal-reasoning.html) describes Text Completion, Sentence Equivalence and three reading response formats. Approximately half the measure is passage-based. Reading multiple-answer questions have three choices, with one to three correct answers and no partial credit. Sentence selection operates on the passage text. This implementation adds three original passages with six format-practice questions, preserves passage blocks, trims reading sets to their allocated question budget, and limits Sentence Equivalence to two selections. These new format-practice passages are not calibrated GRE difficulty items.

[ETS quantitative guidance](https://www.ets.org/gre/test-takers/general-test/prepare/content/quantitative-reasoning.html) identifies arithmetic, algebra, geometry and data analysis. It describes quantitative comparison, single-answer, multiple-answer and numeric entry, with data interpretation sets. The implementation retains the existing generator families and adds two-box fraction entry, accepting equivalent fractions. Numeric grading rejects suffixes, units, percentages, expressions and invalid fractions instead of accepting a numeric prefix.

[ETS calculator guide](https://www.ets.org/content/dam/ets-org/pdfs/gre/on-screen-calculator-guidelines.pdf) specifies order of operations, parentheses, square roots, memory, display transfer to a single-box numeric question, eight-digit display limits, overflow errors, and very small positive results displayed as zero. The app implements a bounded parser, rather than evaluating code. The calculator is available only on quantitative questions. Its visual layout is an independent design, not a pixel-identical copy.

[ETS writing guidance](https://www.ets.org/gre/test-takers/general-test/prepare/content/analytical-writing.html) describes a 30-minute Issue task with prompt-specific directions and a basic word processor without spellcheck or grammar tools. The implementation disables browser spellcheck and hides word count in full exam mode. Claim/reason and two-view prompts receive matching directions. No length-based score is assigned. Optional AI feedback is labelled as practice feedback.

[ETS test-center guidance](https://www.ets.org/gre/test-takers/general-test/test-day/test-center-test-day.html) and the [GRE information bulletin](https://www.ets.org/content/dam/ets-org/pdfs/gre/gre-info-bulletin.pdf) are the authoritative references for test-day procedures. An independent browser app does not simulate check-in, proctoring, scratch-paper rules, score reporting or test-security controls.

## Timing and recovery decisions

- Full simulation uses an absolute deadline for the current section. Opening help, reviewing questions, opening an exit dialog, changing tabs or reloading does not pause it.
- Sections begin automatically after submission or expiry, with no coaching intermission. This is a practice implementation choice. The exact official transition screens and their timing were not inspected.
- If the app is closed beyond a section's deadline, that section is submitted on return. Later sections start when the user returns. This preserves the current section's deadline but does not enforce a single 118-minute overall wall-clock limit across app closure.
- In-progress snapshots now preserve completed sections' essay text, answer review detail and pacing, rather than retaining only score summaries. Study modes remain pausable. Legacy snapshots retain their earlier recovery behavior.
- The timer can be hidden, with the remaining time shown automatically during the last five minutes. This is a practice control, not a claim about exact official timer behavior.

## Scoring and remaining limits

Raw answer-key accuracy is deterministic. Multiple-answer and multiple-blank items require all correct selections. A fixed key can itself be wrong. The full bank was not independently re-solved in this update.

The 130–170 practice score formula is retained for continuity, with explicit disclosure. Routing at 72% and 42%, score caps of 170/162/152 and the curve exponents are internal choices. They are not verified ETS parameters. Unsupported calibration, percentile, score-error and zero-hallucination claims have been removed. The app does not prove equivalent exam difficulty or reproduce official scores.

Optional AI essay feedback uses independent model passes, not ETS's grading process. No external AI calls were used for validation. Existing official-looking or adapted prompts in the inherited bank were not audited for licensing. New reading passages are original. For a direct benchmark, use [official POWERPREP](https://www.ets.org/gre/test-takers/general-test/prepare/powerprep.html).

The interface retains GRE Ready's existing design. More realistic controls do not make it a replica of the exact test-day interface. The inherited bank and generator coverage do not establish every topic, graph type or difficulty distribution encountered on test day.

## Validation

- Dependency-free Node suite: 17 test groups, including 300 generated verbal sections and 300 quantitative sections checked for the 12/15 budgets across three practice levels, plus checks for ordering, formats, calculator precedence and limits, recovery, pausing and score labels.
- Local browser checks: full five-section flow with a submitted essay, 54 answer-keyed objective responses and 55 review cards. Recovery retained the essay and original section deadline. These fixtures test software behavior, not question difficulty.
- Real browser interactions: keyboard selection of a reading checkbox, multiple-answer selection, marking and reviewing, selecting a passage sentence, fraction entry and calculator display.
- Desktop shell syntax checked. Desktop installer builds and the Electron launch/quit suite were not run. Existing packaged desktop releases will not change until rebuilt.
