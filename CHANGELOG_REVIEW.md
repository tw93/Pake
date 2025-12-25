# Changelog: Version 3.6.2 → 3.7.2

## Top 5 Changes (Ordered by Importance)

### 1. 🚀 Performance & Build Optimizations
**Impact**: All platforms, reduces binary size and improves runtime performance

- Added Rust release profile optimizations in `src-tauri/Cargo.toml`:
  - LTO (Link-Time Optimization) set to "thin" for faster, smaller binaries
  - Optimization level set to "z" for maximum size reduction
  - Enabled binary stripping to remove debug symbols
  - Optimized codegen-units for better compilation performance
- **Result**: Significantly smaller application binaries and improved runtime performance

**Key Files**: `src-tauri/Cargo.toml` (new `[profile.release]` section)

---

### 2. 🎨 Icon Handling System Overhaul
**Impact**: Improved user experience, reduced network dependencies, better platform compatibility

- **Local Icon Support**: Applications now check for existing local icons before downloading, reducing network requests and build times
- **Replaced axios with native fetch**: Migrated from axios to fetch API with proper timeout handling and AbortController
- **Platform-Specific Icon Naming**:
  - Linux: Uses proper package naming conventions
  - Windows/macOS: Safe filename generation
  - Fallback to 'pake-app' when name is unavailable
- **Icon Build Artifacts**: Icons are now automatically copied to build output for all platforms
- **Enhanced Error Handling**: Better timeout management, clearer error messages, graceful fallback behavior

**Key Files**:
- `bin/options/icon.ts` (downloadIcon, handleIcon, generateIconPath)
- `bin/builders/BaseBuilder.ts` (icon copying logic)
- `bin/utils/name.ts` (platform-specific naming)

---

### 3. 🔗 Intelligent Link & Download Handling
**Impact**: Fixes critical bug where media files were incorrectly treated as downloads

- **Media Preview Support**: Added distinction between previewable media (images, videos, audio) and downloadable files
- **New `PREVIEWABLE_MEDIA_EXTENSIONS` list**: 25+ media formats (png, jpg, mp4, webm, mp3, etc.)
- **Smart Link Detection**: Links to previewable media now open directly in the app instead of triggering downloads
- **Fixes CDN Issues**: Resolves problems where CDN-hosted images were incorrectly blocked as external links
- **Improved Download Detection**: Better logic for identifying actual downloads vs. previewable content

**Key Files**: `src-tauri/src/inject/event.js` (isPreviewableMedia, isDownloadableFile, link handling)

---

### 4. 🛡️ Enhanced Error Handling & Robustness
**Impact**: Improved stability and better error reporting across the application

- **Rust Error Handling Improvements**:
  - Replaced `.unwrap()` calls with proper `Result` types and error propagation
  - Added descriptive error messages throughout invoke.rs and menu.rs
  - Menu functions now return `tauri::Result<T>` instead of panicking
- **Menu System Refactoring**:
  - Made menu functionality macOS-specific with `#![cfg(target_os = "macos")]`
  - Extracted menu building into modular functions (app_menu, file_menu, edit_menu, etc.)
  - Improved error propagation with the `?` operator
- **Download Command Safety**:
  - Added null checks for window handles
  - Proper path validation before file operations
  - Better error messages for failed downloads

**Key Files**:
- `src-tauri/src/app/invoke.rs` (download_file, download_file_by_binary)
- `src-tauri/src/app/menu.rs` (complete refactoring)

---

### 5. 🧪 Testing & CI/CD Infrastructure
**Impact**: Long-term code quality, better release reliability, faster development cycles

- **New Test Suite**:
  - Added 256 lines of file-finding tests (`tests/unit/file-finding.test.js`)
  - Added 131 lines of builder tests (`tests/unit/builders.test.ts`)
  - Added 228 lines of workflow path integration tests (`tests/integration/workflow-paths.test.js`)
  - Improved release artifact testing (removed 878 lines of outdated github.js)
- **CI/CD Improvements**:
  - Optimized GitHub Actions workflows with dedicated CLI build job
  - Enhanced artifact finding logic in release workflows
  - Added comprehensive unit and integration tests for release process
  - Standardized test timeouts across the codebase
- **Test Runner Consolidation**: Unified test execution with better error reporting

**Key Files**:
- `tests/unit/*`, `tests/integration/*`
- `.github/workflows/quality-and-test.yml`
- `.github/workflows/release.yml`

---

## Additional Notable Changes

### Linux Packaging Enhancements
- Consistent binary naming across DEB, RPM, and AppImage formats
- Improved desktop file generation with RPM support
- Fixed target selection to support multiple package types

### Dependency Updates
- **Tauri**: 2.9.4 → 2.9.5
- **Node Packages**: Major updates to @tauri-apps/api, commander, file-type, sharp, and build tools
- **Removed axios dependency** entirely in favor of native fetch
- **pnpm**: 10.15.0 → 10.26.2

### Code Quality
- Auto-formatting fixes across the codebase
- Removed redundant `cli:dev` script
- Cleaned up unused imports and dependencies
- Better TypeScript types and error handling

---

## Version Summary
- **From**: 3.6.2 (commit d3c40bf)
- **To**: 3.7.2 (commit d55cafe)
- **Files Changed**: 38 files
- **Lines Added/Removed**: ~2,900 insertions, ~2,900 deletions
- **Major Version Bumps**: 3.6.2 → 3.6.3 → 3.6.4 → 3.7.0 → 3.7.1 → 3.7.2
