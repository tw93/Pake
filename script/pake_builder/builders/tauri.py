"""Pake Builder – Tauri 文件生成模块"""

from pathlib import Path
from .abstract import FileBuilderAbstract

class TauriConfigFileBuilder(FileBuilderAbstract):
    def target_path(self, root: Path) -> Path:
        return root / "src-tauri" / "tauri.conf.json"

    def build(self) -> bytes:
        # TODO
        return super().build()
