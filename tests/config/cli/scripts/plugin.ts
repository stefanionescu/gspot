/** A substitute npm executable records the archive folder and waits for cancellation. */
export const STALLED_PACKAGE_PACKING = `#!/usr/bin/env bun
import { renameSync, writeFileSync } from 'node:fs';
const marker = process.env['GSPOT_PACKAGE_MARKER'];
const prepared = marker + '.prepared';
writeFileSync(prepared, JSON.stringify({ pid: process.pid, work: process.argv[process.argv.indexOf('--pack-destination') + 1] }));
renameSync(prepared, marker);
setTimeout(() => {}, 60000);
`;
