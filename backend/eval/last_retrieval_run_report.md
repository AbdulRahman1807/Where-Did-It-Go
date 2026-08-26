# Retrieval Evaluation Report

Run at 2026-08-26T08:05:46.189671+00:00

Top-3 retrieval against the live SOP corpus. `hit@3 (doc)` is the pass/fail bar: did the expected procedure document appear anywhere in the top-3 results.

| Query | Expected | hit@1 (doc) | hit@3 (doc) | hit@3 (exact section) |
|---|---|---|---|---|
| item was moved recently before a failed pick | SOP-03 / Required steps | ok | ok | ok |
| the picking robot found nothing at the shelf but inventory says there's one unit | SOP-02 / Definition of a discrepancy | ok | ok | ok |
| should I trust an inventory record that hasn't been updated in weeks | SOP-04 / Staleness | ok | ok | ok |
| does a restricted item need a supervisor's signature before we retry the pick | SOP-06 / Authority requirement | ok | ok | ok |
| order needs to ship today but we only pulled half the requested quantity | SOP-07 / Expedited orders | ok | ok | ok |
| we can't find any location history at all for this SKU | SOP-04 / No history found | ok | ok | ok |
| inventory and the scan history both say zero units remain, is that a confirmed stockout | SOP-01 / Resolving a confirmed stockout | ok | ok | ok |
| we've tried the same bin three times and keep coming up empty | SOP-03 / Trigger condition | ok | ok | ok |
| what counts as putaway versus a cycle count event | SOP-04 / Event types | ok | ok | ok |
| after two rounds of investigation we still don't have an answer | SOP-05 / Maximum investigation depth | ok | ok | ok |
| a concurrent reservation ate into the quantity we could pick for this order | SOP-07 / Legitimate causes of a short pick | ok | ok | ok |
| correcting the system record after finding the item somewhere else | SOP-02 / Recommended actions | FAIL | ok | ok |
| is escalating to a human a failure of the investigation | SOP-05 / Escalation is not failure | ok | ok | ok |
| caged zone C items need extra sign-off | SOP-06 / Scope | ok | ok | ok |
| what's the general order of steps to check before writing up a pick exception | SOP-01 / Investigation sequence | ok | ok | ok |
| does having zero inventory records and zero scan events mean something is definitely wrong | SOP-04 / No history found | ok | ok | ok |
| some units held back for damage inspection reduced what we could pick | SOP-07 / Legitimate causes of a short pick | FAIL | FAIL | - |

**16/17 cases hit the expected document within top-3.**

## Detail

### PASS — item was moved recently before a failed pick

Expected: `SOP-03 / Required steps`
Notes: The exact worked example from README section 6 -- neither 'moved' nor 'failed pick' phrasing appears verbatim in the target section's prose.

Retrieved:
- `SOP-03 / Required steps` (relevance=0.1937)
- `SOP-03 / Escalation condition` (relevance=0.0861)
- `SOP-03 / Recommendation guidance` (relevance=0.0795)

### PASS — the picking robot found nothing at the shelf but inventory says there's one unit

Expected: `SOP-02 / Definition of a discrepancy`

Retrieved:
- `SOP-02 / Definition of a discrepancy` (relevance=0.0)
- `SOP-03 / Required steps` (relevance=0.0)
- `SOP-03 / Trigger condition` (relevance=0.0)

### PASS — should I trust an inventory record that hasn't been updated in weeks

Expected: `SOP-04 / Staleness`

Retrieved:
- `SOP-04 / Staleness` (relevance=0.2722)
- `SOP-02 / Investigation steps` (relevance=0.2164)
- `SOP-02 / Recommended actions` (relevance=0.145)

### PASS — does a restricted item need a supervisor's signature before we retry the pick

Expected: `SOP-06 / Authority requirement`

Retrieved:
- `SOP-06 / Authority requirement` (relevance=0.0636)
- `SOP-06 / Scope` (relevance=0.0629)
- `SOP-06 / Required procedure` (relevance=0.0)

### PASS — order needs to ship today but we only pulled half the requested quantity

Expected: `SOP-07 / Expedited orders`

Retrieved:
- `SOP-07 / Expedited orders` (relevance=0.0)
- `SOP-07 / Standard orders` (relevance=0.0)
- `SOP-01 / Resolving a confirmed stockout` (relevance=0.0)

