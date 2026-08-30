import jsPDF from "jspdf";

// Combines the company profile (organizations table) with a bid's
// Statement of Work (bids.scope) into a cover packet. This is a starting
// point, not a full bid response — items that require an original
// signature, a real insurance certificate, or a notarized affidavit
// still have to be attached separately (see intake page's document
// upload). What this DOES cover: the company-info and qualifications
// sections that repeat on nearly every RFP form.

type CompanyProfile = {
  name: string;
  license_number: string | null;
  years_in_business: number | null;
  business_address: string | null;
  business_phone: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  general_liability_coverage: string | null;
  workers_comp_coverage: string | null;
};

type BidInfo = {
  title: string;
  agency: string;
  solicitation_number: string | null;
  due_date: string | null;
  scope: string | null;
};

export function generateBidPacket(company: CompanyProfile, bid: BidInfo): jsPDF {
  const doc = new jsPDF();
  const marginX = 20;
  let y = 20;

  function heading(text: string) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(text, marginX, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  }

  function line(label: string, value: string) {
    doc.text(`${label}: ${value || "—"}`, marginX, y);
    y += 7;
  }

  function paragraph(text: string) {
    const lines = doc.splitTextToSize(text || "—", 170);
    doc.text(lines, marginX, y);
    y += lines.length * 6 + 4;
  }

  // Cover
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Bid Packet", marginX, y);
  y += 12;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  heading("Job Details");
  line("Job", bid.title);
  line("Agency", bid.agency);
  line("Solicitation #", bid.solicitation_number ?? "—");
  line("Due date", bid.due_date ? new Date(bid.due_date).toLocaleDateString() : "—");
  y += 4;

  heading("Statement of Work");
  paragraph(bid.scope ?? "No scope provided.");

  heading("Company Information");
  line("Business name", company.name);
  line("License number", company.license_number ?? "—");
  line(
    "Years in business",
    company.years_in_business ? String(company.years_in_business) : "—"
  );
  line("Address", company.business_address ?? "—");
  line("Phone", company.business_phone ?? "—");
  y += 4;

  heading("Insurance");
  line("Provider", company.insurance_provider ?? "—");
  line("Policy number", company.insurance_policy_number ?? "—");
  line("General liability", company.general_liability_coverage ?? "—");
  line("Workers' comp", company.workers_comp_coverage ?? "—");
  y += 8;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  const note = doc.splitTextToSize(
    "This packet covers your company info and the job's statement of work. " +
      "You still need to attach: the agency's own signed response form, a real certificate " +
      "of insurance, your W-9, and any required affidavits — those can't be auto-generated.",
    170
  );
  doc.text(note, marginX, y);

  return doc;
}
