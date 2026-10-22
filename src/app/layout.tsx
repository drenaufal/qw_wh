import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Warehouse Packing & Courier Pickup Monitoring System',
  description: 'Real-time multi-display warehouse queue and pickup tracking system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col antialiased bg-[#0a0f1d] text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
