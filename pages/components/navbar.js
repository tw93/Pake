import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Navbar() {
  const router = useRouter();
  const active = (path) => (router.pathname === `/${path}` ? 'active' : '');

  return (
    <>
      <div className="navbar bg-base-100">
        <div className="navbar-start flex flex-col pt-4 w-1/3">
          <a className="normal-case text-4xl italic font-bold text-black w-full">
            Pake
          </a>
          <p className="text-gray-700 text-md w-full mt-2">
            很简单的用 Rust 打包网页生成很小的桌面 App
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
