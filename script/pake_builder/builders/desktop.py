"""Pake Builder – ``.desktop`` 文件生成模块

For linux.
"""

from pathlib import Path
from .abstract import FileBuilderAbstract


class DesktopFileBuilder(FileBuilderAbstract):
    def _id(self) -> str:
        return f"run-pake-{self.meta['id']}"

    def target_path(self, root: Path) -> Path:
        return root / "src-tauri" / "assets" / f"{self._id()}.desktop"

    def build(self) -> bytes:
        id = self._id()
        meta = self.meta

        buf = [
            "[Desktop Entry]",
            "Type=Application",
            "Encoding=UTF-8",
            "StartupNotify=true",
            "Terminal=false",
            f"Categories={meta['category']}" if "category" in meta else None,
            f"Exec={id}",
            f"Icon={id}",
        ]

        for lang, value in meta["display_name"].items():
            key = f"Name[{lang}]" if lang != "default" else "Name"

            buf.append(f"{key}={value}")

        return "\n".join(filter(None, buf)).encode("UTF-8")

    def write(self) -> None:
        if self.platform.target == "linux":
            super().write()
        else:
            # Not on Linux, ignore.
            pass
