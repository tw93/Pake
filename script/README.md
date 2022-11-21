# Pake Builder

## 使用说明

- Python 版本要求 3.11 以上
- 运行 `build.py` 自动编译当前架构的程序。

## TODO

### High-levels

- [ ] 共享编译缓存 (target)
- [ ] 可以用 CI 建構（上傳 master 時自動編譯上傳）
- [ ] 支援跨平台編譯 (#96)

### Low-levels

- [x] 避免写死逻辑
- [ ] 移植 Tauri 的文件生成逻辑
- [ ] 写个 `BuilderExecutor`
- [ ] 自动拷贝当前 Git 树到 tmp 文件夹
- [ ] 写个 `AppBuildExecutor` 进行 app 面的建置与 tmp 管理
- [ ] 与 Linux/Windows 作者 (@Tlntin) 合作移植 Windows / Linux 的编译逻辑
- [ ] 乱序优化编译逻辑
- [ ] 降低 Python 的需求版本 (到 3.9 ↓)
