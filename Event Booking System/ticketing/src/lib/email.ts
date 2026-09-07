import QRCode from "qrcode";
import nodemailer from "nodemailer";

const apiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;
const apiBase = process.env.RESEND_API_BASE || "https://api.resend.com";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;

export const smtpEnabled = Boolean(smtpHost && emailFrom);
export const emailEnabled = Boolean(emailFrom && (smtpHost || apiKey));

let transport: nodemailer.Transporter | null = null;
function smtpTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPassword ? { user: smtpUser, pass: smtpPassword } : undefined,
    });
  }
  return transport;
}

export function appBaseUrl() {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelHost) return `https://${vercelHost}`;
  return "https://hilston-park-ticketing.vercel.app";
}

export async function ticketQrPngBase64(ticketCode: string) {
  const buffer = await QRCode.toBuffer(ticketCode, { type: "png", errorCorrectionLevel: "M", margin: 2, width: 360 });
  return buffer.toString("base64");
}

type Attachment = { filename: string; content: string };

export async function sendEmail(input: { to: string; subject: string; html: string; attachments?: Attachment[] }) {
  if (!emailFrom) throw new Error("email_not_configured");

  if (smtpEnabled) {
    const sent = await smtpTransport().sendMail({
      from: emailFrom,
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments?.map((attachment) => ({ filename: attachment.filename, content: attachment.content, encoding: "base64" })),
    });
    return { id: sent.messageId || "smtp" };
  }

  if (!apiKey) throw new Error("email_not_configured");
  const response = await fetch(`${apiBase}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: emailFrom, to: input.to, subject: input.subject, html: input.html, attachments: input.attachments }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || `Email provider rejected the request (${response.status})`);
  return { id: (data?.id as string) || "resend" };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] as string));
}

export function bookingConfirmationHtml(input: { name: string; eventTitle: string; startsAt: string; venue: string; ticketCodes: string[]; ticketUrl?: string }) {
  const when = new Date(input.startsAt).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/London" });
  const base = appBaseUrl();
  const tickets = input.ticketCodes.map((code) => `
    <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid #e2ded4;border-radius:12px;margin:0 0 16px;padding:18px;width:100%">
      <tr>
        <td style="vertical-align:middle;width:150px">
          <img src="${base}/api/public/tickets/${encodeURIComponent(code)}/qr" width="130" height="130" alt="QR code for ticket ${escapeHtml(code)}" style="display:block;border:0" />
        </td>
        <td style="vertical-align:middle;font-family:Helvetica,Arial,sans-serif">
          <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#7b7566">Ticket</p>
          <p style="margin:0;font-size:20px;font-weight:bold;color:#36505D">${escapeHtml(code)}</p>
          <p style="margin:8px 0 0;font-size:13px;color:#5c5648">Show this QR code at the entrance. Each ticket admits one person and can be scanned once.</p>
        </td>
      </tr>
    </table>`).join("");

  return `<!DOCTYPE html><html><body style="margin:0;background:#f6f4ef;padding:24px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;margin:0 auto;max-width:640px;padding:32px;width:100%">
      <tr><td style="font-family:Helvetica,Arial,sans-serif;color:#36505D">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#b9a36b">Hilston Park</p>
        <h1 style="margin:0 0 18px;font-size:26px;color:#36505D">Your booking is confirmed</h1>
        <p style="margin:0 0 8px;font-size:15px">Hello ${escapeHtml(input.name)},</p>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Thank you for booking <strong>${escapeHtml(input.eventTitle)}</strong>. Your tickets are below.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="background:#f6f4ef;border-radius:12px;margin:0 0 24px;padding:16px;width:100%">
          <tr><td style="font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#36505D">
            <p style="margin:0 0 6px"><strong>When:</strong> ${escapeHtml(when)}</p>
            <p style="margin:0 0 6px"><strong>Where:</strong> ${escapeHtml(input.venue)}</p>
            <p style="margin:0"><strong>Tickets:</strong> ${input.ticketCodes.length}</p>
          </td></tr>
        </table>
        ${tickets}
        ${input.ticketUrl ? `<p style="margin:20px 0 0;font-size:14px"><a href="${input.ticketUrl}" style="color:#3f8175">View your tickets online</a></p>` : ""}
        <p style="margin:20px 0 0;font-size:13px;color:#5c5648;line-height:1.6">If the QR codes do not display, the same codes are attached to this email as images.</p>
        <p style="margin:16px 0 0;font-size:13px;color:#5c5648">Hilston Park, Monmouthshire</p>
      </td></tr>
    </table>
  </body></html>`;
}

export async function sendBookingConfirmation(input: { name: string; email: string; eventTitle: string; startsAt: string; venue: string; ticketCodes: string[]; ticketUrl?: string; pdf?: Buffer }) {
  const attachments = await Promise.all(input.ticketCodes.map(async (code) => ({ filename: `ticket-${code}.png`, content: await ticketQrPngBase64(code) })));
  if (input.pdf) attachments.unshift({ filename: "tickets.pdf", content: input.pdf.toString("base64") });
  return sendEmail({
    to: input.email,
    subject: `Your tickets for ${input.eventTitle}`,
    html: bookingConfirmationHtml(input),
    attachments,
  });
}

export async function sendStaffBookingAlert(input: { to: string; name: string; email: string; eventTitle: string; ticketCount: number }) {
  return sendEmail({
    to: input.to,
    subject: `New booking: ${input.eventTitle}`,
    html: `<p style="font-family:Helvetica,Arial,sans-serif">${escapeHtml(input.name)} (${escapeHtml(input.email)}) booked ${input.ticketCount} ticket(s) for <strong>${escapeHtml(input.eventTitle)}</strong>.</p>`,
  });
}
