import { ReactNode } from 'react';
import '#/styles/globals.css';
import 'remixicon/fonts/remixicon.css';
import GlobalNav from '#/ui/global-nav';

export const metadata = {
  title: {
    default: 'Pake',
    template: '%s | Pake',
  },
  description: '利用 Rust 轻松构建轻量级多端桌面应用~',
};

export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="zh-CN" translate="no">
      <head />
      <body>
        <main className="main">
          <GlobalNav />
          {children}
        </main>
      </body>
    </html>
  );
}
