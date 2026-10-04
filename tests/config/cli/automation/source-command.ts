/** A substitute Node executable records registry startup and waits without announcing readiness. */
export const STALLED_REGISTRY = `#!/usr/bin/env bun
import { dirname } from 'node:path';
import { renameSync, writeFileSync } from 'node:fs';
const marker = process.env['GSPOT_REGISTRY_MARKER'];
const prepared = marker + '.prepared';
writeFileSync(prepared, JSON.stringify({ pid: process.pid, work: dirname(process.argv[3]) }));
renameSync(prepared, marker);
setTimeout(() => {}, 60000);
`;
