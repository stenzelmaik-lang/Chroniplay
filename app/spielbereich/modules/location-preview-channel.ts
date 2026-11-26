// Orte: the editor tells an open preview window (second screen) what is selected and when something was saved.
// Same-origin BroadcastChannel only; it carries ids, never content. The preview loads content through the
// normal authorized routes.
export const locationPreviewChannel = "chroniplay-orte-vorschau";

export type LocationPreviewMessage =
  | { type: "hello" }
  | { type: "state"; placeId: string; entityId: string; title: string; revisionId: string | null; previewable: boolean; stamp: string };

export function openLocationPreviewChannel(onMessage: (message: LocationPreviewMessage) => void) {
  if (typeof BroadcastChannel === "undefined") return { post: () => {}, close: () => {} };
  const channel = new BroadcastChannel(locationPreviewChannel);
  channel.onmessage = event => { const data = event.data as LocationPreviewMessage; if (data && typeof data === "object" && "type" in data) onMessage(data); };
  return { post: (message: LocationPreviewMessage) => channel.postMessage(message), close: () => channel.close() };
}
