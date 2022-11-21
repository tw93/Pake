from dataclasses import dataclass
from typing import Literal

TargetPlatform = Literal["linux", "windows", "macos"]

@dataclass
class Platform:
    '''平台信息

    -   target: 目标平台，可能的值有 ``linux``、``windows``、``macos``。
    -   cross_compile: 是不是跨平台编译？如果是，那 ``cross_compile`` 的值
        会是 ``target`` 可能值的其中一个；如果不是，则为 ``None``。'''
    target: TargetPlatform
    cross_compile: TargetPlatform | None
