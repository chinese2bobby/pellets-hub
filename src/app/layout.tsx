import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { COMPANY } from '@/config';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: `${COMPANY.name} - Kundenkonto`,
    template: `%s | ${COMPANY.name}`,
  },
  description: 'Holzpellets für Deutschland und Österreich - Premium Qualität, faire Preise.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className={`${inter.className} bg-[#FAFAF8] text-gray-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}
