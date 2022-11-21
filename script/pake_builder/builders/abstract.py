"""Pake Builder – 文件生成模块的抽象

将各个文件的生成逻辑抽象为一个类，方便之后写个 executor
全自动运行。虽然高度抽象，但仍然保有极大自定义生成逻辑的空间
（比如根据平台决定要不要生成文件，见 ``desktop.py``）。

详情见 ``FileBuilderAbstract``。
"""

from abc import ABC, abstractmethod
from pathlib import Path
from ..platform import Platform
from ..meta import AppMeta

class FileBuilderAbstract(ABC):
    """文件生成器的抽象类

    Builder 会从 Executor 收到三样参数：

    - ``root``: 项目的根目录，可以理解成 ``README.md`` 和
      ``package.json`` 所在的目录。届时收到的 root 会放置在
        /tmp 缓存文件夹内（每个 app 一个 root）——所以请尽情修改里面的内容。
    - ``meta``: 这个 app 项目的元数据，是一个 ``AppMeta`` 对象。
      里面包含软件的代号、分类，以及各地区语言的对应软件名称。
      详情参阅 ``AppMeta``。
    - ``platform``: 编译平台的信息，包含目的平台的代称，以及是否是跨平台编译。
      这个 ``platform`` 可以帮助您“条件生成”文件，比如在 Linux 平台下生成
      ``.desktop`` 而其他平台不进行生成。

    ``target_path`` 和 ``build`` 作为抽象方法 (abstract method)，
    是必须复写 (override) 的方法。``write`` 除非要进行条件生成，
    否则维持原状即可。如果要进行条件生成，绝大多数的情况也可以直接呼叫
    ``super().write()`` 进入原始的写入函数（示例参考 ``desktop.py``）。
    """

    def __init__(self, root: Path, meta: AppMeta, platform: Platform) -> None:
        super().__init__()
        self.root = root
        self.meta = meta
        self.platform = platform

    @abstractmethod
    def target_path(self, root: Path) -> Path: pass

    @abstractmethod
    def build(self) -> bytes: pass

    def write(self) -> None:
        filename = self.target_path(self.root)

        try:
            with open(filename, "wb") as f:
                f.write(self.build())
        except FileNotFoundError as e:
            print(f"{e.filename} does not exist. Creating it...")
            (filename / '..').mkdir(parents=True, exist_ok=False)
            return self.write()
