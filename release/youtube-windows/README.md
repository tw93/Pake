# YouTube para Windows - Pake

Aplicacion ligera de YouTube para Windows, empaquetada con Pake/Tauri y WebView2.

## Descarga

- `YouTube.exe`: ejecutable portable.
- `YouTube.msi`: instalador MSI para Windows x64.

## Caracteristicas

- App nativa ligera basada en WebView2.
- Bloqueo de anuncios de YouTube integrado.
- Oculta superficies visibles de anuncios.
- Acelera el salto de pre-rolls ocultos para evitar esperas largas en pantalla negra.
- Icono personalizado de YouTube.
- Solo Windows x64.

## Uso

Opcion recomendada:

1. Descarga `YouTube.exe`.
2. Ejecutalo directamente.

Opcion instalador:

1. Descarga `YouTube.msi`.
2. Ejecuta el instalador.
3. Abre la app desde Windows.

## Verificacion SHA256

```text
YouTube.exe  218757CD5A6A7B4B95ED6B17C7EF841F840CDD19AECE81B4050D5C8625EEE69A
YouTube.msi  17AA3CA59EBD8560EB8A8AEBDCFC8664013BE7AAA79DAC4A8B93D1F46C5299CE
```

## Build

Generado desde el fork:

- Repositorio: `davidValades/Pake`
- Rama: `codex/youtube-adblock`
- Base: Pake + Tauri v2
- Plataforma: Windows x64

Comando de build usado:

```powershell
node dist/cli.js "https://www.youtube.com/" --name YouTube --icon src-tauri/png/youtube_256.ico --show-system-tray --adblock youtube --targets x64 --keep-binary
```

## Nota

YouTube cambia con frecuencia su frontend y sus mecanismos de anuncios. Si vuelve a aparecer pantalla negra prolongada o anuncios visibles, habra que actualizar la inyeccion del bloqueador.
