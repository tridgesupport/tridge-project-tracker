import { sendEmail } from '@/lib/brevo'

export async function sendInvoiceEmail({
  toEmail,
  ccEmails,
  invoiceNumber,
  monthLabel,
  pdfBuffer,
}: {
  toEmail: string
  ccEmails?: string | null
  invoiceNumber: string
  monthLabel: string
  pdfBuffer: Buffer
}) {
  const cc = (ccEmails || '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)

  // sendEmail throws on failure (the Brevo SDK raises typed errors rather
  // than resolving silently), so a failed send correctly surfaces to
  // generateAndSendInvoice and gets recorded as status='failed'.
  await sendEmail({
    to: toEmail,
    cc,
    subject: `Invoice #${invoiceNumber} - Tridge AMC for ${monthLabel}`,
    html: `
      <p>Hi,</p>
      <p>Please find attached the invoice for <strong>AMC for ${monthLabel}</strong>.</p>
      <p>Payment is due within 30 days.</p>
      <p>If you have any questions concerning this invoice, contact Hardik | 9820526174 | support@tridge.co.in</p>
      <p>It was a pleasure doing business with you.</p>
      <br/>
      <p>— Tridge Talentreprenurship Software Pvt. Ltd.</p>
    `,
    attachments: [
      {
        filename: `Invoice ${invoiceNumber}.pdf`,
        content: pdfBuffer,
      },
    ],
  })
}
