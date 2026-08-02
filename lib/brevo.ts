import { BrevoClient } from '@getbrevo/brevo'

let client: BrevoClient | null = null
function getClient(): BrevoClient {
  if (!client) client = new BrevoClient({ apiKey: process.env.BREVO_API_KEY! })
  return client
}

export async function sendEmail({
  to,
  cc,
  subject,
  html,
  attachments,
}: {
  to: string
  cc?: string[] | null
  subject: string
  html: string
  attachments?: { filename: string; content: Buffer }[]
}) {
  await getClient().transactionalEmails.sendTransacEmail({
    sender: {
      email: process.env.EMAIL_FROM || 'support@tridge.co.in',
      name: process.env.EMAIL_FROM_NAME || 'Tridge Project Tracker',
    },
    to: [{ email: to }],
    ...(cc && cc.length ? { cc: cc.map(email => ({ email })) } : {}),
    subject,
    htmlContent: html,
    ...(attachments && attachments.length
      ? { attachment: attachments.map(a => ({ name: a.filename, content: a.content.toString('base64') })) }
      : {}),
  })
}
