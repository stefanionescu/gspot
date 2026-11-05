// Prints the material for the CHANGELOG.md section of one CLI version. `mise run changelog <version>` runs it on Bun.
import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { CliReference } from '#cli/types/main.ts';
import type { SettingReference } from '#cli/types/settings.ts';

type Settings = Map<string, string | undefined>;

type SettingRow = { key: string; change: string };

type Commit = { hash: string; subject: string; body: string };

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/u;
const CHANGE_SUBJECT = /^(?:feat|fix|perf)(?:\((?<scope>[^)]*)\))?!?: /u;
const BREAKING_SUBJECT = /^\w+(?:\([^)]*\))?!: /u;
const BREAKING_PARAGRAPH = /^BREAKING CHANGE:.*(?:\n(?!\n).*)*/mu;
const FIELD_SEPARATOR = '\0';
const RECORD_SEPARATOR = '\u{1E}';
const COMMIT_FORMAT = `%h%x00%s%x00%b%x1E`;
const COMPARE_URL = 'https://github.com/stefanionescu/gspot/compare';
const NO_SCOPE = 'no scope';
const CLI_FOLDER = 'packages/cli';
const REFERENCE_MODULE = `${CLI_FOLDER}/src/reference.ts`;
const SETTINGS_REFERENCE_MODULE = `${CLI_FOLDER}/src/settings/reference.ts`;
const SCOPE_PREFIX = 'scope.';

const run = promisify(execFile);
const root = join(import.meta.dir, '../..');

async function runGit(gitArguments: string[]): Promise<string | undefined> {
    try {
        const { stdout } = await run('git', gitArguments, { cwd: root, maxBuffer: Infinity });
        return stdout.trim();
    } catch (error) {
        if (error instanceof Error && 'code' in error && typeof error.code === 'number') return undefined;
        throw error;
    }
}

async function readSettings(folder: string): Promise<Settings> {
    const module = (await import(join(folder, REFERENCE_MODULE))) as { CLI_REFERENCE: Pick<CliReference, 'settings'> };
    const leaves: Settings = new Map();
    const visit = (node: SettingReference): void => {
        if (node.children.length === 0) leaves.set(node.key, node.description);
        for (const child of node.children) visit(child);
    };
    for (const node of module.CLI_REFERENCE.settings) visit(node);
    for (const key of leaves.keys())
        if (key.startsWith(SCOPE_PREFIX) && leaves.has(key.slice(SCOPE_PREFIX.length))) leaves.delete(key);
    return leaves;
}

async function readRevisionSettings(revision: string): Promise<Settings> {
    const folder = mkdtempSync(join(tmpdir(), 'gspot-changelog-'));
    try {
        const archive = join(folder, 'source.tar');
        const archived = await runGit(['archive', '--output', archive, revision, CLI_FOLDER, 'tsconfig.json']);
        if (archived === undefined) throw new Error(`Git could not archive ${revision}.`);
        await run('tar', ['-xf', archive, '-C', folder]);
        symlinkSync(join(root, CLI_FOLDER, 'node_modules'), join(folder, CLI_FOLDER, 'node_modules'), 'junction');
        return await readSettings(folder);
    } finally {
        rmSync(folder, { recursive: true, force: true });
    }
}

function compareSettings(before: Settings, after: Settings): SettingRow[] {
    const added = after
        .keys()
        .filter((key) => !before.has(key))
        .toArray();
    const rows: SettingRow[] = [];
    for (const [key, description] of before) {
        if (after.has(key)) continue;
        const renamed = added.filter((name) => description !== undefined && after.get(name) === description);
        rows.push({ key, change: renamed.length === 1 ? `Renamed to \`${renamed.join('')}\`` : 'Removed' });
    }
    return rows;
}

async function buildSettingsTable(previous: string, end: string): Promise<string[]> {
    if ((await runGit(['cat-file', '-e', `${previous}:${SETTINGS_REFERENCE_MODULE}`])) === undefined) return [];
    const after = end === 'HEAD' ? await readSettings(root) : await readRevisionSettings(end);
    const rows = compareSettings(await readRevisionSettings(previous), after);
    const table =
        rows.length === 0
            ? ['No setting was renamed or removed.']
            : ['| Setting | Change |', '| --- | --- |', ...rows.map(({ key, change }) => `| \`${key}\` | ${change} |`)];
    return ['### Renamed and removed settings', '', ...table, ''];
}

function parseCommits(log: string): Commit[] {
    return log
        .split(RECORD_SEPARATOR)
        .map((record) => record.trim())
        .filter((record) => record !== '')
        .map((record) => {
            const [hash = '', subject = '', body = ''] = record.split(FIELD_SEPARATOR);
            return { hash, subject, body };
        });
}

function formatBreaking(commits: Commit[]): string[] {
    const breaking = commits.filter(
        ({ subject, body }) => BREAKING_SUBJECT.test(subject) || BREAKING_PARAGRAPH.test(body),
    );
    return breaking.flatMap(({ hash, subject, body }) => {
        const paragraph = BREAKING_PARAGRAPH.exec(body)?.[0];
        return [`- ${hash} ${subject}`, ...(paragraph === undefined ? [] : [`  ${paragraph.replaceAll('\n', ' ')}`])];
    });
}

function formatChanges(commits: Commit[]): string[] {
    const changes = commits.filter(({ subject }) => CHANGE_SUBJECT.test(subject));
    const scopes = Map.groupBy(changes, ({ subject }) => CHANGE_SUBJECT.exec(subject)?.groups?.['scope'] ?? NO_SCOPE);
    return [...scopes].flatMap(([scope, listed]) => [
        `### ${scope}`,
        '',
        ...listed.map(({ hash, subject }) => `- ${hash} ${subject}`),
        '',
    ]);
}

async function buildMaterial(version: string): Promise<string> {
    if (!VERSION_PATTERN.test(version)) throw new Error(`Give the version as MAJOR.MINOR.PATCH, not "${version}".`);
    const tag = `v${version}`;
    const end = (await runGit(['rev-parse', '-q', '--verify', `refs/tags/${tag}`])) === undefined ? 'HEAD' : tag;
    const previous = await runGit(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', '--exclude', tag, end]);
    const range = previous === undefined ? end : `${previous}..${end}`;
    const log = await runGit(['log', '--no-merges', `--format=${COMMIT_FORMAT}`, range]);
    if (log === undefined) throw new Error(`Git could not list the commits up to ${end}.`);
    const commits = parseCommits(log);
    const settings = previous === undefined ? [] : await buildSettingsTable(previous, end);
    return [
        `Material for the ${version} section of CHANGELOG.md. A commit subject is raw material, not an entry.`,
        '',
        ...(previous === undefined ? [] : [`${COMPARE_URL}/${previous}...${tag}`, '']),
        '## Breaking commits',
        '',
        ...formatBreaking(commits),
        '',
        '## Features, fixes, and performance, by scope',
        '',
        ...formatChanges(commits),
        ...settings,
    ].join('\n');
}

process.stdout.write(`${await buildMaterial(process.argv[2] ?? '')}\n`);
