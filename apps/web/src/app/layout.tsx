import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AIROVE - Aviation Operations Intelligence',
  description: 'AI-powered aviation baggage operations and recovery platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
