export const metadata = {
  title: 'Docufy Dashboard',
  description: 'Admin dashboard for Docufy',
};

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
