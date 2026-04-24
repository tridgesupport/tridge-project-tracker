import { Resend } from 'resend'

export async function sendNextActionEmail({
  toEmail,
  toName,
  entityType,
  entityName,
  projectName,
  appUrl,
}: {
  toEmail: string
  toName: string
  entityType: 'Project' | 'Milestone' | 'Task'
  entityName: string
  projectName: string
  appUrl: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'noreply@tridge.co.in',
    to: toEmail,
    subject: `Action required: ${entityName}`,
    html: `
      <p>Hi ${toName},</p>
      <p>You have been assigned as the next action owner for <strong>${entityName}</strong> in project <strong>${projectName}</strong>.</p>
      <p>Please <a href="${appUrl}">log in to review</a>.</p>
      <br/>
      <p>— Tridge Project Tracker</p>
    `,
  })
}
