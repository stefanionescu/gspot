import { parseArgs } from 'node:util';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { rmSync, mkdirSync, existsSync, renameSync, appendFileSync } from 'node:fs';

import {
    FAKE_TOOL_OPTIONS,
    POLL_INTERVAL_MILLISECONDS,
    WAIT_INTERVAL_MILLISECONDS,
} from '#tests/config/setup/programs.ts';

const { values, positionals } = parseArgs({ options: FAKE_TOOL_OPTIONS, allowPositionals: true, strict: false });
const option = Object.fromEntries(
    Object.keys(FAKE_TOOL_OPTIONS).map((name) => [
        name,
        [values[name]].flat().filter((value) => typeof value === 'string'),
    ]),
) as Record<keyof typeof FAKE_TOOL_OPTIONS, string[]>;

// eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
function splitPair(pair: string): [string, string] {
    return [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1)];
}

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
    return option['refuse-exit'][0] ?? '1';
}

const steps: Partial<Record<keyof typeof FAKE_TOOL_OPTIONS, (value: string) => unknown>> = {
    write: (pair) => Bun.write(...splitPair(pair)),
    'write-hex': (pair) => Bun.write(splitPair(pair)[0], Buffer.from(splitPair(pair)[1], 'hex')),
    delete: (path) => {
        rmSync(path);
    },
    append: (pair) => {
        appendFileSync(...splitPair(pair));
    },
    'copy-environment-file': async (pair) => {
        const [path, name] = splitPair(pair);
        await Bun.write(path, await Bun.file(readEnvironmentVariable(name) ?? '').text());
    },
    'replace-with-folder': (folder) => {
        rmSync(folder);
        mkdirSync(folder);
    },
    'log-arguments': (log) => {
        appendFileSync(log, `${JSON.stringify(positionals)}\n`);
    },
    text: (text) => Promise.all(positionals.map((path) => Bun.write(path, text))),
    'record-cwd': (record) => Bun.write(record, process.cwd()),
    mark: async (mark) => {
        await Bun.write(`${mark}.prepared`, String(process.pid));
        renameSync(`${mark}.prepared`, mark);
    },
    line: (line) => process.stdout.write(`${line}\n`),
    'print-environment': (name) => process.stdout.write(readEnvironmentVariable(name) ?? ''),
    stdout: (text) => process.stdout.write(text),
    'stdout-hex': (hex) => process.stdout.write(Buffer.from(hex, 'hex')),
    stderr: (text) => process.stderr.write(text),
};

const stopCode = findStopCode();
if (stopCode === undefined) {
    for (const [name, step] of Object.entries(steps))
        for (const value of option[name as keyof typeof FAKE_TOOL_OPTIONS]) await step(value);
    if (values['copy-stdin'] === true) process.stdout.write(await Bun.stdin.bytes());
    if (values['print-arguments'] === true) process.stdout.write(positionals.map((each) => `${each}\n`).join(''));
    if (values['print-cwd'] === true) process.stdout.write(process.cwd());
    if (values['print-pid'] === true) process.stdout.write(String(process.pid));
    for (const signal of option.signal) process.kill(process.pid, signal);
    for (const awaited of option.until) while (!existsSync(awaited)) await Bun.sleep(POLL_INTERVAL_MILLISECONDS);
    if (values.wait === true)
        setInterval(() => process.stdout.write(option.repeat.join('')), WAIT_INTERVAL_MILLISECONDS);
}
process.exitCode = Number(stopCode ?? option.exit[0] ?? '0');
