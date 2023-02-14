export default function Navbar({ children }) {
  return (
    <>
      <div className="navbar bg-base-100">
        <div className="navbar-start">
          <a className="btn btn-ghost normal-case text-lg">Pake</a>
        </div>
        <div className="navbar-center flex">
          <ul className="menu menu-horizontal px-1">
            <li>
              <a>在线编译</a>
            </li>
            <li>
              <a>官方推荐</a>
            </li>
            <li>
              <a>图标素材</a>
            </li>
            <li>
              <a>我的应用</a>
            </li>
          </ul>
        </div>
        <div className="navbar-end"></div>
      </div>
    </>
  );
}
