import './styles/globals.css'

export const metadata = {
  title: 'Pake',
  description: '很简单的用 Rust 打包网页生成很小的桌面 App~',
};

export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" translate="no">
      <body>{children}</body>
    </html>
  );
}