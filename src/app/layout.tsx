import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Warehouse Order Queue & Dispatch Monitoring System',
  description: 'Sistem monitoring antrian pesanan, meja packing, dan pickup kurir gudang terpadu',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full" suppressHydrationWarning>
      <body className="min-h-full flex flex-col antialiased bg-[var(--bg-primary)] text-[var(--text-primary)]" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
