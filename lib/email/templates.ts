// Keep every client-facing template short and plain — same 8th-grade
// reading level standard as the rest of BidPulse's client-facing copy.

const STAGE_MESSAGES: Record<string, { subject: string; body: (agency: string) => string }> = {
  submitted: {
    subject: "We've got your bid",
    body: (agency) =>
      `We received your bid info for ${agency}. We're getting started on it now.`,
  },
  in_review: {
    subject: "We're reviewing your bid",
    body: (agency) =>
      `We're going through the details of your ${agency} bid now. We'll let you know when your paperwork is ready.`,
  },
  deliverables_ready: {
    subject: "Your bid paperwork is ready",
    body: (agency) =>
      `Your paperwork for the ${agency} bid is ready to look over. Log in to your dashboard to see it.`,
  },
  client_review: {
    subject: "Please review your bid paperwork",
    body: (agency) =>
      `We'd like you to take a look at the paperwork we prepared for your ${agency} bid, whenever you get a chance.`,
  },
  confirmed_submitted: {
    subject: "Your bid has been submitted",
    body: (agency) =>
      `Good news — we've submitted your bid to ${agency}. We'll follow up when we hear anything back.`,
  },
  closed: {
    subject: "Your bid is closed out",
    body: (agency) => `Your ${agency} bid has been closed out. Thanks for working with us.`,
  },
};

export function getStageChangeEmail(stage: string, agency: string, companyName: string) {
  const template = STAGE_MESSAGES[stage];
  if (!template) return null;

  return {
    subject: template.subject,
    html: `
      <p>Hi ${companyName},</p>
      <p>${template.body(agency)}</p>
      <p>— BidPulse</p>
    `,
  };
}

export function getContactMessageEmail(name: string, email: string, message: string) {
  return {
    subject: `New contact form message from ${name}`,
    html: `
      <p>New message from the /contact form:</p>
      <p><strong>${name}</strong> — ${email}</p>
      <p>${message.replace(/\n/g, "<br>")}</p>
    `,
  };
}

export function getDailyDigestEmail(
  staleItems: {
    companyName: string;
    agency: string;
    stage: string;
    daysSinceUpdate: number;
    daysUntilDue: number | null;
    breachedTurnaround: boolean;
  }[]
) {
  // Sort the most deadline-critical items to the top — a submission due
  // in 2 days matters far more than one due in 6 weeks, even if both
  // have gone equally untouched. A turnaround-promise breach is always
  // the most urgent, since that's a promise already broken, not just at risk.
  const sorted = [...staleItems].sort((a, b) => {
    if (a.breachedTurnaround !== b.breachedTurnaround) return a.breachedTurnaround ? -1 : 1;
    const aRisk = a.daysUntilDue ?? 9999;
    const bRisk = b.daysUntilDue ?? 9999;
    return aRisk - bRisk;
  });

  const rows = sorted
    .map((item) => {
      const turnaroundFlag = item.breachedTurnaround
        ? `<strong style="color:#ba1a1a">PAST OUR 48-HOUR PROMISE</strong> — `
        : "";
      const urgency =
        item.daysUntilDue !== null && item.daysUntilDue <= 5
          ? `<strong style="color:#ba1a1a">DUE SOON — ${item.daysUntilDue} day${item.daysUntilDue === 1 ? "" : "s"} left</strong> — `
          : "";
      return `<li>${turnaroundFlag}${urgency}${item.companyName} — ${item.agency} (${item.stage.replace(/_/g, " ")}, ${item.daysSinceUpdate} days with no update)</li>`;
    })
    .join("");

  const breachCount = sorted.filter((i) => i.breachedTurnaround).length;
  const urgentCount = sorted.filter((i) => i.daysUntilDue !== null && i.daysUntilDue <= 5).length;

  return {
    subject:
      breachCount > 0
        ? `BidPulse: ${breachCount} submission${breachCount === 1 ? "" : "s"} PAST our 48-hour promise`
        : urgentCount > 0
        ? `BidPulse: ${urgentCount} submission${urgentCount === 1 ? "" : "s"} due soon and stalled`
        : `BidPulse: ${staleItems.length} submission${staleItems.length === 1 ? "" : "s"} need attention`,
    html: `
      <p>These submissions haven't been updated in a few days, sorted by urgency:</p>
      <ul>${rows}</ul>
    `,
  };
}
