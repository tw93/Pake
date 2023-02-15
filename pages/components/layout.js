import Navbar from './navbar'
import Head from 'next/head';
import 'remixicon/fonts/remixicon.css'

export default function Layout({ children }) {
  return (
    <>
      <Head>
        <title>Pake</title>
        <meta charSet="UTF-8" />
        <meta httpEquiv="X-UA-Compatible" content="ie=edge" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="title" content="Pake" />
        <meta
          name="description"
          itemProp="description"
          content="很简单的用 Rust 打包网页生成很小的桌面 App~"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="main">
        <Navbar />
        {children}
      </main>
    </>
  )
}
