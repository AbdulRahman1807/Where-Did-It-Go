# SOP-05: Escalation Policy

## Purpose

This policy defines when a pick exception investigation should be escalated to a human operator
rather than resolved with an autonomous recommendation, and what escalation means procedurally.

## Escalation is not failure

Escalation is a correct outcome when the applicable conditions are met. An investigation that
escalates appropriately, with a clear explanation of why, has performed its job correctly. An
investigation that manufactures a confident answer despite insufficient or conflicting evidence has
not.

## Conditions that require escalation or human review

- Two or more documented investigation rounds have not produced a sufficiently supported
  conclusion.
- Evidence sources materially conflict (for example, inventory and location history disagree) and
  the conflict cannot be resolved from available records.
- A required evidence source is unavailable, missing, or empty, and no alternative source can
  substitute for it.
- The recommended action would affect a restricted or high-value SKU (see SOP-06).
- The recommended action involves adjusting inventory records, writing off stock, or any action
  with a direct financial or operational consequence beyond a routine re-pick.
- The applicable procedure explicitly requires human confirmation (for example, short-picks on
  expedited orders under SOP-07).

## What escalation should include

When escalating, the case should present: the incident, what was investigated, what evidence was
found, the most likely explanation if one exists, and why a confident autonomous recommendation
could not be made. Escalation should never be a bare refusal without explanation.

## Maximum investigation depth

An investigation should not loop indefinitely seeking more evidence. After a bounded number of
investigation rounds without reaching sufficient evidence, the system must stop and escalate rather
than continue investigating without limit.
