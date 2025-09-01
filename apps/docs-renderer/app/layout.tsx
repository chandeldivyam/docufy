export const metadata = {
  title: 'Docufy',
  description: 'Open-source documentation platform',
};

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
