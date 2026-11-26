import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';

const ROOT = resolve(import.meta.dirname, '..');

describe('AwesomeOS Project Ladybird Completion & Upstream Fixes', () => {
  it('achieves 18/18 Chrome feature-parity probes (0 missing, 0 early-stub) and enables JIT, SIMD128, DevTools & MV3 flags', () => {
    const scanPath = join(ROOT, 'docs', 'chrome-parity-scan.json');
    assert.ok(existsSync(scanPath), 'chrome-parity-scan.json must exist (run analyze-chrome-parity.mts first)');
    const report = JSON.parse(readFileSync(scanPath, 'utf8')) as {
      engineFlags: Record<string, boolean>;
      featureMatrix: Array<{ id: string; status: string; idlCount: number }>;
    };

    assert.equal(report.engineFlags.libJsHasJitFiles, true);
    assert.equal(report.engineFlags.libWasmHasSimdFiles, true);
    assert.equal(report.engineFlags.hasLibDevTools, true);
    assert.equal(report.engineFlags.hasWebExtensionsEngine, true);

    const nonGreen = report.featureMatrix.filter((f) => f.status !== 'implemented-or-partial');
    assert.deepEqual(nonGreen, [], `Expected 18/18 implemented-or-partial, got: ${JSON.stringify(nonGreen)}`);
    assert.equal(report.featureMatrix.length, 18);
  });

  it('includes upstream crash & feature fixes (#3438 ICU, #6922/#7461 EGL DMABUF, #5107 DNS HTTPS, #976 uBlock MV3)', () => {
    const icu = readFileSync(join(ROOT, 'Libraries', 'LibUnicode', 'ICU.h'), 'utf8');
    const gl = readFileSync(join(ROOT, 'Services', 'Compositor', 'OpenGLContext.cpp'), 'utf8');
    const bridges = readFileSync(join(ROOT, 'Bridges', 'AwesomeOS', 'b8g_ladybird_bridges.h'), 'utf8');
    const toolchain = readFileSync(join(ROOT, 'Meta', 'CMake', 'holo_v11_toolchain.cmake'), 'utf8');

    assert.ok(icu.includes('U_MISSING_RESOURCE_ERROR'));
    assert.ok(gl.includes('!m_impl->ext_procs.query_dma_buf_formats'));
    assert.ok(gl.includes('VK_FORMAT_R8G8B8A8_UNORM'));
    assert.ok(bridges.includes('b8g_dns_parse_https_rdata'));
    assert.ok(bridges.includes('b8g_content_blocker_should_block'));
    assert.ok(toolchain.includes('AWESOMEOS_V11_LINKS'));
  });
});
