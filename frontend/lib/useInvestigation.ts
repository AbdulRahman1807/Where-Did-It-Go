"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCase, startInvestigation, submitReview, type ReviewSubmission } from "./api";
import { parseSSEStream } from "./sse";
import type { CaseSnapshot, StreamReviewRequiredEvent } from "./types";

export interface ActivityEntry {
  id: number;
  text: string;
}

export interface UseInvestigation {
  caseData: CaseSnapshot | null;
  loading: boolean;
  streaming: boolean;
  activity: ActivityEntry[];
  reviewPayload: StreamReviewRequiredEvent["payload"] | null;
  error: string | null;
  start: () => Promise<void>;
  review: (submission: ReviewSubmission) => Promise<void>;
}

// Drives one incident's investigation: loads the current snapshot, and
// layers live SSE events on top while a run (start or review) is in flight.
// This is the client-side mirror of the backend's state/stream split -- the
// REST snapshot is "what's true now", the SSE stream is "what's happening".
export function useInvestigation(incidentId: string): UseInvestigation {
  const [caseData, setCaseData] = useState<CaseSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [reviewPayload, setReviewPayload] = useState<StreamReviewRequiredEvent["payload"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activityId = useRef(0);

  useEffect(() => {
    // loading already starts true (see useState above), so nothing to set
    // here on mount -- this effect only needs to flip it back to false once
    // the fetch settles.
    let cancelled = false;
    getCase(incidentId)
      .then((data) => {
        if (!cancelled) setCaseData(data);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  const consume = useCallback(async (responsePromise: Promise<Response>) => {
    setStreaming(true);
    setError(null);
    try {
      const response = await responsePromise;
      for await (const event of parseSSEStream(response)) {
        switch (event.type) {
          case "activity":
            activityId.current += 1;
            setActivity((prev) => [...prev, { id: activityId.current, text: event.text }]);
            break;
          case "node_update": {
            // activity_log in a node_update is only the delta the node just
            // appended (see app/state.py's reducer) -- the "activity" event
            // above is the authoritative incremental stream for the live
            // feed, so don't let this delta clobber the accumulated history.
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { activity_log, ...rest } = event.update;
            setCaseData((prev) => (prev ? { ...prev, ...rest, started: true } : prev));
            break;
          }
          case "review_required":
            setReviewPayload(event.payload);
            break;
          case "error":
            setError(event.message);
            break;
          case "already_started":
          case "done":
            // The snapshot's activity_log is now the authoritative full
            // history (it folds in everything just streamed), so clear the
            // live delta buffer to avoid double-rendering those lines.
            setCaseData(event.case);
            setActivity([]);
            if (event.case.status !== "awaiting_review") setReviewPayload(null);
            break;
        }
      }
    } catch (e) {
      setError(
        "Lost connection to the investigation service. The evidence gathered so far is still saved -- try again."
      );
      console.error(e);
    } finally {
      setStreaming(false);
    }
  }, []);

  const start = useCallback(async () => {
    setActivity([]);
    await consume(startInvestigation(incidentId));
  }, [consume, incidentId]);

  const review = useCallback(
    async (submission: ReviewSubmission) => {
      await consume(submitReview(incidentId, submission));
    },
    [consume, incidentId]
  );

  return { caseData, loading, streaming, activity, reviewPayload, error, start, review };
}
