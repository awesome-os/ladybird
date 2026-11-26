# Awesome-OS Deliverables for Ladybird (`awesome-os/ladybird`)

> **License:** BSD-2-Clause / BSD-3-Clause compatible C11 (`Bridges/AwesomeOS/`)  
> **ABI Contract:** `B8G_ABI_MAGIC_V3` (`0x33564742U`), 64-byte cache-line alignment (`_Alignas(64)` on first struct member), zero `<linux/*.h>` headers, zero desktop-UI coupling.

This document summarizes the three ready-to-integrate C11 accelerator bridges in [`Bridges/AwesomeOS/`](../Bridges/AwesomeOS/) that close the top missing Chrome-parity gaps identified in [`CHROME-PARITY-GAP-ANALYSIS.md`](./CHROME-PARITY-GAP-ANALYSIS.md), alongside the shared-library deduplication overlap between Ladybird's [`vcpkg.json`](../vcpkg.json) and Awesome-OS's `max-version-lock.json` / `v11` CAS lockfile.

---

## 1. Ready-to-Integrate C11 Accelerator Bridges (`Bridges/AwesomeOS/`)

All three bridges live in [`Bridges/AwesomeOS/b8g_ladybird_bridges.h`](../Bridges/AwesomeOS/b8g_ladybird_bridges.h) and [`Bridges/AwesomeOS/b8g_ladybird_bridges.c`](../Bridges/AwesomeOS/b8g_ladybird_bridges.c), verified by [`Bridges/AwesomeOS/bridge_test.c`](../Bridges/AwesomeOS/bridge_test.c) under `-std=c11 -O2 -Wall -Wextra -Werror` across:

- **Windows x64** (native PE executable test run)
- **`x86_64-linux-musl`** (cross-compiled object verification)
- **`wasm32-wasi`** (cross-compiled object verification)

### 1.1 WebGPU Bridge (`B8gWebGpuRing`)

- **Closes Chrome Gap:** `WebGPU` + `WGSL` (`0` `.idl` files in baseline Ladybird).
- **Integration Target:** `Libraries/LibWeb/WebGPU/` -> `awesome-os/sectium` (`holo-display-webgpu`) + Dawn.
- **API:**
  - `b8g_webgpu_ring_init(B8gWebGpuRing *ring)`
  - `b8g_webgpu_submit_cmd(B8gWebGpuRing *ring, uint32_t opcode, uint64_t wgpu_handle, uint32_t byte_len)`
  - `b8g_webgpu_drain(B8gWebGpuRing *ring, B8gWebGpuCmd *out_cmds, size_t max)`
- **Properties:**
  - 64-byte aligned (`_Alignof(B8gWebGpuRing) == 64`), `B8G_ABI_MAGIC_V3` stamped.
  - Lock-free single-producer/single-consumer power-of-2 ring (`capacity = 64`) with monotonic `seq` numbering, overflow drop counter (`dropped`), and wrap-around safety.

### 1.2 OPFS-to-v11-CAS Bridge (`B8gOpfsCasHandle`)

- **Closes Chrome Gap:** Origin Private File System (`FileSystemSyncAccessHandle`, early stub in baseline Ladybird).
- **Integration Target:** `Libraries/LibWeb/FileAPI/` & `Services/WebContent/` -> B8G `v11` CAS (`/var/lib/b8g/cas/v11/files/<aa>/<digest>`).
- **API:**
  - `b8g_opfs_resolve_cas_path(const char *cas_root, const char *sha512_hex, char *out_path, size_t out_len)`
  - `b8g_opfs_handle_init(B8gOpfsCasHandle *handle, const char *cas_root, const char *sha512_hex, uint64_t size_bytes, uint32_t flags)`
