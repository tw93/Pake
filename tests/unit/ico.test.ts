import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { buildIcoFromPngBuffers, writeIcoWithPreferredSize } from '@/utils/ico';

const ICO_HEADER_SIZE = 6;
const ICO_DIR_ENTRY_SIZE = 16;

type ParsedEntry = {
  width: number;
  height: number;
  bytesInRes: number;
  imageOffset: number;
  data: Buffer;
};

function decodeDim(byte: number): number {
  return byte === 0 ? 256 : byte;
}

function parseIcoHeader(buffer: Buffer): ParsedEntry[] {
  expect(buffer.readUInt16LE(0)).toBe(0);
  expect(buffer.readUInt16LE(2)).toBe(1);
  const count = buffer.readUInt16LE(4);
  const entries: ParsedEntry[] = [];
  for (let i = 0; i < count; i++) {
    const offset = ICO_HEADER_SIZE + i * ICO_DIR_ENTRY_SIZE;
    const bytesInRes = buffer.readUInt32LE(offset + 8);
    const imageOffset = buffer.readUInt32LE(offset + 12);
    entries.push({
      width: decodeDim(buffer.readUInt8(offset)),
      height: decodeDim(buffer.readUInt8(offset + 1)),
      bytesInRes,
      imageOffset,
      data: buffer.subarray(imageOffset, imageOffset + bytesInRes),
    });
  }
  return entries;
}

function fakePng(tag: number, length: number): Buffer {
  const buf = Buffer.alloc(length);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.writeUInt8(tag, 4);
  return buf;
}

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pake-ico-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('buildIcoFromPngBuffers', () => {
  it('writes header, directory entries, and payload for a single frame', () => {
    const png = fakePng(1, 40);
    const ico = buildIcoFromPngBuffers([{ size: 16, png }]);

    const entries = parseIcoHeader(ico);
    expect(entries).toHaveLength(1);
    expect(entries[0].width).toBe(16);
    expect(entries[0].height).toBe(16);
    expect(entries[0].bytesInRes).toBe(png.length);
    expect(entries[0].imageOffset).toBe(ICO_HEADER_SIZE + ICO_DIR_ENTRY_SIZE);
    expect(entries[0].data.equals(png)).toBe(true);
  });

  it('encodes size>=256 as the sentinel byte 0', () => {
    const png = fakePng(2, 64);
    const ico = buildIcoFromPngBuffers([{ size: 256, png }]);

    expect(ico.readUInt8(ICO_HEADER_SIZE)).toBe(0);
    expect(ico.readUInt8(ICO_HEADER_SIZE + 1)).toBe(0);
    const entries = parseIcoHeader(ico);
    expect(entries[0].width).toBe(256);
    expect(entries[0].height).toBe(256);
  });

  it('lays frames out back to back with monotonic offsets', () => {
    const a = fakePng(1, 20);
    const b = fakePng(2, 35);
    const c = fakePng(3, 50);
    const ico = buildIcoFromPngBuffers([
      { size: 16, png: a },
      { size: 32, png: b },
      { size: 64, png: c },
    ]);

    const entries = parseIcoHeader(ico);
    expect(entries.map((e) => e.width)).toEqual([16, 32, 64]);
    expect(entries[0].imageOffset).toBe(
      ICO_HEADER_SIZE + 3 * ICO_DIR_ENTRY_SIZE,
    );
    expect(entries[1].imageOffset).toBe(
      entries[0].imageOffset + entries[0].bytesInRes,
    );
    expect(entries[2].imageOffset).toBe(
      entries[1].imageOffset + entries[1].bytesInRes,
    );
    expect(entries[0].data.equals(a)).toBe(true);
    expect(entries[1].data.equals(b)).toBe(true);
    expect(entries[2].data.equals(c)).toBe(true);
  });

  it('emits a header-only buffer for zero frames', () => {
    const ico = buildIcoFromPngBuffers([]);
    expect(ico.length).toBe(ICO_HEADER_SIZE);
    expect(ico.readUInt16LE(4)).toBe(0);
  });
});

describe('writeIcoWithPreferredSize', () => {
  it('moves the frame matching preferredSize to the front', async () => {
    const dir = makeTempDir();
    const source = path.join(dir, 'source.ico');
    const output = path.join(dir, 'reordered.ico');

    const ico = buildIcoFromPngBuffers([
      { size: 32, png: fakePng(1, 20) },
      { size: 16, png: fakePng(2, 24) },
      { size: 64, png: fakePng(3, 28) },
    ]);
    fs.writeFileSync(source, ico);

    const ok = await writeIcoWithPreferredSize(source, output, 16);

    expect(ok).toBe(true);
    const result = parseIcoHeader(fs.readFileSync(output));
    expect(result[0].width).toBe(16);
    expect(result[0].data.readUInt8(4)).toBe(2);
  });

  it('returns false when the source file is missing', async () => {
    const dir = makeTempDir();
    const ok = await writeIcoWithPreferredSize(
      path.join(dir, 'does-not-exist.ico'),
      path.join(dir, 'out.ico'),
      32,
    );
    expect(ok).toBe(false);
  });

  it('returns false on a malformed ICO header', async () => {
    const dir = makeTempDir();
    const source = path.join(dir, 'bad.ico');
    fs.writeFileSync(source, Buffer.from([0, 0]));

    const ok = await writeIcoWithPreferredSize(
      source,
      path.join(dir, 'out.ico'),
      32,
    );
    expect(ok).toBe(false);
  });
});
