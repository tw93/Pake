"""Pake Builder – 官方打包软件配置读取模块

这个模块可以读取 ``app.toml`` 并
返回一个方便用来处理的结构。
"""

import tomllib
from typing import NotRequired, TypedDict, cast


class AppMeta(TypedDict):
    '''App 元数据

    -   id: App 的无空格、纯小写 ID。适合用于包名。
    -   url: App 对应的网站链结。
    -   category: App 的分类。列表
        [可参见此处](https://specifications.freedesktop.org/menu-spec/latest/apas02.html)。
    -   display_name: App 的显示名称。“default”为默认名称；
        其他为各地区语言代号及其对应名称。'''
    id: str
    url: str
    category: NotRequired[str]
    display_name: dict[str, str]


class AppTomlStructure(TypedDict):
    '''``app.toml`` 的结构'''
    app: list[AppMeta]


class MetaReader:
    '''``app.toml`` 的带缓存读取器'''
    cache: AppTomlStructure | None = None

    def __init__(self, filename: str):
        self.filename = filename

    def _read(self) -> AppTomlStructure:
        with open(self.filename, "rb") as m:
            data = tomllib.load(m)

            # FIXME: type checking
            return cast(AppTomlStructure, data)

    def read(self) -> AppTomlStructure:
        if not self.cache:
            self.cache = self._read()

        return self.cache
