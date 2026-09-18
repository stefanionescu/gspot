// Writes the reference pages from the binary's own data: commands from commander, presets and checks from the manifests, settings from the manifests, the decision log from the architecture. With --check it compares and writes nothing.
import { join } from 'node:path';
import type { Command } from 'commander';
import { format, type Options } from 'prettier';
import { buildProgram } from '@gspot/cli/src/program.ts';
import { allChecks } from '@gspot/cli/src/presets/listing.ts';
import { presetManifests } from '@gspot/cli/src/presets/read-manifests.ts';
import type { CheckSpec, Manifest, SettingSpec } from '@gspot/cli/types/manifest.ts';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url).pathname;
const REFERENCE = join(ROOT, 'src', 'content', 'docs', 'reference');
const DECISIONS = join(ROOT, '..', 'architecture', '14-decisions.md');
const PRETTIER = join(ROOT, '..', '.gspot', 'prettier.json');
const ARCHITECTURE_URL = 'https://github.com/stefanionescu/gspot/blob/main/architecture/';
const ARCHITECTURE_FILE = /\]\(([\w./-]+\.md)\)/gu;
const ARCHITECTURE_ANCHOR = /\]\(([\w./-]+\.md)#([^)]+)\)/gu;

function quote(text: string): string {
    return JSON.stringify(text);
}

function frontMatter(title: string, description: string): string {
    return `---\ntitle: ${quote(title)}\ndescription: ${quote(description)}\n---\n\n`;
}

function bullets(items: string[]): string {
    return items.map((item) => `- ${item}`).join('\n');
}

function section(title: string, body: string): string {
    return body === '' ? '' : `\n## ${title}\n\n${body}\n`;
}

function row(cells: string[]): string {
    return `| ${cells.join(' | ')} |`;
}

function table(header: string[], rows: string[][]): string {
    return [row(header), row(header.map(() => '---')), ...rows.map((cells) => row(cells))].join('\n');
}

function cell(text: string): string {
    return text.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
}

function commandPage(command: Command): string {
    const usage = `gspot ${command.name()} ${command.usage()}`.trim();
    const options = command.options.map((option) => [`\`${option.flags}\``, cell(option.description)]);
    const argumentRows = command.registeredArguments.map((argument) => [
        `\`${argument.name()}\``,
        cell(argument.description || (argument.required ? 'required' : 'optional')),
    ]);
    const sections = [
        frontMatter(`gspot ${command.name()}`, command.description()),
        `${command.description()}.\n\n\`\`\`text\n${usage}\n\`\`\`\n`,
        section('Arguments', argumentRows.length === 0 ? '' : table(['Argument', 'Meaning'], argumentRows)),
        section('Options', options.length === 0 ? '' : table(['Flag', 'Meaning'], options)),
    ];
    return sections.join('');
}

function checkRow(check: CheckSpec): string[] {
    return [`[\`${check.id}\`](/reference/rules/${check.id}/)`, check.stage, cell(check.summary)];
}

function presetPage(manifest: Manifest): string {
    const { preset } = manifest;
    const tools = manifest.tools.map((tool) =>
        tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`,
    );
    const targets = manifest.configs.map((config) => `\`${config.target}\``);
    const rules = Object.values(manifest.rule_files).flatMap((files) => files.map((file) => `\`${file}\``));
    const settings = manifest.settings.map((setting) => `\`${setting.name}\`: ${setting.summary}`);
    const requires = preset.requires.map((id) => `\`${id}\``).join(', ');
    const opening = [
        `${preset.description}\n\nKind: ${preset.kind}.`,
        requires === '' ? '' : ` Requires: ${requires}.`,
        preset.default ? ' Selected by default.' : '',
        '\n',
    ].join('');
    return [
        frontMatter(preset.title, preset.description),
        opening,
        section('Tools', bullets(tools)),
        section('Generated configuration', bullets(targets)),
        section(
            'Checks',
            table(
                ['Check', 'Stage', 'What it finds'],
                manifest.checks.map((check) => checkRow(check)),
            ),
        ),
        section('Settings', bullets(settings)),
        section('Rule files', bullets(rules)),
    ].join('');
}

function rulePage(check: CheckSpec, preset: Manifest): string {
    const tool = check.tool ?? check.command?.[0];
    const lines = [
        frontMatter(check.id, check.summary),
        `${check.summary}\n\n## Why\n\n${check.why}\n\n## What to do\n\n${check.fix}\n\n## Where it runs\n\n`,
        `- Preset: [the ${preset.preset.id} preset](/reference/presets/${preset.preset.id}/)\n- Stage: ${check.stage}\n`,
        tool === undefined ? '' : `- Tool: ${tool}\n`,
        check.engine === undefined ? '' : `- Engine: ${check.engine}\n`,
        `\nTurn it off for a path with a reason: \`gspot ignore ${check.id} --paths <glob> --reason "<why>"\`.\n`,
    ];
    return lines.join('');
}

function settingsPage(manifests: Manifest[]): string {
    const seen = new Map<string, { setting: SettingSpec; preset: string }>();
    for (const manifest of manifests)
        for (const setting of manifest.settings)
            if (!seen.has(setting.name)) seen.set(setting.name, { setting, preset: manifest.preset.id });
    const rows = seen
        .values()
        .toArray()
        .toSorted((a, b) => a.setting.name.localeCompare(b.setting.name))
        .map(({ setting, preset }) => [
            `\`${setting.name}\``,
            setting.kind,
            setting.direction,
            setting.default === undefined ? '' : `\`${cell(JSON.stringify(setting.default))}\``,
            cell(setting.summary),
            `[the ${preset} preset](/reference/presets/${preset}/)`,
        ]);
    return `${frontMatter('Settings', 'Every key gspot.toml takes, with its kind, direction and default.')}Every key \`gspot set\` writes and \`gspot doctor --settings\` prints. A loosening (raising a ceiling, turning a tool off) takes a reason; a tightening does not.\n\n${table(['Key', 'Kind', 'Direction', 'Default', 'Meaning', 'Preset'], rows)}\n`;
}

function enginesPage(checks: Map<string, { check: CheckSpec; preset: Manifest }>): string {
    const byEngine = new Map<string, CheckSpec[]>();
    for (const { check } of checks.values()) {
        if (check.engine === undefined) continue;
        const list = byEngine.get(check.engine) ?? [];
        list.push(check);
        byEngine.set(check.engine, list);
    }
    const sections = [...byEngine]
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(
            ([engine, list]) =>
                `## ${engine.charAt(0).toUpperCase()}${engine.slice(1)}

${table(
    ['Check', 'Stage', 'What it finds'],
    list.map((check) => checkRow(check)),
)}\n`,
        );
    return `${frontMatter('Engines', 'The checks gspot runs itself, by engine: structure, naming, prose and integrity.')}gspot runs external tools for what they do well and its own engines for the rest. Each engine is a set of checks; every check explains itself on its own page.\n\n${sections.join('\n')}`;
}

function decisionsPage(): string {
    const text = readFileSync(DECISIONS, 'utf8').replace(/^# [^\n]*\n\n?/u, '');
    const linked = text
        .replaceAll(
            ARCHITECTURE_ANCHOR,
            (_match, file: string, anchor: string) => `](${ARCHITECTURE_URL}${file}#${anchor})`,
        )
        .replaceAll(ARCHITECTURE_FILE, (_match, file: string) => `](${ARCHITECTURE_URL}${file})`);
    return `${frontMatter('Decisions', 'The decision log of the architecture, copied from the repository.')}${linked}`;
}

async function formatted(raw: Map<string, string>): Promise<Map<string, string>> {
    const options = JSON.parse(readFileSync(PRETTIER, 'utf8')) as Options;
    const out = new Map<string, string>();
    for (const [path, content] of raw) out.set(path, await format(content, { ...options, parser: 'markdown' }));
    return out;
}

function pages(): Map<string, string> {
    const out = new Map<string, string>();
    const program = buildProgram();
    for (const command of program.commands) out.set(`commands/${command.name()}.md`, commandPage(command));
    const manifests = presetManifests()
        .values()
        .toArray()
        .toSorted((a, b) => a.preset.id.localeCompare(b.preset.id));
    for (const manifest of manifests) out.set(`presets/${manifest.preset.id}.md`, presetPage(manifest));
    const checks = allChecks();
    for (const { check, preset } of checks.values()) out.set(`rules/${check.id}.md`, rulePage(check, preset));
    out.set('settings.md', settingsPage(manifests));
    out.set('engines.md', enginesPage(checks));
    out.set('decisions.md', decisionsPage());
    return out;
}

function onDisk(directory: string, prefix = ''): string[] {
    if (!existsSync(directory)) return [];
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
        return entry.isDirectory() ? onDisk(join(directory, entry.name), path) : [path];
    });
}

function check(wanted: Map<string, string>): number {
    const problems: string[] = [];
    for (const [path, content] of wanted) {
        const file = join(REFERENCE, path);
        if (!existsSync(file)) problems.push(`missing  ${path}`);
        else if (readFileSync(file, 'utf8') !== content) problems.push(`changed  ${path}`);
    }
    for (const path of onDisk(REFERENCE)) if (!wanted.has(path)) problems.push(`stray    ${path}`);
    if (problems.length === 0) {
        console.log(`${String(wanted.size)} reference pages match the binary`);
        return 0;
    }
    console.log(`${problems.join('\n')}\nRun bun docs/reference-pages.ts to rewrite the reference pages.`);
    return 1;
}

function write(wanted: Map<string, string>): number {
    rmSync(REFERENCE, { recursive: true, force: true });
    for (const [path, content] of wanted) {
        const file = join(REFERENCE, path);
        mkdirSync(join(file, '..'), { recursive: true });
        writeFileSync(file, content);
    }
    console.log(`wrote ${String(wanted.size)} reference pages`);
    return 0;
}

const wanted = await formatted(pages());
process.exitCode = process.argv.includes('--check') ? check(wanted) : write(wanted);
