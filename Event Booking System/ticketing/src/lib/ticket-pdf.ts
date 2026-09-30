import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { OrgSettings } from "./settings";

export type TicketPdfInput = {
  org: OrgSettings;
  eventTitle: string;
  startsAt: string;
  venue: string;
  guestName: string;
  ticketCode: string;
  totalGuests: number;
  bookingReference?: string;
  preview?: boolean;
};

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(value, 16);
  if (Number.isNaN(int)) return rgb(0.21, 0.31, 0.36);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

/** One A4 page per booking, with a single QR code covering the whole party and optional PREVIEW watermark (FR-TK-01, FR-TK-02). */
export async function buildTicketPdf(input: TicketPdfInput) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${input.org.name} ticket`);
  pdf.setProducer(input.org.name);

  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const brand = hexToRgb(input.org.brandColour);
  const accent = hexToRgb(input.org.accentColour);
  const when = new Date(input.startsAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/London" });
  const guestWord = input.totalGuests === 1 ? "guest" : "guests";

  const page = pdf.addPage([595, 842]);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: brand });
  page.drawText(input.org.name, { x: 48, y: height - 68, size: 22, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Event ticket", { x: 48, y: height - 92, size: 10, font: regular, color: rgb(0.85, 0.88, 0.87) });

  page.drawText(input.eventTitle, { x: 48, y: height - 175, size: 20, font: bold, color: brand });

  const details: [string, string][] = [
    ["When", when],
    ["Where", input.venue],
    ["Guest", input.guestName],
    ["Booking", `1 Booking \u00b7 ${input.totalGuests} ${guestWord} \u00b7 1 QR ticket`],
    ["Ticket", input.ticketCode],
    ...(input.bookingReference ? [["Booking reference", input.bookingReference] as [string, string]] : []),
  ];
  let y = height - 215;
  for (const [label, value] of details) {
    page.drawText(label.toUpperCase(), { x: 48, y, size: 8, font: bold, color: accent });
    page.drawText(value, { x: 48, y: y - 16, size: 12, font: regular, color: rgb(0.15, 0.15, 0.15) });
    y -= 44;
  }

  const qrPng = await QRCode.toBuffer(input.ticketCode, { type: "png", errorCorrectionLevel: "M", margin: 1, width: 600 });
  const qrImage = await pdf.embedPng(new Uint8Array(qrPng));
  const qrSize = 220;
  page.drawImage(qrImage, { x: (width - qrSize) / 2, y: y - qrSize - 30, width: qrSize, height: qrSize });

  page.drawText("Show this QR code at the entrance.", { x: 48, y: y - qrSize - 70, size: 11, font: regular, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`Admits ${input.totalGuests} ${guestWord}. Covers the whole booking.`, { x: 48, y: y - qrSize - 88, size: 11, font: regular, color: rgb(0.3, 0.3, 0.3) });

  const footer = [input.org.websiteUrl, input.org.supportEmail, input.org.supportPhone].filter(Boolean).join("  |  ");
  if (footer) page.drawText(footer, { x: 48, y: 48, size: 9, font: regular, color: rgb(0.45, 0.45, 0.45) });

  if (input.preview) {
    page.drawText("PREVIEW", { x: 90, y: height / 2 - 40, size: 96, font: bold, color: rgb(0.85, 0.2, 0.15), opacity: 0.22, rotate: { type: "degrees", angle: 30 } as never });
    page.drawText("SAMPLE - NOT VALID FOR ENTRY", { x: 120, y: height / 2 - 90, size: 14, font: bold, color: rgb(0.6, 0.15, 0.12), opacity: 0.5 });
  }

  return Buffer.from(await pdf.save());
}
