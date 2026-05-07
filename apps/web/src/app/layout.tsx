import { DM_Serif_Display, DM_Sans } from 'next/font/google';
import './globals.css';

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  variable: '--font-display',
  weight: '400',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata = {
  title: 'Kebi - AI Place Recommendations',
  description: 'An AI-native place decision engine',
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // Resize layout viewport when virtual keyboard opens so content isn't hidden
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning className={`${dmSerif.variable} ${dmSans.variable}`}>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
