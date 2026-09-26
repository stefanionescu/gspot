// Every flag a manifest command passes exists in the pinned tool: the tool's own help text says so (K-251).
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { probeTool } from '#cli/tools/probe.ts';
import { readPolicy } from '#cli/policy/read.ts';
import { runProcess } from '#tests/support/cli/command.ts';
import type { ToolPin } from '#cli/configurations/manifests.ts';
import { NODE_MODULES_DIRECTORY } from '#cli/platform/paths.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

const HELP_TIMEOUT_MS = 30_000;
const root = fileURLToPath(new URL('../../..', import.meta.url));
const manifests = [...configurationManifests().values()];
const context = { root, probes: new Map(), policyFiles: readPolicy(root) };

type Command = { tool: ToolPin; argv: string[]; subcommands: string[]; flags: string[] };

function isWord(part: string): boolean {
    return !part.startsWith('-') && !part.startsWith('{') && part !== '.' && !part.includes('/');
}

// The flags of a command: every dashed token before any `=`, and the flag a {each:--flag:setting} placeholder repeats.
function flagsOf(argv: string[]): string[] {
    return [
        ...new Set(
            argv.slice(1).flatMap((part) => {
                const each = /^\{each:(?<flag>-[^:]+):/u.exec(part)?.groups?.['flag'];
                if (each !== undefined) return [each];
                const workspace = /^\{workspace:(?<flag>-[^}]+)\}$/u.exec(part)?.groups?.['flag'];
                if (workspace !== undefined) return [workspace];
                return part.startsWith('-') ? [part.split('=', 1)[0]!] : [];
            }),
        ),
    ];
}

function subcommandsOf(argv: string[]): string[] {
    const words: string[] = [];
    for (const part of argv.slice(1)) {
        if (!isWord(part)) break;
        words.push(part);
    }
    return words;
}

function executableOf(tool: ToolPin): string | undefined {
    const privateBinary = join(root, NODE_MODULES_DIRECTORY, '.bin', tool.name);
    if (existsSync(privateBinary)) return privateBinary;
    const developmentBinary = join(root, 'node_modules', '.bin', tool.name);
    if (existsSync(developmentBinary)) return developmentBinary;
    const probe = probeTool(context, tool);
    return probe.path !== undefined && ['ok', 'outdated', 'newer'].includes(probe.state) ? probe.path : undefined;
}

// A manual page bolds a word by overstriking it; the plain word is what the flag has to match.
function plain(text: string): string {
    // eslint-disable-next-line no-control-regex, sonarjs/no-control-regex -- a man page overstrike is a character, a backspace, and the character again
    return text.replaceAll(/.\u0008/gu, '');
}

// The help of a tool, and of each option group a dotted flag such as --coverage.reporter belongs to.
async function helpText(executable: string, subcommands: string[], flags: string[]): Promise<string> {
    const groups = [...new Set(flags.filter((flag) => flag.includes('.')).map((flag) => flag.split('.', 1)[0]!))];
    const pages = await Promise.all(
        [[], ...groups.map((group) => [group])].map((extra) =>
            runProcess([executable, ...subcommands, '--help', ...extra], { cwd: root, timeoutMs: HELP_TIMEOUT_MS }),
        ),
    );
    return plain(pages.map((page) => `${page.stdout}\n${page.stderr}`).join('\n'));
}

const commands: Command[] = manifests.flatMap((manifest) =>
    manifest.checks.flatMap((check) =>
        [check.command, check.fix_command]
            .filter((argv): argv is string[] => argv !== undefined)
            .flatMap((argv) => {
                const tool = manifest.tools.find((entry) => entry.name === (check.tool ?? argv[0]));
                if (tool === undefined || tool.provider === 'host') return [];
                const flags = flagsOf(argv);
                return flags.length === 0 ? [] : [{ tool, argv, subcommands: subcommandsOf(argv), flags }];
            }),
    ),
);

const seen = new Set<string>();
const distinct = commands.filter((command) => {
    const key = `${command.tool.name} ${command.subcommands.join(' ')} ${command.flags.join(' ')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
});

test('every pinned tool a manifest command names is defined in that manifest', () => {
    const undefinedTools = manifests.flatMap((manifest) =>
        manifest.checks
            .filter((check) => check.command !== undefined)
            .map((check) => check.tool ?? check.command[0]!)
            .filter((name) => !manifests.some((other) => other.tools.some((tool) => tool.name === name))),
    );
    expect([...new Set(undefinedTools)]).toStrictEqual([]);
});

for (const command of distinct) {
    const executable = executableOf(command.tool);
    const title = `${command.tool.name} ${command.subcommands.join(' ')}`.trim();
    if (executable !== undefined)
        test(
            `the help of ${title} names ${command.flags.join(' ')}`,
            async () => {
                const text = await helpText(executable, command.subcommands, command.flags);
                const missing = command.flags.filter((flag) => !text.includes(flag));
                expect(missing, `${title}: ${text.slice(0, 400)}`).toStrictEqual([]);
            },
            HELP_TIMEOUT_MS,
        );
}
