import Navbar from './navbar'
import Footer from './footer'
import Head from 'next/head';

export default function Layout({ children }) {
  return (
    <>
      <Head>
        <title>Pake</title>
        <meta charset="UTF-8" />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1,minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="title" content="Pake" />
        <meta
          name="description"
          itemprop="description"
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
