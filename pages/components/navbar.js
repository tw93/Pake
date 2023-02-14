import Link from 'next/link';
import { useRouter } from 'next/router';

export default function Navbar({ children }) {
  const router = useRouter();
  const pathName = router.pathname;
  return (
    <>
      <div className="navbar bg-base-100">
        <div className="navbar-start flex flex-col pt-4">
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
              <Link className={pathName === '/' ? 'active' : ''} href="/">
                在线编译
              </Link>
            </li>
            <li>
              <Link
                href="/recommend"
                className={pathName === '/recommend' ? 'active' : ''}
              >
                官方推荐
              </Link>
            </li>
            <li>
              <Link
                href="/myapp"
                className={pathName === '/myapp' ? 'active' : ''}
              >
                我的应用
              </Link>
            </li>
            <li>
              <Link
                href="/contributor"
                className={pathName === '/contributor' ? 'active' : ''}
              >
                贡献者们
              </Link>
            </li>
          </ul>
        </div>
        <div className="navbar-end xl:w-1/2 w-1/4"></div>
      </div>
    </>
  );
}
