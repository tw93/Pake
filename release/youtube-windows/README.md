# YouTube for Windows - Pake

Lightweight YouTube desktop app for Windows, built with Pake/Tauri and Microsoft WebView2.

This build includes an integrated YouTube ad-blocking layer focused on removing visible ad surfaces and reducing hidden pre-roll waiting time.

## Downloads

| File          | Purpose                                               |   Size |
| ------------- | ----------------------------------------------------- | -----: |
| `YouTube.exe` | Portable app. Run it directly, no installer required. | 8.6 MB |
| `YouTube.msi` | Windows x64 installer.                                | 3.3 MB |

## Features

- Native Windows desktop app based on WebView2.
- Lightweight Pake/Tauri packaging.
- Integrated YouTube ad-block profile.
- Removes common YouTube ad containers and companion ad surfaces.
- Speeds up hidden pre-roll skips to avoid long black-screen waits.
- Custom YouTube-style icon.
- Windows x64 only.

## How to use

Recommended portable option:

1. Download `YouTube.exe`.
2. Run it directly.
3. If Windows SmartScreen appears, choose the option to run it only if you trust this build.

Installer option:

1. Download `YouTube.msi`.
2. Run the installer.
3. Open `YouTube` from Windows.

## Verify downloads

Use SHA256 to verify that the downloaded files match this build.

```text
YouTube.exe  54FF24ADBD2B65D21508724EC45D22A199ED4C70086EFB85E9951D94D1F736F3
YouTube.msi  002DBC959C904D5846605C7A1E993DCD3BCD6B9615ADA04FCA34357E5E0E95C4
```

PowerShell example:

```powershell
Get-FileHash -Algorithm SHA256 .\YouTube.exe
Get-FileHash -Algorithm SHA256 .\YouTube.msi
```

## Build information

- Repository: `davidValades/Pake`
- Branch: `codex/youtube-adblock`
- Base project: Pake + Tauri v2
- WebView runtime: Microsoft WebView2
- Target platform: Windows x64

Build command:

```powershell
node dist/cli.js "https://www.youtube.com/" --name YouTube --icon src-tauri/png/youtube_256.ico --show-system-tray --adblock youtube --targets x64 --keep-binary
```

## Notes

YouTube changes its frontend and ad delivery behavior frequently. If ads become visible again, or if a video gets stuck on a black screen before playback, the injected ad-blocking logic may need to be updated.

This is an unofficial wrapper. It is not affiliated with YouTube, Google, Pake, Tauri, or Microsoft.

---

# YouTube para Windows - Pake

Aplicacion ligera de escritorio para YouTube en Windows, creada con Pake/Tauri y Microsoft WebView2.

Esta build incluye una capa integrada de bloqueo de anuncios de YouTube centrada en eliminar superficies visibles de anuncios y reducir la espera de los pre-rolls ocultos.

## Descargas

| Archivo       | Uso                                                   | Tamano |
| ------------- | ----------------------------------------------------- | -----: |
| `YouTube.exe` | App portable. Ejecutala directamente, sin instalador. | 8.6 MB |
| `YouTube.msi` | Instalador para Windows x64.                          | 3.3 MB |

## Caracteristicas

- App nativa para Windows basada en WebView2.
- Empaquetado ligero con Pake/Tauri.
- Perfil de bloqueo de anuncios de YouTube integrado.
- Elimina contenedores habituales de anuncios y anuncios laterales/companion.
- Acelera el salto de pre-rolls ocultos para evitar esperas largas en pantalla negra.
- Icono personalizado estilo YouTube.
- Solo Windows x64.

## Como usarla

Opcion portable recomendada:

1. Descarga `YouTube.exe`.
2. Ejecutalo directamente.
3. Si aparece Windows SmartScreen, ejecutalo solo si confias en esta build.

Opcion instalador:

1. Descarga `YouTube.msi`.
2. Ejecuta el instalador.
3. Abre `YouTube` desde Windows.

## Verificar descargas

Puedes usar SHA256 para comprobar que los archivos descargados coinciden con esta build.

```text
YouTube.exe  54FF24ADBD2B65D21508724EC45D22A199ED4C70086EFB85E9951D94D1F736F3
YouTube.msi  002DBC959C904D5846605C7A1E993DCD3BCD6B9615ADA04FCA34357E5E0E95C4
```

Ejemplo en PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 .\YouTube.exe
Get-FileHash -Algorithm SHA256 .\YouTube.msi
```

## Informacion de build

- Repositorio: `davidValades/Pake`
- Rama: `codex/youtube-adblock`
- Proyecto base: Pake + Tauri v2
- Runtime web: Microsoft WebView2
- Plataforma objetivo: Windows x64

Comando de build:

```powershell
node dist/cli.js "https://www.youtube.com/" --name YouTube --icon src-tauri/png/youtube_256.ico --show-system-tray --adblock youtube --targets x64 --keep-binary
```

## Notas

YouTube cambia con frecuencia su frontend y su forma de servir anuncios. Si vuelven a verse anuncios, o si un video se queda bloqueado en pantalla negra antes de reproducirse, habra que actualizar la logica inyectada del bloqueador.

Este es un wrapper no oficial. No esta afiliado con YouTube, Google, Pake, Tauri ni Microsoft.
