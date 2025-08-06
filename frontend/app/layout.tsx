import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VibeSnap - AI PDF Generator',
  description: 'Transform any website into a beautiful PDF with AI-powered precision',
  keywords: 'PDF generator, website to PDF, AI tools, web scraping',
  authors: [{ name: 'VibeSnap Team' }],
  openGraph: {
    title: 'VibeSnap - AI PDF Generator',
    description: 'Transform any website into a beautiful PDF with AI-powered precision',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--card)',
              color: 'var(--card-foreground)',
              border: '1px solid var(--border)',
            },
          }}
        />
      </body>
    </html>
  )
}