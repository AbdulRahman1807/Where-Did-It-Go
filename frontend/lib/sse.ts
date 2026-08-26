import type { StreamEvent } from "./types";

// Both streaming endpoints are POST requests, so the browser's built-in
// EventSource (GET-only) can't be used. This reads the fetch Response body
// stream directly and parses the same "data: <json>\n\n" SSE framing by hand
// -- a small, explicit parser rather than pulling in a client library.
export async function* parseSSEStream(response: Response): AsyncGenerator<StreamEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("data:")) {
          const jsonText = line.slice(5).trim();
          if (jsonText) {
            try {
              yield JSON.parse(jsonText) as StreamEvent;
            } catch {
              // Ignore a malformed frame rather than killing the whole stream.
            }
          }
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
}
