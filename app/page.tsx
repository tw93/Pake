'use client';

import '#/styles/page.scss';
import { useState } from 'react';
import Image from 'next/image';
import Folder from '../public/images/folder.png';

export default function Home() {
  const [visible, setVisible] = useState(true);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [link, setLink] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [shortcut, setShortcut] = useState<any[]>([]);
  const [header, setHeader] = useState('');
  const [fullscreen, setFullscreen] = useState('');

  const handleVisible = () => {
    setVisible(!visible);
    console.log('submit', {
      name,
      icon,
      link,
      width,
      height,
      shortcut,
      header,
      fullscreen,
    });
  };

  const handleKeyDown = (event: any) => {
    if (shortcut.length >= 3) {
      return;
    }
    const { key, keyCode } = event;
    setShortcut([...shortcut, { key, keyCode }]);
    event.preventDefault();
  };

  return (
    <div className="py-14">
      <div className="flex justify-center">
        <div
          className={`page-form flex-1 ${visible ? '' : 'page-form-compiling'}`}
        >
          {/* name */}
          <div className="page-item flex">
            <div className="page-icon flex items-center justify-center">
              <i className="ri-markup-line"></i>
            </div>
            <input
              type="text"
              placeholder="输入应用名称"
              value={name}
              onChange={({ target: { value } }) => setName(value)}
              className="page-input input-bordered input w-full"
            />
          </div>
          {/* application icon */}
          <div className="page-item flex">
            <div className="page-icon flex items-center justify-center">
              <i className="ri-meteor-line"></i>
            </div>
            <input
              type="text"
              placeholder="上传应用图标"
              value={icon}
              onChange={({ target: { value } }) => setIcon(value)}
              className="page-input input-bordered input w-full"
            />
            <div className="page-input-suffix">upload</div>
          </div>
          {/* link */}
          <div className="page-item flex">
            <div className="page-icon flex items-center justify-center">
              <i className="ri-link-unlink"></i>
            </div>
            <input
              type="text"
              placeholder="输入目标地址"
              value={link}
              onChange={({ target: { value } }) => setLink(value)}
              className="page-input input-bordered input w-full"
            />
          </div>
          {/* resolution ratio */}
          <div className="page-item flex">
            <div className="page-icon flex items-center justify-center">
              <i className="ri-merge-cells-horizontal"></i>
            </div>
            <input
              type="number"
              placeholder="输入窗口长度"
              value={width}
              onChange={({ target: { value } }) => setWidth(value)}
              className="page-input input-bordered input w-full"
            />
            <i className="ri-close-line self-center pl-5 pr-5"></i>
            <input
              type="number"
              placeholder="输入窗口宽度"
              value={height}
              onChange={({ target: { value } }) => setHeight(value)}
              className="page-input-normal input-bordered input w-full"
            />
          </div>
          {/* shortcut */}
          <div className="page-item flex">
            <div className="page-icon flex items-center justify-center">
              <i className="ri-keyboard-box-line"></i>
            </div>
            <input
              placeholder="请设置唤醒快捷键"
              className="page-input-transparent  input-bordered input flex w-full items-center"
              onKeyDown={handleKeyDown}
              value={shortcut}
              readOnly
            />
            <div className="page-shortcut flex">
              {shortcut.map((element: any, index: number) => (
                <div className="flex items-center" key={index}>
                  {index ? <i className="ri-add-line pl-1 pr-1"></i> : ''}
                  <kbd className="kbd">{element.key}</kbd>
                </div>
              ))}
            </div>
            {shortcut.length ? (
              <div
                className="page-input-suffix"
                onClick={() => setShortcut([])}
              >
                clear
              </div>
            ) : (
              ''
            )}
          </div>
          {/* header */}
          <div className="page-item flex">
            <div className="page-icon flex items-center justify-center">
              <i className="ri-layout-top-2-line"></i>
            </div>
            <select
              value={header}
              className="page-select select-bordered select w-full"
              onChange={({ target: { value } }) => setHeader(value)}
            >
              <option disabled value={''}>
                是否开启沉浸头部
              </option>
              <option value={1}>是</option>
              <option value={0}>否</option>
            </select>
          </div>
          {/* full screen */}
          <div className="page-item flex">
            <div className="page-icon flex items-center justify-center">
              <i className="ri-aspect-ratio-line"></i>
            </div>
            <select
              value={fullscreen}
              className="page-select select-bordered select w-full"
              onChange={({ target: { value } }) => setFullscreen(value)}
            >
              <option disabled value={''}>
                是否开启全屏
              </option>
              <option value={1}>是</option>
              <option value={0}>否</option>
            </select>
          </div>
          {/* compiling */}
          <button onClick={handleVisible} className="page-button">
            立即编译
          </button>
        </div>
        <div className="page-card flex items-center justify-center">
          <div className="page-card-control flex">
            <div></div>
            <div></div>
            <div></div>
          </div>
          <div className="page-card-icon flex items-center justify-center">
            <Image
              className="page-card-image"
              src={Folder}
              width={500}
              height={500}
              alt={''}
            ></Image>
          </div>
          <i className="ri-arrow-right-line pl-20 pr-20 text-3xl"></i>
          <Image className="page-card-folder" src={Folder} alt={''} />
          <div
            className={`page-card-footer flex items-center justify-between ${
              visible ? '' : 'page-card-footer-compiling'
            }`}
          >
            <div>应用正在编译，激动的心颤抖的手</div>
            <div className="flex items-center">
              <i className="ri-arrow-drop-left-line font-bold"></i>
              <div className="pl-4 pr-4 font-semibold italic">8/8</div>
              <i className="ri-arrow-drop-right-line font-bold"></i>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
