import type { Metadata, Viewport } from 'next';
import { Inter, Geist_Mono } from 'next/font/google';
import './globals.css';
import ToastContainer from '@/components/ToastContainer';
import ErrorBoundary from '@/components/ErrorBoundary';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f0' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0d0c' },
  ],
  colorScheme: 'light dark',
};

export const metadata: Metadata = {
  title: { default: 'TokoKu - Aplikasi Kasir Online untuk UMKM', template: '%s | TokoKu' },
  description: 'Aplikasi kasir online yang gampang dipake. Catat transaksi, atur stok, dan pantau omzet dari HP atau laptop. Gratis!',
  applicationName: 'TokoKu',
  authors: [{ name: 'TokoKu Team' }],
  creator: 'TokoKu',
  publisher: 'TokoKu',
  metadataBase: new URL('https://tokoku.app'),
  keywords: ['kasir online', 'aplikasi kasir', 'POS UMKM', 'manajemen stok', 'toko', 'usaha mikro'],
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'id_ID',
    siteName: 'TokoKu',
    title: 'TokoKu - Aplikasi Kasir Online untuk UMKM',
    description: 'Aplikasi kasir online yang gampang dipake. Catat transaksi, atur stok, dan pantau omzet dari HP atau laptop. Gratis!',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TokoKu - Aplikasi Kasir Online untuk UMKM',
    description: 'Aplikasi kasir online yang gampang dipake. Catat transaksi, atur stok, dan pantau omzet dari HP atau laptop. Gratis!',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `try{if(localStorage.getItem('darkMode')==='true')document.documentElement.classList.add('dark')}catch(e){}`
        }} />
      </head>
      <body className="h-full bg-canvas text-ink">
        <ErrorBoundary>{children}</ErrorBoundary>
        <ToastContainer />
      </body>
    </html>
  );
}
