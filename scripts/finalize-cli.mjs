import {chmod, readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
// npm's bin entry is also usable directly from the release archive on Unix.
const entry = new URL('../dist/cli/flute.js', import.meta.url);
assert.ok((await readFile(entry,'utf8')).startsWith('#!/usr/bin/env node'));
await chmod(entry, 0o755);
