#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface LibStats {
  files: number;
  cppFiles: number;
  idlFiles: number;
  fixmes: number;
  todos: number;
  dbglnStubs: number;
}

interface FeatureProbe {
  readonly id: string;
  readonly area: string;
  readonly chromeBaseline: string;
  readonly idlPatterns: readonly RegExp[];
  readonly awesomeOsAccelerator: string;
}

const FEATURE_PROBES: readonly FeatureProbe[] = [
  { id: 'webgpu', area: 'Graphics', chromeBaseline: 'WebGPU + WGSL (Dawn)', idlPatterns: [/^GPU.*\.idl$/i], awesomeOsAccelerator: 'Plug in awesome-os/sectium holo-display-webgpu + Dawn v11 CAS' },
  { id: 'webgl', area: 'Graphics', chromeBaseline: 'WebGL 1 & WebGL 2', idlPatterns: [/^WebGL.*\.idl$/i], awesomeOsAccelerator: 'ANGLE / Dawn WebGL-on-WebGPU backend' },
  { id: 'service-worker', area: 'PWA / Offline', chromeBaseline: 'ServiceWorker + FetchEvent + Clients', idlPatterns: [/ServiceWorker.*\.idl$/i, /^Cache(Storage)?\.idl$/i], awesomeOsAccelerator: 'Direct OPFS v11 CAS ServiceWorker runtime (holo-web-service-worker)' },
  { id: 'opfs', area: 'Storage', chromeBaseline: 'Origin Private File System (FileSystemSyncAccessHandle)', idlPatterns: [/FileSystem.*Handle\.idl$/i, /StorageManager\.idl$/i], awesomeOsAccelerator: 'Map directly to B8G v11 CAS /var/lib/b8g/cas/v11/files/' },
  { id: 'indexeddb', area: 'Storage', chromeBaseline: 'IndexedDB v3 (async transactions)', idlPatterns: [/^IDB.*\.idl$/i], awesomeOsAccelerator: 'B8G CAS B-Tree / SQLite-free mmap store' },
  { id: 'webrtc', area: 'Real-Time', chromeBaseline: 'RTCPeerConnection + DataChannel + MediaStream', idlPatterns: [/^RTC.*\.idl$/i], awesomeOsAccelerator: 'mTLS + B8G_ARENA_V1 zero-copy peer transport' },
  { id: 'webcodecs', area: 'Media', chromeBaseline: 'WebCodecs (VideoDecoder / AudioDecoder / Hardware)', idlPatterns: [/^(Video|Audio)(Decoder|Encoder|Frame)\.idl$/i], awesomeOsAccelerator: 'FFmpeg/VAAPI/omarchy-m1-video hardware bridge' },
  { id: 'mse', area: 'Media', chromeBaseline: 'MediaSource Extensions (YouTube / Twitch)', idlPatterns: [/^MediaSource\.idl$/i, /^SourceBuffer.*\.idl$/i], awesomeOsAccelerator: 'Shared LibMedia + hardware H.264/AV1/VP9 pipeline' },
  { id: 'webaudio', area: 'Audio', chromeBaseline: 'WebAudio API (AudioWorklet + Nodes)', idlPatterns: [/^Audio(Context|Node|Worklet|Buffer).*\.idl$/i], awesomeOsAccelerator: 'Low-latency B8G ring audio worklet' },
  { id: 'webtransport', area: 'Networking', chromeBaseline: 'WebTransport (HTTP/3 QUIC)', idlPatterns: [/^WebTransport.*\.idl$/i], awesomeOsAccelerator: 'QUIC/HTTP3 via LibHTTP + B8G transport' },
  { id: 'websockets', area: 'Networking', chromeBaseline: 'WebSocket + WebSocketStream', idlPatterns: [/^WebSocket.*\.idl$/i], awesomeOsAccelerator: 'Native LibWebSocket (already present)' },
  { id: 'webcomponents', area: 'DOM / UI', chromeBaseline: 'CustomElements + ShadowDOM + Declarative Shadow DOM', idlPatterns: [/^(CustomElementRegistry|ShadowRoot|HTMLSlotElement)\.idl$/i], awesomeOsAccelerator: 'First-class <b8g-*> HTML5 Web Components' },
  { id: 'streams', area: 'Streams', chromeBaseline: 'WHATWG Readable/Writable/TransformStream', idlPatterns: [/^(Readable|Writable|Transform)Stream.*\.idl$/i], awesomeOsAccelerator: '7-Tuple Web Streams zero-copy pipe' },
  { id: 'workers', area: 'Concurrency', chromeBaseline: 'Dedicated/SharedWorker + BroadcastChannel', idlPatterns: [/^(Worker|SharedWorker|BroadcastChannel)\.idl$/i], awesomeOsAccelerator: 'SharedArrayBuffer B8G_ARENA_V1 workers' },
  { id: 'webauthn', area: 'Security', chromeBaseline: 'WebAuthn / Passkeys + WebCrypto', idlPatterns: [/^(PublicKeyCredential|SubtleCrypto|Crypto)\.idl$/i], awesomeOsAccelerator: 'Ed25519 / FIDO2 hardware key bridge' },
  { id: 'webhid-usb', area: 'Hardware', chromeBaseline: 'WebHID / WebUSB / WebSerial / Gamepad', idlPatterns: [/^(HID|USB|Serial|Gamepad).*\.idl$/i], awesomeOsAccelerator: 'holo-device-host + modalias v11 CAS device bridge' },
  { id: 'clipboard', area: 'Desktop', chromeBaseline: 'Async Clipboard API + Drag & Drop', idlPatterns: [/^Clipboard.*\.idl$/i, /^DataTransfer.*\.idl$/i], awesomeOsAccelerator: 'Wayland wl_data_device / Win32 pipe bridge' },
  { id: 'permissions', area: 'Platform', chromeBaseline: 'Permissions + Notifications + Push API', idlPatterns: [/^(Permissions|Notification|PushManager)\.idl$/i], awesomeOsAccelerator: 'host-manager declarative ChromeOS policy engine' },
];

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'Build' || ent.name === 'node_modules') continue;
    const p = join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
}

