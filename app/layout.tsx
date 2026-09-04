import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Settlr',
  url: 'https://www.settlr.cyou',
  logo: 'https://www.settlr.cyou/icon.svg',
  sameAs: ['https://www.settlr.cyou'],
  description:
    'Settlr helps Indian ecommerce sellers reconcile marketplace settlements, identify missing payouts, and close reconciliation gaps across Amazon, Flipkart, and Meesho.',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    areaServed: 'IN',
    availableLanguage: ['en'],
  },
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.settlr.cyou'),
  applicationName: 'Settlr',
  title: {
    default: 'Settlr — Marketplace settlement reconciliation for Indian sellers',
    template: '%s | Settlr',
  },
  description:
    'Settlr helps Indian ecommerce sellers reconcile Meesho, Amazon, and Flipkart settlements with sales records to catch missing payouts, amount mismatches, duplicates, and return discrepancies.'[...]
  keywords: [
    'marketplace reconciliation',
    'Amazon settlement reconciliation',
    'Flipkart settlement reconciliation',
    'Meesho settlement reconciliation',
    'ecommerce reconciliation software',
    'seller payout reconciliation India',
    'settlement reconciliation tool',
    'marketplace fee reconciliation',
  ],
  alternates: {
    canonical: '/',
    languages: {
      'en-IN': '/',
    },
  },
  openGraph: {
    title: 'Settlr — Marketplace settlement reconciliation for Indian sellers',
    description:
      'Upload settlement and sales reports to catch missing payouts, mismatches, and return discrepancies before they hurt your margins.',
    url: 'https://www.settlr.cyou',
    siteName: 'Settlr',
    locale: 'en_IN',
    type: 'website',
    images: [
      {
        url: '/icon.svg',
        width: 512,
        height: 512,
        alt: 'Settlr logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Settlr — Marketplace settlement reconciliation for Indian sellers',
    description:
      'Upload settlement and sales reports to catch missing payouts, mismatches, and return discrepancies before they hurt your margins.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  other: {
    'geo.region': 'IN',
    'geo.placename': 'India',
    'geo.position': '20.5937;78.9629',
    ICBM: '20.5937, 78.9629',
    'target': 'all',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <meta name="theme-color" content="#0B172A" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Settlr" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationSchema),
          }}
        />
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-K7EVPL791L"
          strategy="afterInteractive"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-K7EVPL791L');
            `,
          }}
        />
      </head>
      <body className="bg-bg text-ink font-sans antialiased">{children}</body>
    </html>
  );
}
