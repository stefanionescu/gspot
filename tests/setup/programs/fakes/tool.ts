import { appendFileSync, existsSync, renameSync, rmSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { readEnvironmentVariable } from '#cli/system/environment.ts';
import {
    FAKE_TOOL_OPTIONS,
    POLL_INTERVAL_MILLISECONDS,
    WAIT_INTERVAL_MILLISECONDS,
} from '#tests/config/setup/programs.ts';
import { splitAssignment } from '#tests/setup/system/programs.ts';

const { values, positionals } = parseArgs({ options: FAKE_TOOL_OPTIONS, allowPositionals: true, strict: false });
const option = Object.fromEntries(
    Object.keys(FAKE_TOOL_OPTIONS).map((name) => [
        name,
        [values[name]].flat().filter((value) => typeof value === 'string'),
    ]),
) as Record<keyof typeof FAKE_TOOL_OPTIONS, string[]>;

function findStopCode(): string | undefined {
    const [versionLine] = option['version-line'];
    if (versionLine !== undefined && process.argv.includes('--version')) {
        process.stdout.write(`${versionLine}\n`);
        return '0';
    }
    const [requiredCwd] = option['require-cwd'];
    if (requiredCwd !== undefined && process.cwd() !== requiredCwd) return '9';
    const [refusedFile] = option['refuse-file'];
    if (refusedFile === undefined || !existsSync(refusedFile)) return undefined;
    process.stderr.write(`${refusedFile} must not exist here.\n`);
    return '1';
}

const steps: Partial<Record<keyof typeof FAKE_TOOL_OPTIONS, (value: string) => unknown>> = {
    write: (pair) => Bun.write(...splitAssignment(pair)),
    'write-hex': (pair) => {
        const [path, hex] = splitAssignment(pair);
        return Bun.write(path, Buffer.from(hex, 'hex'));
    },
    delete: (path) => {
        rmSync(path);
    },
    append: (pair) => {
        appendFileSync(...splitAssignment(pair));
    },
    record: async (path) => {
        const environment = option.environment.map((name) => [name, readEnvironmentVariable(name) ?? null] as const);
        const call = {
            arguments: positionals,
            environment: Object.fromEntries(environment),
            cwd: process.cwd(),
            ...(values.stdin === true && { stdin: await Bun.stdin.text() }),
        };
        if (path === '-') process.stdout.write(`${JSON.stringify(call)}\n`);
        else appendFileSync(path, `${JSON.stringify(call)}\n`);
    },
    text: (text) => Promise.all(positionals.map((path) => Bun.write(path, text))),
    mark: async (mark) => {
        await Bun.write(`${mark}.partial`, String(process.pid));
        renameSync(`${mark}.partial`, mark);
    },
    line: (line) => process.stdout.write(`${line}\n`),
    stdout: (text) => process.stdout.write(text),
    'stdout-hex': (hex) => process.stdout.write(Buffer.from(hex, 'hex')),
    stderr: (text) => process.stderr.write(text),
};

const stopCode = findStopCode();
if (stopCode === undefined) {
    for (const [name, step] of Object.entries(steps)) {
        const optionValues = option[name as keyof typeof FAKE_TOOL_OPTIONS];
        for (const value of optionValues) await step(value);
    }
    if (values['copy-stdin'] === true) process.stdout.write(await Bun.stdin.bytes());
    if (values['print-pid'] === true) process.stdout.write(String(process.pid));
    for (const signal of option.signal) process.kill(process.pid, signal);
    for (const awaited of option.until) while (!existsSync(awaited)) await Bun.sleep(POLL_INTERVAL_MILLISECONDS);
    if (values.wait === true)
        setInterval(() => process.stdout.write(option.repeat.join('')), WAIT_INTERVAL_MILLISECONDS);
}
process.exitCode = Number(stopCode ?? option.exit[0] ?? '0');
