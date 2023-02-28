import Navbar from './navbar'
import 'remixicon/fonts/remixicon.css'
import { PropsWithChildren } from 'react';

export default function Layout({ children }: PropsWithChildren) {
  return (
    <>
      <main className="main">
        <Navbar />
        {children}
      </main>
    </>
  )
}
