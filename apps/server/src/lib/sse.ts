type SseEvent = {
  event: string;
  data: unknown;
};

type Subscriber = (payload: SseEvent) => void;

const subscribers = new Map<string, Set<Subscriber>>();

export function publishRunEvent(runId: string, event: string, data: unknown) {
  const handlers = subscribers.get(runId);
  if (!handlers?.size) {
    return;
  }

  handlers.forEach((handler) => handler({ event, data }));
}

export function createRunEventStream(
  runId: string,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (payload: SseEvent) => {
        const text = `event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`;
        controller.enqueue(encoder.encode(text));
      };

      const handlers = subscribers.get(runId) ?? new Set<Subscriber>();
      handlers.add(send);
      subscribers.set(runId, handlers);

      send({ event: "open", data: { runId } });

      const abortHandler = () => {
        handlers.delete(send);
        if (handlers.size === 0) {
          subscribers.delete(runId);
        }
        controller.close();
      };

      signal.addEventListener("abort", abortHandler, { once: true });
    },
  });
}
