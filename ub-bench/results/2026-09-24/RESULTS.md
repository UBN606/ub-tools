# UB Bench results, 2026-09-24: five models, answering from memory

| Model | Score | Correct paragraph cited | All quotes verbatim | Fact right | Invented or altered quotes |
|---|---|---|---|---|---|
| Claude Opus | 21% (13/63) | 2/21 | 1/21 | 10/21 | 2 |
| Gemini 3.1 Pro | 16% (10/63) | 2/21 | 0/21 | 8/21 | 3 |
| Claude Sonnet 5 | 8% (5/63) | 0/21 | 0/21 | 5/21 | 1 |
| Claude Haiku 4.5 | 3% (2/63) | 0/21 | 0/21 | 2/21 | 0 |
| ChatGPT GPT-6 Sol | 0% (0/63) | 0/21 | 0/21 | 0/21 | 0 |

## Every invented or altered quote

- **Gemini 3.1 Pro, Q02.** It gave "But while he was yet a great way off, his father saw him and had compassion, and ran and fell on his neck and kissed him" and cited it to UB 169:1.9. That is essentially the Bible's wording (Luke 15:20, King James Version: "But when he was yet a great way off, his father saw him, and had compassion, and ran, and fell on his neck, and kissed him"). The UB says: "even while he was yet afar off, the father saw him and, being moved with loving compassion, ran out to meet him."
- **Gemini 3.1 Pro, Q01.** It dropped one word: "The Father requires of me only..." where the book says "**And** the Father requires of me only..." (180:2.1).
- **Gemini 3.1 Pro, Q06.** It put "liberty and self-determination" in quotation marks. That phrase appears nowhere in the book.
- **Claude Opus, Q01.** It wrote "I am the **real** vine, and my Father is the husbandman". The book opens with "I am the **true** vine"; "real vine" appears later in the same paragraph.
- **Claude Opus, Q16.** It wrote "a stem arising **from** the vine". The book says "arising **out of** the vine" (180:2.3).
- **Claude Sonnet 5, Q02.** It wrote "while yet a long way off", again the Bible's phrasing, not the UB's "afar off".

Only one full passage quoted with a citation was word-perfect: Opus's list of the fruits of the spirit (193:2.2).

## What it shows

- **Most models declined to quote, which is the honest behavior.** ChatGPT declined every question. Haiku's first attempt refused the test outright.
- **When models did quote, they usually got it slightly wrong.** The errors were a single changed word, or the Bible's wording in place of the UB's. A reader would almost never catch these. They're the same errors found in careful human-written articles on the same day.
- **Gemini's Q02 is the clearest warning.** It presented the King James wording as UB text, with a correct-looking UB citation.
- **Takeaway:** never let a model quote the UB from memory. Have it fetch the text (`ub_get_paragraphs`) and check the draft (`ub_verify_text`).

## Method and caveats

- **Claude models (2026-09-23):** run as Claude Code subagents told to use no tools. Each reported zero tool uses.
- **ChatGPT and Gemini (2026-09-24):** run in their regular web apps in a logged-in browser, with "Answer from your own knowledge only. Do not search the web or use any tools." added to the start of the same prompt.
  - ChatGPT was on GPT-6 Sol. Gemini was switched from Flash-Lite to 3.1 Pro, its flagship.
  - Neither interface showed a web search. Gemini's reply clearly drew on the account's saved personal context: it opened "Alright Bro, pulling this straight from the internal archives for your production bible". That didn't give it access to the book.
- **Each model answered once.** A second run could differ.
- **The "fact" point** accepts equivalent wording, such as "seven years" for "seven-year struggle".
- **Answers** are saved verbatim beside this file. To regrade: `node ub-bench/ub-bench.js grade ub-bench/results/*/*.txt`.
