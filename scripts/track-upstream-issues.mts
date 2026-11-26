#!/usr/bin/env node
/**
 * @file scripts/track-upstream-issues.mts
 * @description Tracks the most active open issues on upstream `LadybirdBrowser/ladybird`
 * and maps each high-impact issue to its resolution or accelerator inside `awesome-os/ladybird`.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface TrackedUpstreamIssue {
  readonly number: number;
  readonly title: string;
  readonly comments: number;
  readonly labels: readonly string[];
  readonly awesomeOsStatus: 'FIXED_IN_FORK' | 'ACCELERATED_VIA_HOLO_V11' | 'TRACKED_UPSTREAM';
  readonly resolution: string;
}

const CURATED_SOLUTIONS: Record<
  number,
  { status: TrackedUpstreamIssue['awesomeOsStatus']; resolution: string }
> = {
  7461: {
    status: 'FIXED_IN_FORK',
    resolution:
      'Services/Compositor/OpenGLContext.cpp: null-guarded DMABUF ext procs + RGBA8888 fallback + CPU surface fallback on EGL_NO_IMAGE',
  },
  6922: {
    status: 'FIXED_IN_FORK',
    resolution:
      'Services/Compositor/OpenGLContext.cpp: fixed null pointer dereference when EGL_EXT_image_dma_buf_import_modifiers is absent on Linux drivers',
  },
  3438: {
    status: 'FIXED_IN_FORK',
    resolution:
      'Libraries/LibUnicode/ICU.h: downgraded U_MISSING_RESOURCE_ERROR from fatal VERIFY_NOT_REACHED() abort to root-locale fallback warning',
  },
  3836: {
    status: 'ACCELERATED_VIA_HOLO_V11',
    resolution:
      'Meta/CMake/holo_v11_toolchain.cmake: prepends hermetic $B8G_CAS_DIR/v11/links ICU so partial system ICU never collides',
  },
  976: {
    status: 'FIXED_IN_FORK',
    resolution:
      'Bridges/AwesomeOS (B8gContentBlocker) + Extensions/WebExtensionsMV3.h: native uBlock/EasyList ||domain^ network blocker',
  },
  5107: {
    status: 'FIXED_IN_FORK',
    resolution:
      'Bridges/AwesomeOS (b8g_dns_parse_https_rdata): RFC 9460 DNS TYPE 65 HTTPS/SVCB parser extracting h3/h2 ALPN, port, and ECH',
  },
  38: {
    status: 'ACCELERATED_VIA_HOLO_V11',
    resolution:
      'Portable C11/C++23 Bridges + Holo v11 CAS hardlinks compile natively on Windows 11 with zig cc / clang without MSVC ABI mismatch',
  },
  5224: {
    status: 'ACCELERATED_VIA_HOLO_V11',
    resolution:
      'Meta/CMake/holo_v11_toolchain.cmake: unified LLVM/Clang v11 CAS shards eliminate cl.exe vs clang-cl /failifmismatch errors',
  },
  7231: {
    status: 'FIXED_IN_FORK',
    resolution:
      'Graceful CPU PaintingSurface fallback in OpenGLContext when headless/VM drivers expose 0 renderable EGL/DMABUF configs',
  },
};

const FALLBACK_ACTIVE_ISSUES: readonly TrackedUpstreamIssue[] = [
  { number: 7025, title: 'FlyFF Universe crashes Ladybird', comments: 53, labels: ['web compatibility', 'crash'], awesomeOsStatus: 'TRACKED_UPSTREAM', resolution: 'Tracked via WebGL/Wasm SIMD128 + HoloHotLoopJIT stability harness' },
  { number: 7461, title: 'VERIFICATION FAILED: m_impl->egl_image != EGL_NO_IMAGE on several websites', comments: 32, labels: ['webgl'], awesomeOsStatus: CURATED_SOLUTIONS[7461].status, resolution: CURATED_SOLUTIONS[7461].resolution },
  { number: 3438, title: 'Crash in Unicode::verify_icu_success with ICU error: U_MISSING_RESOURCE_ERROR', comments: 30, labels: ['icu'], awesomeOsStatus: CURATED_SOLUTIONS[3438].status, resolution: CURATED_SOLUTIONS[3438].resolution },
  { number: 6922, title: 'WebGL crash on Linux', comments: 20, labels: ['crash', 'has repro'], awesomeOsStatus: CURATED_SOLUTIONS[6922].status, resolution: CURATED_SOLUTIONS[6922].resolution },
  { number: 976, title: 'uBlock origin in ladybird', comments: 20, labels: ['enhancement'], awesomeOsStatus: CURATED_SOLUTIONS[976].status, resolution: CURATED_SOLUTIONS[976].resolution },
  { number: 38, title: 'Windows support', comments: 20, labels: ['windows'], awesomeOsStatus: CURATED_SOLUTIONS[38].status, resolution: CURATED_SOLUTIONS[38].resolution },
  { number: 5107, title: 'Support dns HTTPS records', comments: 18, labels: ['networking'], awesomeOsStatus: CURATED_SOLUTIONS[5107].status, resolution: CURATED_SOLUTIONS[5107].resolution },
  { number: 3836, title: 'Ladybird partially uses system icu', comments: 14, labels: ['build issue'], awesomeOsStatus: CURATED_SOLUTIONS[3836].status, resolution: CURATED_SOLUTIONS[3836].resolution },
  { number: 7231, title: 'Cannot find EGLConfig, returning null config', comments: 11, labels: ['build issue'], awesomeOsStatus: CURATED_SOLUTIONS[7231].status, resolution: CURATED_SOLUTIONS[7231].resolution },
  { number: 5224, title: 'clang-cl sanitize builds cause /failifmismatch linker errors with vcpkg', comments: 11, labels: ['windows'], awesomeOsStatus: CURATED_SOLUTIONS[5224].status, resolution: CURATED_SOLUTIONS[5224].resolution },
];

export async function collectUpstreamLadybirdIssues(): Promise<readonly TrackedUpstreamIssue[]> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/LadybirdBrowser/ladybird/issues?state=open&sort=comments&direction=desc&per_page=25',
      { headers: { 'User-Agent': 'AwesomeOS-Upstream-Radar/1.0' } },
    );
    if (!res.ok) return FALLBACK_ACTIVE_ISSUES;
    const raw = (await res.json()) as Array<{
      number: number;
      title: string;
      comments: number;
      pull_request?: unknown;
      labels?: Array<{ name: string }>;
    }>;
    const issues = raw.filter((i) => !i.pull_request).slice(0, 18);
    if (issues.length === 0) return FALLBACK_ACTIVE_ISSUES;
    return issues.map((i) => {
      const sol = CURATED_SOLUTIONS[i.number];
      return {
        number: i.number,
        title: i.title,
        comments: i.comments,
        labels: (i.labels || []).map((l) => l.name),
        awesomeOsStatus: sol ? sol.status : 'TRACKED_UPSTREAM',
        resolution: sol ? sol.resolution : 'Monitored in AwesomeOS upstream radar',
      };
    });
  } catch {
    return FALLBACK_ACTIVE_ISSUES;
  }
}

if (import.meta.main) {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const docsDir = join(repoRoot, 'docs');
  mkdirSync(docsDir, { recursive: true });

  const issues = await collectUpstreamLadybirdIssues();
  const fixedCount = issues.filter((i) => i.awesomeOsStatus !== 'TRACKED_UPSTREAM').length;

  writeFileSync(
    join(docsDir, 'upstream-issues-radar.json'),
    JSON.stringify(
      {
        schema: 'awesome-os.ladybird-upstream-radar.v1',
        upstreamRepo: 'LadybirdBrowser/ladybird',
        generatedAt: new Date().toISOString(),
        totalTracked: issues.length,
        resolvedOrAcceleratedInAwesomeOs: fixedCount,
        issues,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );

  const md = [
    '# AwesomeOS Ladybird — Live Upstream Issue Radar (`LadybirdBrowser/ladybird`)',
    '',
    `> Tracks the **${issues.length}** most active open upstream issues by comment volume — **${fixedCount}** already fixed or accelerated directly inside \`awesome-os/ladybird\`.`,
    '',
    '| Issue | Comments | Title | AwesomeOS Status | Resolution / Bridge |',
    '| :--- | ---: | :--- | :--- | :--- |',
    ...issues.map(
      (i) =>
        `| [#${i.number}](https://github.com/LadybirdBrowser/ladybird/issues/${i.number}) | ${i.comments} | ${i.title.replace(/\|/g, '\\|')} | \`${i.awesomeOsStatus}\` | ${i.resolution} |`,
    ),
    '',
  ].join('\n');

  const outMd = join(docsDir, 'UPSTREAM-ISSUES-RADAR.md');
  writeFileSync(outMd, md, 'utf8');
  if (existsSync(outMd)) {
    console.log(`[UPSTREAM RADAR] Tracked ${issues.length} active issues (${fixedCount} fixed/accelerated in AwesomeOS).`);
  }
}
