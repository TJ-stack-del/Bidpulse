"use client";

// A page can't force-close a browser tab it didn't itself open with
// window.open() -- a real, permanent security restriction (otherwise any
// site could close a visitor's other tabs). This is the practical
// equivalent of "close the tab that requested the link once I've signed
// in": the tab left sitting on "check your email" (LoginForm's
// otpChannel === "email" and forgotSent states) listens on this channel,
// and AppShell -- mounted once a real session exists, since it's only
// ever rendered for a signed-in user -- announces on it. The waiting tab
// then navigates itself into the app instead of sitting on a dead-end
// screen; not literally closing itself, but the same practical outcome.
const CHANNEL_NAME = "bidpulse-auth";

export function broadcastSignedIn() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage({ type: "signed-in" });
  channel.close();
}

// Returns an unsubscribe function, same convention as a useEffect cleanup.
export function onSignedInElsewhere(callback: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const handler = (event: MessageEvent) => {
    if (event.data?.type === "signed-in") callback();
  };
  channel.addEventListener("message", handler);
  return () => {
    channel.removeEventListener("message", handler);
    channel.close();
  };
}