function main(): void {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const libsDir = join(repoRoot, 'Libraries');
  const t0 = performance.now();

  const libStats: Record<string, LibStats> = {};
  const allIdlFiles: string[] = [];
  let totalFixmes = 0;
  let totalTodos = 0;
  let hasJsJit = false;
  let hasWasmSimd = false;
  let hasExtensionsDir = false;
  let hasDevToolsProtocol = false;

  if (existsSync(libsDir)) {
    for (const ent of readdirSync(libsDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const libName = ent.name;
      const files: string[] = [];
      walk(join(libsDir, libName), files);
      const stats: LibStats = { files: files.length, cppFiles: 0, idlFiles: 0, fixmes: 0, todos: 0, dbglnStubs: 0 };

      for (const f of files) {
        const ext = extname(f).toLowerCase();
        if (ext === '.idl') {
          stats.idlFiles++;
          allIdlFiles.push(f);
        } else if (ext === '.cpp' || ext === '.h') {
          stats.cppFiles++;
          if (libName === 'LibJS' && /JIT/i.test(f)) hasJsJit = true;
          if (libName === 'LibWasm' && /SIMD|Vector/i.test(f)) hasWasmSimd = true;
          if (libName === 'LibDevTools') hasDevToolsProtocol = true;
          const text = readFileSync(f, 'utf8');
          const fm = text.match(/\bFIXME\b/g);
          const td = text.match(/\bTODO\b/g);
          const st = text.match(/dbgln\([^)]*FIXME/g);
          if (fm) { stats.fixmes += fm.length; totalFixmes += fm.length; }
          if (td) { stats.todos += td.length; totalTodos += td.length; }
          if (st) stats.dbglnStubs += st.length;
        }
      }
      libStats[libName] = stats;
    }
  }

  hasExtensionsDir = existsSync(join(repoRoot, 'Libraries', 'LibWebExtensions')) || existsSync(join(repoRoot, 'Extensions'));
  const idlBasenames = allIdlFiles.map((f) => f.split(/[\\/]/).pop() ?? '');

  const featureResults = FEATURE_PROBES.map((probe) => {
    const matched = idlBasenames.filter((name) => probe.idlPatterns.some((rx) => rx.test(name)));
    let status: 'implemented-or-partial' | 'early-stub' | 'missing' = 'missing';
    if (matched.length >= 3) status = 'implemented-or-partial';
    else if (matched.length >= 1) status = 'early-stub';
    return {
      id: probe.id,
      area: probe.area,
      chromeBaseline: probe.chromeBaseline,
      idlCount: matched.length,
      sampleIdls: matched.slice(0, 6),
      status,
      awesomeOsAccelerator: probe.awesomeOsAccelerator,
    };
  });

  const elapsedMs = Number((performance.now() - t0).toFixed(1));
  const sortedLibs = Object.entries(libStats)
    .sort((a, b) => b[1].files - a[1].files)
    .slice(0, 15);

  const report = {
    schema: 'awesome-os.ladybird-chrome-parity.v1',
    scannedLibraries: Object.keys(libStats).length,
    totalWebIdlInterfaces: allIdlFiles.length,
    totalFixmes,
    totalTodos,
    engineFlags: {
      libJsHasJitFiles: hasJsJit,
      libWasmHasSimdFiles: hasWasmSimd,
      hasLibDevTools: hasDevToolsProtocol,
      hasWebExtensionsEngine: hasExtensionsDir,
    },
    topLibraries: Object.fromEntries(sortedLibs),
    featureMatrix: featureResults,
    elapsedMs,
  };

  mkdirSync(join(repoRoot, 'docs'), { recursive: true });
  writeFileSync(join(repoRoot, 'docs', 'chrome-parity-scan.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const missingCount = featureResults.filter((f) => f.status === 'missing').length;
  const stubCount = featureResults.filter((f) => f.status === 'early-stub').length;
  const partialCount = featureResults.filter((f) => f.status === 'implemented-or-partial').length;

  const md = [
    '# Awesome-OS Ladybird Hard-Fork — Chrome Feature-Parity & Gap Analysis',
    '',
    `> Automated real-codebase audit of **\`awesome-os/ladybird\`** (BSD-2-Clause independent web engine, zero Blink/Gecko/WebKit) scanned in **${elapsedMs} ms**.`,
    '',
    '## 1. Real Codebase Telemetry',
    '',
    `- **Libraries Scanned:** \`${report.scannedLibraries}\` (\`LibWeb\`, \`LibJS\`, \`LibGfx\`, \`LibWasm\`, \`LibMedia\`, \`LibHTTP\`, \`LibTLS\`, \`LibDevTools\`, …)`,
    `- **WebIDL Interfaces (\`.idl\`):** \`${report.totalWebIdlInterfaces}\``,
    `- **Open \`FIXME\` Markers in \`Libraries/\`:** \`${report.totalFixmes.toLocaleString()}\` (\`TODO\`: \`${report.totalTodos.toLocaleString()}\`)`,
    `- **LibJS JIT Files Present:** \`${hasJsJit}\` (note: upstream Ladybird currently focuses on bytecode VM — Tier-2 JIT is a major Chrome speed gap)`,
    `- **LibWasm SIMD Files Present:** \`${hasWasmSimd}\``,
    `- **LibDevTools Present:** \`${hasDevToolsProtocol}\``,
    `- **WebExtensions Engine Present:** \`${hasExtensionsDir}\``,
    '',
    '### Top Libraries by Size & `FIXME` Density',
    '',
    '| Library | Total Files | C++/H | WebIDL | `FIXME` Count |',
    '| :--- | ---: | ---: | ---: | ---: |',
    ...sortedLibs.map(([k, v]) => `| \`${k}\` | ${v.files} | ${v.cppFiles} | ${v.idlFiles} | ${v.fixmes} |`),
    '',
    `## 2. Chrome Feature-Parity Matrix (${partialCount} Active/Partial · ${stubCount} Early Stub · ${missingCount} Missing)`,
    '',
    '| Feature Area | Chrome Baseline | Status | `.idl` Count | Awesome-OS Accelerator |',
    '| :--- | :--- | :--- | ---: | :--- |',
    ...featureResults.map((f) => `| **${f.area}** (\`${f.id}\`) | ${f.chromeBaseline} | \`${f.status}\` | ${f.idlCount} | ${f.awesomeOsAccelerator} |`),
    '',
    '## 3. What Is Actually Missing to Match Chrome (Ranked by Impact)',
    '',
    '1. **JS Engine Peak Performance (Tier-2 Optimizing JIT):** `LibJS` has high ECMAScript spec conformance via its bytecode VM, but lacks a V8 TurboFan/Maglev-class optimizing JIT. *(Awesome-OS bridge: `holo-compiler` native codegen + `sectium-es`)*',
    '2. **PWA / Service Workers & OPFS (`ServiceWorker`, `CacheStorage`, `FileSystemSyncAccessHandle`):** Essential for offline web apps and our `holo-web-service-worker.js`. *(Awesome-OS bridge: mount `v11` CAS directly as OPFS)*',
    '3. **GPU Compute & 3D (`WebGPU` + `WebGL 1/2`):** Critical for Three.js, Figma, games, and our White Dragon VTuber Studio. *(Awesome-OS bridge: `holo-display-webgpu` + Dawn)*',
    '4. **Real-Time & Hardware Media (`WebRTC`, `WebCodecs`, `MSE`):** Required for Google Meet, Discord, Twitch, YouTube 4K60, and OBS browser sources.',
    '5. **Multi-Process Site Isolation & OS Sandboxing:** Chrome isolates every origin into a strict OS sandbox (`AppContainer` on Windows, `seccomp-bpf` + namespaces on Linux). *(Awesome-OS bridge: `Sectium` AppContainer + `B8G_ARENA_V1` pipe IPC)*',
    '6. **WebExtensions (MV3) & Full Chrome DevTools Protocol (CDP):** Required for developer workflows and password managers. *(Awesome-OS bridge: `SectiumDevToolsPlane` over `channel: command`)*',
    '',
  ].join('\n');

  writeFileSync(join(repoRoot, 'docs', 'CHROME-PARITY-GAP-ANALYSIS.md'), md, 'utf8');

  console.log(`\n=== LADYBIRD CHROME PARITY SCAN (${elapsedMs} ms) ===`);
  console.log(`Libraries: ${report.scannedLibraries} | WebIDL: ${report.totalWebIdlInterfaces} | FIXMEs: ${report.totalFixmes}`);
  console.log(`Matrix: ${partialCount} implemented/partial, ${stubCount} early-stub, ${missingCount} missing`);
  for (const f of featureResults) {
    console.log(`  [${f.status.padEnd(22)}] ${f.id.padEnd(16)} (idls=${String(f.idlCount).padStart(3)}) -> ${f.chromeBaseline}`);
  }
}

main();
