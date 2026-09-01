import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";

// Shared by both extraction routes (extract-from-document for bid/RFP
// files, extract-company-profile for company-profile documents) so file-type
// support only needs fixing in one place. PDF and DOCX go through Claude's
// native document/text handling; DOCX is unzipped via mammoth first since
// Claude has no native .docx support. Legacy .doc (the pre-2007 binary
// format, not .docx) is deliberately NOT supported — there's no safe,
// well-maintained parser for it without adding a new dependency, and the
// format is rare enough in practice (modern Word/Google Docs both default to
// .docx) that it's not worth the risk. .txt needs no parsing at all.
export type DocumentKind = "pdf" | "docx" | "txt";

export function detectDocumentKind(mimeType: string, fileName: string): DocumentKind | null {
  const lower = fileName.toLowerCase();
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mimeType === "text/plain" || lower.endsWith(".txt")) return "txt";
  return null;
}

export const UNSUPPORTED_FILE_TYPE_MESSAGE =
  "Unsupported file type — upload a PDF, Word (.docx), or plain text (.txt) document.";

// Returns Claude message content for the given file, or an error string if
// the file has no readable text (never throws for that case, since a
// deliberately-empty test file or a scanned-image-only .docx is a normal
// input to handle gracefully, not a server error).
export async function buildDocumentContent(
  kind: DocumentKind,
  buffer: Buffer,
  instruction: string
): Promise<{ content: Anthropic.MessageParam["content"] } | { error: string }> {
  if (kind === "pdf") {
    return {
      content: [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") },
        },
        { type: "text", text: instruction },
      ],
    };
  }

  const text = kind === "docx" ? (await mammoth.extractRawText({ buffer })).value : buffer.toString("utf-8");

  if (!text.trim()) {
    return { error: "Couldn't read any text from that document." };
  }

  return {
    content: [{ type: "text", text: `${text.trim()}\n\n${instruction}` }],
  };
}
