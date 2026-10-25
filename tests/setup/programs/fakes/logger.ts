import { appendFileSync } from 'node:fs';
import { readEnvironmentVariable } from '#cli/system/environment.ts';

const [name = '', ...argv] = process.argv.slice(2);
const input = await Bun.stdin.text();
appendFileSync(readEnvironmentVariable('CALLS_LOG') ?? '', `${JSON.stringify({ name, argv, input })}\n`);
