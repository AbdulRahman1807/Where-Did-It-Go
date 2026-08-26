# Failure Modes

For each mode: what can go wrong, how the system detects it, how the agent responds, when human
review occurs, and what limitation remains even after handling it.

## Insufficient evidence

- **What can go wrong:** a tool returns no record (e.g. no inventory row, no location history) and
  there isn't enough left to support a confident finding.
- **Detection:** the `assess` node's fast-model sufficiency check (`evidence_sufficient`), on top of
  whatever the `synthesize` step already flagged in `unresolved_questions`.
- **Response:** the finding is worded as uncertain ("cannot establish a cause from the available
  evidence") rather than as a confident guess — this is an explicit instruction in the synthesis
  system prompt, not an accident of the model's style.
- **Human review:** always, with the sufficiency reason stated as the review reason.
- **Remaining limitation:** the sufficiency judgment is itself a model call. It's deliberately
  conservative-biased in its prompt, but it's not a hard guarantee — see `EVAL-FAILURE-4400` in the
  eval suite for the specific regression test.

## Conflicting operational records

- **What can go wrong:** two evidence sources disagree (e.g. inventory says location A, the most
  recent scan says location B).
- **Detection:** deterministic — `assess._deterministic_checks` scans the synthesized evidence list
  for any item with `stance == "conflicts"`.
- **Response:** the conflict is surfaced explicitly in the UI (a dedicated conflict banner, not
  buried in prose), and neither record is presented as authoritative.
- **Human review:** always forced, regardless of what the model's own risk judgment would have said.
- **Remaining limitation:** the model decides *whether* two pieces of evidence conflict when writing
  them during `synthesize` — the deterministic check only acts on that label, it doesn't
  independently verify the conflict is real.

## Failed / unavailable information source

- **What can go wrong:** a tool call itself fails (in this prototype: a Groq API error — rate limit,
  timeout, connection issue — rather than a simulated "service down" tool).
- **Detection:** the SSE streaming loop wraps the whole graph run in a try/except.
- **Response:** the frontend gets a plain-language error event ("The investigation could not
  continue right now...") — never a stack trace, provider error string, or internal identifier. The
  investigation state as of the last completed node is preserved (nothing already gathered is lost).
- **Human review:** not automatically triggered — the run simply stops and can be retried. This is a
  known gap; see Limitations in the root README ("no mid-round crash recovery").
- **Remaining limitation:** no automatic retry/backoff; the user has to re-trigger.

## Irrelevant retrieval

- **What can go wrong:** `search_procedures` returns a section that isn't actually applicable to the
  incident (a risk with any embedding-based retrieval on a small corpus).
- **Detection:** no automated check in this prototype — this is a documented gap, not a solved
  problem.
- **Response:** none currently beyond the model's own judgment about whether a retrieved section is
  relevant when writing the finding.
- **Human review:** only indirectly, if the resulting recommendation looks wrong to the reviewer.
- **Remaining limitation:** this is exactly why "improved retrieval evaluation" is the #2 item in the
  root README's next-steps list — a small labeled query→expected-section set would catch this
  class of regression directly instead of relying on spot-checking.

## Ambiguous incident

- **What can go wrong:** the incident has more than one plausible, evidence-consistent explanation
  (e.g. `INC-3157`'s short pick — legitimate concurrent reservation vs. a genuine sync issue).
- **Detection:** procedural, not evidence-based — SOP-07 states that expedited-order short-picks
  require human confirmation regardless of how clean the evidence looks. Encoded as a deterministic
  rule in `assess`, not left to the model to notice on its own.
- **Response:** the finding names the ambiguity explicitly rather than picking one explanation with
  false confidence.
- **Human review:** required by the matching procedural rule.
- **Remaining limitation:** only the ambiguity patterns this prototype's SOPs anticipate are caught
  by a deterministic rule; a genuinely novel ambiguous pattern relies on the model's own judgment in
  `assess`'s sufficiency check.

## Unsupported inference

- **What can go wrong:** the model states an inference as if it were a directly-observed fact.
- **Detection:** no runtime check — this is addressed by the synthesis system prompt (Master Spec
  section 9's evidence/inference distinction is stated explicitly as a rule the model must follow)
  plus the eval suite's LLM-judge pass, which specifically grades this.
- **Response:** findings are structurally required to be worded as inference ("likely cause",
  "explanation") separate from the evidence list itself, and the UI labels the finding block
  "Inference —" rather than presenting it as fact.
- **Human review:** not a direct trigger by itself, but wrong or overconfident inferences are exactly
  what the reviewer is there to catch.
- **Remaining limitation:** this is a prompted behavior, not a structural guarantee. The judge pass
  in eval is a spot-check on 5 cases, not exhaustive verification.

## Repeated unsuccessful investigation

- **What can go wrong:** the human keeps rejecting / asking for more investigation and the case never
  converges.
- **Detection:** the round counter against `MAX_INVESTIGATION_ROUNDS` (default 3), checked in
  `human_review_node` before starting another round.
- **Response:** forced escalation with an explicit reason ("Maximum investigation depth reached
  without a sufficiently supported conclusion") rather than looping indefinitely.
- **Human review:** the case still ends up in front of a human — as an escalation, not a silent stop.
- **Remaining limitation:** the round cap is a fixed constant, not adaptive to how much progress is
  actually being made round-over-round.

## Inappropriate autonomous action

- **What can go wrong:** the agent could, in principle, recommend or take a consequential action
  (inventory adjustment, closing a case on a restricted SKU) without authority to do so.
- **Detection:** deterministic — the restricted/high-value SKU check in `assess`, independent of
  evidence clarity.
- **Response:** the agent never executes any action on the operational world — recommendations are
  always advisory text, and even the recommendation itself is withheld from being "final" until a
  human approves.
- **Human review:** always forced for restricted/high-value SKUs, regardless of risk score.
- **Remaining limitation:** enforced procedurally (the agent reads and follows SOP-06) rather than
  structurally (there's no hard allow-list the agent literally cannot bypass) — see next-steps #6 in
  the root README.

## Human rejection of recommendation

- **What can go wrong:** nothing "goes wrong" here exactly — this is the system working as intended.
  The reviewer disagrees with the recommendation.
- **Detection:** N/A — this is a reviewer action (`decision: "reject"`), not a failure to detect.
- **Response:** the rejection's feedback text becomes `investigation_focus` for a new round; the
  agent re-investigates with that context rather than repeating the same answer. See `INC-6633` in
  the seed dashboard history for a worked example (reviewer rejected "stock-out, reorder", asked for
  a manual recount, agent found a mis-slotted unit on re-investigation).
- **Human review:** the new round ends at another review gate, same as any other round.
- **Remaining limitation:** bounded by the same round cap as any other loop.
