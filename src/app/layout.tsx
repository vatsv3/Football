import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Football Auction Simulator',
  description: 'A real-time football auction and team management platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
