'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function GlobalNav() {
  const pathname = usePathname();
  const active = (path: string) => (pathname === `/${path}` ? 'active' : '');

  return (
    <>
      <div className="navbar bg-base-100">
        <div className="navbar-start flex w-1/3 flex-col pt-4">
          <a className="w-full text-4xl font-bold normal-case italic text-black">
            Pake
          </a>
          <p className="text-md mt-2 w-full text-gray-700">
            利用 Rust 轻松构建轻量级多端桌面应用
          </p>
        </div>
        <div className="navbar-center flex">
          <ul className="menu menu-horizontal px-1">
            <li>
              <Link className={active('')} href="/">
                在线编译
              </Link>
            </li>
            <li>
              <Link href="/recommend" className={active('recommend')}>
                官方推荐
              </Link>
            </li>
            <li>
              <Link href="/my" className={active('my')}>
                我的应用
              </Link>
            </li>
            <li>
              <Link href="/contributor" className={active('contributor')}>
                贡献者们
              </Link>
            </li>
          </ul>
        </div>
        <div className="navbar-end w-1/5 pt-2">
          <a
            className="ri-twitter-fill ri-xl mr-7"
            target="_blank"
            rel="noreferrer"
            href="https://twitter.com/HiTw93"
          ></a>
          <a
            className="ri-github-fill ri-xl mr-7"
            target="_blank"
            rel="noreferrer"
            href="https://github.com/tw93/Pake"
          ></a>
          <i className="ri-settings-fill ri-xl cursor-pointer"></i>
        </div>
      </div>
    </>
  );
}
