# Demo Script

One complete investigation, start to finish, using the flagship incident **INC-1042**. This follows
the master spec's own suggested narrative (section 27) and is deliberately the same scenario the
frontend design spec uses as its worked example of the human-feedback loop (section 15) — so the
demo, the spec, and the eval suite (`EVAL-EVIDENCE-1042`) all tell the same story.

Setup: both servers running (`backend/run.sh`, `npm run dev` in `frontend/`), `GROQ_API_KEY` set.

## 1. Present the incident

Open `/investigations`. Point out **INC-1042**: *"Repeated pick failure, SKU XJ-482"* — tagged
`EVIDENCE`, not started yet. Click into it.

Say: *"Pick task PX-1042 failed twice at location A-17. Inventory says there's 1 unit there. The
question is whether that's actually true."*

## 2. Start the investigation

Click **Begin investigation**. The activity feed starts narrating in plain language — "Checking pick
task history for PX-1042", "Checking inventory records for XJ-482", "Checking recent location and
scan events for XJ-482", "Searching operating procedures for..." — never a raw tool name or call ID.

## 3. Finding + evidence conflict

The investigation pauses on **Human review required**. Point out:

- The finding: a likely location discrepancy, worded as an inference, not a fact.
- The evidence cards: the inventory record (A-17) and the location history's `moved` event (to
  B-12) are shown as **conflicting** — a visible red-accented conflict banner, not a buried caveat.
- The **why** banner at the top of the review panel states the actual reason review is required:
  conflicting records, not a generic "human review required."

## 4. Human disagrees / asks for more investigation

In the feedback box, type: *"Check whether the item was moved recently."* Click **Investigate more**.

Say: *"This is the reviewer directing the investigation, not just rubber-stamping it."*

## 5. Agent re-investigates

The activity feed resumes — this is round 2, and the graph is resuming from exactly where it left
off (the checkpointed state), not starting over. It re-examines location history with the reviewer's
direction in mind.

## 6. Updated finding

The new finding should identify: the item was moved from A-17 to B-12 roughly 11 minutes before the
second failed attempt — the inventory record is stale, not wrong in some unexplained way. The
recommendation updates accordingly (verify B-12, correct the inventory record).

## 7. Human approves

Click **Approve**. The case resolves. Point out the **Outcome** panel: the full review history is
visible (round 1 reject/investigate-more with the reviewer's exact text, round 2 approve), so
nothing about how the conclusion was reached is hidden after the fact.

## 8. Zoom out — the other four cases

Briefly show the dashboard's other incidents to demonstrate the categories weren't cherry-picked to
one pattern:

- **INC-2091** (normal) — resolves with *no* human review at all; point out the risk tile stays low
  and no review gate appears.
- **INC-5210** (high-risk) — review triggers even though the evidence is completely clean, because
  the SKU is restricted. Contrast this with INC-1042's evidence-conflict trigger: two different
  reasons for the same review mechanism.
- **INC-4400** (failure) — the agent explicitly states it can't establish a cause and recommends
  escalation, rather than guessing. This is the specific behavior Master Spec section 21 calls out as
  a *pass*, not a failure.

## Closing line

*"The agent investigated, found a conflict, was overruled toward more investigation, found the real
cause, and only then closed the case — with a human approving every step of that. Where it wasn't
sure, it said so instead of guessing."*
