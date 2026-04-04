import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface ContactBody {
  name: string
  email: string
  phone?: string
  message: string
  service?: string
  stylist?: string
  website?: string // honeypot
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  let body: ContactBody

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request.' }, { status: 400 })
  }

  const { name, email, phone, message, service, stylist, website } = body

  // Honeypot — silently accept but do nothing
  if (website) {
    return NextResponse.json({ success: true })
  }

  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Name is required.' }, { status: 400 })
  }
  if (name.trim().length > 100) {
    return NextResponse.json({ success: false, error: 'Name must be 100 characters or fewer.' }, { status: 400 })
  }
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Email is required.' }, { status: 400 })
  }
  if (!isValidEmail(email.trim())) {
    return NextResponse.json({ success: false, error: 'Please enter a valid email address.' }, { status: 400 })
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ success: false, error: 'Message is required.' }, { status: 400 })
  }
  if (message.trim().length > 2000) {
    return NextResponse.json({ success: false, error: 'Message must be 2000 characters or fewer.' }, { status: 400 })
  }

  const toEmail = process.env.TO_EMAIL
  if (!toEmail) {
    return NextResponse.json({ success: false, error: 'Failed to send message. Please try again.' }, { status: 500 })
  }

  const safeName    = escapeHtml(name.trim())
  const safeEmail   = escapeHtml(email.trim())
  const safePhone   = phone   ? escapeHtml(phone.trim())   : '—'
  const safeMessage = escapeHtml(message.trim())
  const safeService = service ? escapeHtml(service.trim()) : '—'
  const safeStylist = stylist ? escapeHtml(stylist.trim()) : '—'
  const timestamp   = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; color: #0d0d0d;">
      <h2 style="margin-bottom: 24px; font-weight: 500;">New Booking Request — Sky Beauty Salon</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; width: 140px;">Name</td><td style="padding: 8px 0;">${safeName}</td></tr>
        <tr><td style="padding: 8px 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Email</td><td style="padding: 8px 0;">${safeEmail}</td></tr>
        <tr><td style="padding: 8px 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Phone</td><td style="padding: 8px 0;">${safePhone}</td></tr>
        <tr><td style="padding: 8px 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Service</td><td style="padding: 8px 0;">${safeService}</td></tr>
        <tr><td style="padding: 8px 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Stylist</td><td style="padding: 8px 0;">${safeStylist}</td></tr>
        <tr><td style="padding: 8px 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; vertical-align: top;">Message</td><td style="padding: 8px 0; white-space: pre-wrap;">${safeMessage}</td></tr>
        <tr><td style="padding: 8px 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em;">Received</td><td style="padding: 8px 0; color: #888;">${timestamp} ET</td></tr>
      </table>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #e0e0e0;" />
      <p style="font-size: 12px; color: #888;">Reply to this email to respond directly to ${safeName}.</p>
    </div>
  `

  try {
    await resend.emails.send({
      from: process.env.FROM_EMAIL ?? 'Sky Beauty Salon <onboarding@resend.dev>',
      to: toEmail,
      replyTo: email.trim(),
      subject: `New Booking Request — ${safeName}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to send message. Please try again.' },
      { status: 500 }
    )
  }
}
