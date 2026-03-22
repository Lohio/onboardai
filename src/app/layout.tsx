import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import { PageWrapper } from '@/components/shared/PageWrapper'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Heero — Onboarding inteligente',
  description: 'Plataforma de onboarding inteligente para startups latinoamericanas.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <PageWrapper>{children}</PageWrapper>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a1a19',
              color: '#e8eaf0',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              fontSize: '13px',
              padding: '10px 14px',
            },
            success: {
              iconTheme: { primary: '#0EA5E9', secondary: '#1a1a19' },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#1a1a19' },
            },
          }}
        />
      </body>
    </html>
  )
}
