# UB Bench results, 2026-09-23 (closed book: no tools, answering from memory)

| Model | Score | Correct paragraph cited | All quotes verbatim | Fact right | Invented or altered quotes |
|---|---|---|---|---|---|
| Claude Opus | 21% (13/63) | 2/21 | 1/21 | 10/21 | 2 |
| Claude Sonnet 5 | 8% (5/63) | 0/21 | 0/21 | 5/21 | 1 |
| Claude Haiku 4.5 | 3% (2/63) | 0/21 | 0/21 | 2/21 | 0 |
| Claude Fable 5.1 | no result | | | | |

Invented or altered quotes:
- Opus Q01 (180:2.1): "I am the **real** vine, and my Father is the husbandman". The book says "I am the **true** vine". ("Real vine" appears later in the same paragraph.)
- Opus Q16: "a stem arising **from** the vine". The book says "arising **out of** the vine" (180:2.3).
- Sonnet Q02: "while yet a long way off" is the Bible's wording (Luke 15:20). The UB says "even while he was yet afar off" (169:1.9).

Notes:
- **All three mostly declined to quote from memory**, which is the honest behavior. Haiku's first attempt refused the test outright. Opus quoted exactly once (Q12, the fruits of the spirit, verbatim) and knew the most facts (7 years, 40,119, 1,111, 606, about 150,000 years).
- **Two of the three wrong quotes are single-word swaps** that a reader would never notice: "real" for "true", "from" for "out of". The third is the Bible's wording in place of the UB's. These match the errors found in the UBN articles the same day.
- **Fable 5.1 produced no result.** The API rejected its output with "400 Output blocked by content filtering policy" (request req_011CfMhz2fejZ7wV6zeMswQn), probably because it was reproducing long verbatim passages. It was not retried.
- **Takeaway:** no model can be trusted to quote the UB from memory. With the ub-tools MCP server, any model fetches the exact text, and ub_verify_text checks the draft.
- **Method:** each model ran as a Claude Code subagent told not to use tools (tool_uses reported 0 for all three). The prompt came from `node ub-bench.js prompt`; answers are saved verbatim next to this file. To regrade: `node ub-bench.js grade results/2026-09-23/*.txt`.
