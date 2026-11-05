// Writes the CHANGELOG.md section of one CLI version. `mise run changelog <version>` runs it on Bun.
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import type { CliReference } from '#cli/types/main.ts';
import type { SettingReference } from '#cli/types/settings.ts';

type Settings = Map<string, string | undefined>;

type SettingRow = { key: string; change: string };

type ChangelogSection = { version: string; text: string };

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/u;
const CHANGE_SUBJECT = /^(?:feat|fix|perf)(?:\([^)]*\))?(?<breaking>!)?: /u;
const SECTION_HEADING = /^## (?<version>\S+)$/u;
const CHANGELOG_FILE = 'CHANGELOG.md';
const CLI_FOLDER = 'packages/cli';
const REFERENCE_MODULE = `${CLI_FOLDER}/src/reference.ts`;
const SETTINGS_REFERENCE_MODULE = `${CLI_FOLDER}/src/settings/reference.ts`;
const SCOPE_PREFIX = 'scope.';
const NO_CHANGES = 'This release holds no feature, fix, or performance commit.';
const CHANGELOG_HEADER = `<!-- mise run changelog <version> writes each section of this file. Do not edit it by hand. -->

# Changelog

Each section lists the features, fixes, and performance changes of one gspot CLI release, breaking changes first. Its
table names the settings that the release renamed or removed, from the settings reference of the previous release.
`;

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

function formatChanges(subjects: string[]): string[] {
    if (subjects.length === 0) return [NO_CHANGES, ''];
    const breaking = subjects.filter((subject) => CHANGE_SUBJECT.exec(subject)?.groups?.['breaking'] !== undefined);
    const others = subjects.filter((subject) => !breaking.includes(subject));
    const lists = [
        ['Breaking changes', breaking],
        ['Changes', others],
    ] as const;
    return lists.flatMap(([heading, listed]) =>
        listed.length === 0 ? [] : [`### ${heading}`, '', ...listed.map((subject) => `- ${subject}`), ''],
    );
}

async function buildSection(version: string): Promise<ChangelogSection> {
    if (!VERSION_PATTERN.test(version)) throw new Error(`Give the version as MAJOR.MINOR.PATCH, not "${version}".`);
    const tag = `v${version}`;
    const end = (await runGit(['rev-parse', '-q', '--verify', `refs/tags/${tag}`])) === undefined ? 'HEAD' : tag;
    const previous = await runGit(['describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*', '--exclude', tag, end]);
    const log = await runGit([
        'log',
        '--no-merges',
        '--format=%s',
        previous === undefined ? end : `${previous}..${end}`,
    ]);
    if (log === undefined) throw new Error(`Git could not list the commits up to ${end}.`);
    const subjects = log.split('\n').filter((subject) => CHANGE_SUBJECT.test(subject));
    const settings = previous === undefined ? [] : await buildSettingsTable(previous, end);
    return { version, text: [`## ${version}`, '', ...formatChanges(subjects), ...settings].join('\n') };
}

function readSections(): ChangelogSection[] {
    const path = join(root, CHANGELOG_FILE);
    if (!existsSync(path)) return [];
    const sections: ChangelogSection[] = [];
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        const version = SECTION_HEADING.exec(line)?.groups?.['version'];
        const last = sections.at(-1);
        if (version !== undefined) sections.push({ version, text: line });
        else if (last !== undefined) last.text += `\n${line}`;
    }
    return sections;
}

const version = process.argv[2] ?? '';
const section = await buildSection(version);
const sections = [...readSections().filter((each) => each.version !== version), section].toSorted((left, right) =>
    Bun.semver.order(right.version, left.version),
);
const body = sections.map(({ text }) => text.trimEnd()).join('\n\n');
writeFileSync(join(root, CHANGELOG_FILE), `${CHANGELOG_HEADER}\n${body}\n`);
process.stdout.write(`wrote the ${version} section of ${CHANGELOG_FILE}\n`);
