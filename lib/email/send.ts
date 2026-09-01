// Server-only. Uses RESEND_API_KEY — never expose this to the browser.
// During testing (no verified custom domain), Resend only allows sending
// TO the email address you signed up with, FROM their shared test domain
// — this is Resend's own safety default, not something we configure.

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  // Email local-parts are case-insensitive everywhere that matters (Gmail
  // included), but Resend's sandbox allow-list check is a case-sensitive
  // string compare against the account owner's address — a client record
  // saved as "Name@gmail.com" instead of "name@gmail.com" fails with the
  // same "can only send to your own address" error even though it's the
  // same inbox. Normalize here so casing from an intake form never matters.
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "BidPulse <notifications@bidpulse.co>", // bidpulse.co is now a verified sending domain,
      to: to.trim().toLowerCase(),
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resend send failed: ${errText}`);
  }

  return res.json();
}
