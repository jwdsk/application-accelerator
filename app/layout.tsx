import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MetaPause — Accelerator Agent',
  description: 'AI-powered accelerator application drafting tool'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