### PASS — we can't find any location history at all for this SKU

Expected: `SOP-04 / No history found`

Retrieved:
- `SOP-04 / No history found` (relevance=0.3649)
- `SOP-03 / Required steps` (relevance=0.0)
- `SOP-02 / Investigation steps` (relevance=0.0)

### PASS — inventory and the scan history both say zero units remain, is that a confirmed stockout

Expected: `SOP-01 / Resolving a confirmed stockout`

Retrieved:
- `SOP-01 / Resolving a confirmed stockout` (relevance=0.2911)
- `SOP-04 / No history found` (relevance=0.0029)
- `SOP-02 / Investigation steps` (relevance=0.0)

### PASS — we've tried the same bin three times and keep coming up empty

Expected: `SOP-03 / Trigger condition`

Retrieved:
- `SOP-03 / Trigger condition` (relevance=0.0)
- `SOP-03 / Required steps` (relevance=0.0)
- `SOP-02 / Investigation steps` (relevance=0.0)

### PASS — what counts as putaway versus a cycle count event

Expected: `SOP-04 / Event types`

Retrieved:
- `SOP-04 / Event types` (relevance=0.0)
- `SOP-02 / Recommended actions` (relevance=0.0)
- `SOP-04 / Interpreting event recency` (relevance=0.0)

### PASS — after two rounds of investigation we still don't have an answer

Expected: `SOP-05 / Maximum investigation depth`

Retrieved:
- `SOP-05 / Maximum investigation depth` (relevance=0.0)
- `SOP-01 / When evidence is missing` (relevance=0.0)
- `SOP-05 / Escalation is not failure` (relevance=0.0)

### PASS — a concurrent reservation ate into the quantity we could pick for this order

Expected: `SOP-07 / Legitimate causes of a short pick`

Retrieved:
- `SOP-07 / Expedited orders` (relevance=0.1402)
- `SOP-07 / Standard orders` (relevance=0.087)
- `SOP-07 / Legitimate causes of a short pick` (relevance=0.0)

### PASS — correcting the system record after finding the item somewhere else

Expected: `SOP-02 / Recommended actions`

Retrieved:
- `SOP-03 / Required steps` (relevance=0.0)
- `SOP-02 / Recommended actions` (relevance=0.0)
- `SOP-01 / Investigation sequence` (relevance=0.0)

### PASS — is escalating to a human a failure of the investigation

Expected: `SOP-05 / Escalation is not failure`

Retrieved:
- `SOP-05 / Escalation is not failure` (relevance=0.2877)
- `SOP-05 / Maximum investigation depth` (relevance=0.2185)
- `SOP-05 / What escalation should include` (relevance=0.0761)

### PASS — caged zone C items need extra sign-off

Expected: `SOP-06 / Scope`

Retrieved:
- `SOP-06 / Purpose` (relevance=0.0)
- `SOP-06 / Scope` (relevance=0.0)
- `SOP-06 / Authority requirement` (relevance=0.0)

### PASS — what's the general order of steps to check before writing up a pick exception

Expected: `SOP-01 / Investigation sequence`

Retrieved:
- `SOP-01 / When to use this procedure` (relevance=0.3789)
- `SOP-01 / Purpose` (relevance=0.2789)
- `SOP-01 / Investigation sequence` (relevance=0.2451)

### PASS — does having zero inventory records and zero scan events mean something is definitely wrong

Expected: `SOP-04 / No history found`

Retrieved:
- `SOP-04 / No history found` (relevance=0.19)
- `SOP-04 / Staleness` (relevance=0.1055)
- `SOP-02 / Investigation steps` (relevance=0.0948)

### FAIL — some units held back for damage inspection reduced what we could pick

Expected: `SOP-07 / Legitimate causes of a short pick`
Notes: Documented known miss (see last_retrieval_run_report.md): 'damage inspection' does not embed close enough to SOP-07's 'quality inspection or damage review' phrasing at k=3 -- exactly the class of regression this eval set exists to catch, kept in deliberately rather than removed to make the suite pass.

Retrieved:
- `SOP-01 / Resolving a confirmed stockout` (relevance=0.0)
- `SOP-04 / Event types` (relevance=0.0)
- `SOP-06 / Authority requirement` (relevance=0.0)