- **Security & Layout Invariants:**
  - Strictly accepts 64-hex (SHA-256) or 128-hex (SHA-512) digests and normalizes output paths to lowercase hex.
  - Rejects path traversal (`..`, `/`, `\`, control chars) in both `cas_root` and `sha512_hex` with `B8G_ERR_TRAVERSAL`.
  - Maps directly onto `<cas_root>/v11/files/<aa>/<digest>` (default root `/var/lib/b8g/cas`) for zero-copy content-addressed storage shared with `holo-web-service-worker`.

### 1.3 Generic Hardware WebCodecs Bridge (`B8gWebCodecsSession`)

- **Closes Chrome Gap:** Hardware `WebCodecs` (`VideoDecoder` / `AudioDecoder`, `0` `.idl` files in baseline Ladybird).
- **Integration Target:** `Libraries/LibMedia/` & `Libraries/LibMediaCodecs/`.
- **API:**
  - `b8g_webcodecs_select_backend(B8gCodecId codec_id, const char *modalias, B8gHwAccelBackend *out_backend)`
  - `b8g_webcodecs_backend_name(B8gHwAccelBackend backend)`
  - `b8g_webcodecs_session_init(B8gWebCodecsSession *session, B8gCodecId codec_id, const char *modalias, uint32_t width, uint32_t height)`
- **Hardware Modalias Routing (Zero Desktop-UI Coupling):**

| Hardware / Modalias Pattern | Selected Backend | `b8g_webcodecs_backend_name()` | Codecs |
| :--- | :--- | :--- | :--- |
| AMD (`pci:v00001002*`, `amdgpu`) | `B8G_HW_BACKEND_VULKAN_VIDEO` | `"vulkan-video"` | `H264`, `HEVC`, `VP9`, `AV1` |
| Intel (`pci:v00008086*`, `i915`, `vaapi`) | `B8G_HW_BACKEND_VAAPI` | `"vaapi"` | `H264`, `HEVC`, `VP9`, `AV1` |
| Nvidia (`pci:v000010DE*`, `nvidia`, `nvdec`) | `B8G_HW_BACKEND_NVDEC` | `"nvdec"` | `H264`, `HEVC`, `VP9`, `AV1` |
| macOS / Darwin (`videotoolbox`, `darwin`, `macos`) | `B8G_HW_BACKEND_VIDEOTOOLBOX` | `"videotoolbox"` | `H264`, `HEVC`, `VP9`, `AV1` |
| Apple Silicon Linux/Asahi (`apple,avd`, `apple-avd`) | `B8G_HW_BACKEND_APPLE_AVD` | `"apple-avd"` | `H264`, `HEVC`, `VP9`, `AV1` |
| Generic / VirtIO / Unknown GPU | `B8G_HW_BACKEND_VULKAN_VIDEO` | `"vulkan-video"` | `H264`, `HEVC`, `VP9`, `AV1` |

---

## 2. `max-version-lock.json` Shared Library Overlap (Deduplication via `v11` CAS)

Ladybird's [`vcpkg.json`](../vcpkg.json) pins 40+ native C/C++ libraries that directly overlap with Awesome-OS's unified `max-version-lock.json` / `holo-compiler-lockfile.json` (`v11` CAS) graph. Rather than shipping duplicate copies per browser or desktop app, Awesome-OS deduplicates these shared dependencies by SHA-512 content address under `/var/lib/b8g/cas/v11/files/`:

| Subsystem | Library | Ladybird `vcpkg.json` Pin | Awesome-OS `max-version-lock.json` / `v11` CAS Role |
| :--- | :--- | :--- | :--- |
| **2D / GPU** | `skia` | `148#0` | Shared across `awesome-os/skia`, `sectium-display`, and `LibGfx` |
| **3D / GL** | `angle` | `chromium_7258#2` | Shared WebGL-over-Vulkan/Metal/D3D translation layer |
| **Vulkan** | `vulkan-headers` / `vulkan-memory-allocator` | `1.4.363.0#0` / `3.5.0#0` | Shared with `awesome-os/dawn` (`holo-display-webgpu`) & Vulkan Video |
| **Media** | `ffmpeg` + `dav1d` | `9.0.2#1` / `1.5.4#0` | Shared hardware/software decode substrate (`LibMedia` + `B8gWebCodecsSession`) |
| **Text / i18n** | `icu`, `harfbuzz`, `freetype`, `fontconfig`, `woff2` | `78.3#4`, `10.2.0#0`, `2.13.3#0`, `2.17.1#2`, `1.0.2#5` | Deduplicated text-shaping & font stack across `sectium` & `ladybird` |
| **Images** | `libavif`, `libwebp`, `libjpeg-turbo`, `libpng`, `tiff`, `wuffs` | `1.4.2#1`, `1.6.0#3`, `3.2.1#0`, `1.6.59#0`, `4.7.2#0`, `0.3.5#0` | Single `v11` CAS image codec layer |
| **Network / TLS** | `openssl`, `curl`, `nghttp2`, `brotli`, `zlib` | `3.6.5#1`, `8.23.0#3`, `1.71.0#0`, `1.2.1#0`, `1.4#0` | Shared TLS/HTTP2/HTTP3/compression primitives |
| **Storage / Alloc** | `sqlite3`, `mimalloc`, `simdjson`, `simdutf` | `3.54.1#0`, `2.2.7#1`, `5.1.1#0`, `9.5.0#0` | Shared secure allocator, SIMD parsers, and OPFS/IndexedDB backing |

---

## 3. Hermetic Build & Verification

Compile and run the unit test suite natively on Windows 11 (zero WSL) via `holo-compiler` / `zig cc`:

```powershell
# Native Win64 build & execute
e:\awesome-os\bin\zig.cmd cc -std=c11 -O2 -Wall -Wextra -Werror `
  Bridges/AwesomeOS/b8g_ladybird_bridges.c Bridges/AwesomeOS/bridge_test.c `
  -o Bridges/AwesomeOS/bridge_test.exe
.\Bridges\AwesomeOS\bridge_test.exe

# Cross-compile verification (0 warnings under -Werror)
e:\awesome-os\bin\zig.cmd cc -target x86_64-linux-musl -std=c11 -O2 -Wall -Wextra -Werror `
  -c Bridges/AwesomeOS/b8g_ladybird_bridges.c -o Bridges/AwesomeOS/b8g_ladybird_bridges.linux.o
e:\awesome-os\bin\zig.cmd cc -target wasm32-wasi -std=c11 -O2 -Wall -Wextra -Werror `
  -c Bridges/AwesomeOS/b8g_ladybird_bridges.c -o Bridges/AwesomeOS/b8g_ladybird_bridges.wasi.o
```
