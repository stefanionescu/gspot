import { pluginReferencePages } from './plugin-reference';
import { configurationReference } from './configuration-reference';
import { referenceHeader, REFERENCE_MARKER } from './source';
import { isDeepStrictEqual } from 'node:util';
import { dirname, join, resolve } from 'node:path';
// Generates reference pages from the command and preset definitions used by the CLI.
import { fileURLToPath } from 'node:url';
import { format, type Options } from 'prettier';
import { Command, CommanderError } from 'commander';
import { buildProgram } from '@gspot/cli/src/program.ts';
import { allChecks } from '@gspot/cli/src/presets/listing.ts';
import { presetManifests } from '@gspot/cli/src/presets/read-manifests.ts';
import packageManifest from '@gspot/cli/package.json' with { type: 'json' };
import { exposedSettings } from '../packages/cli/src/policy/settings.ts';
import type { CheckSpec, Manifest, SettingSpec } from '@gspot/cli/types/manifest.ts';
import {
    lstatSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    renameSync,
    rmSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const REFERENCE = join(ROOT, 'src', 'content', 'docs', 'reference');
const PRETTIER = join(ROOT, '..', '.gspot', 'prettier.json');
const REFERENCE_MODE = 0o644;
const PERMISSION_BITS = 0o777;
function bullets(items: string[]): string {
    return items.map((item) => `- ${item}`).join('\n');
}

function section(title: string, body: string): string {
    return body === '' ? '' : `\n## ${title}\n\n${body}\n`;
}

function table(header: string[], rows: string[][]): string {
    return [header, header.map(() => '---'), ...rows].map((cells) => `| ${cells.join(' | ')} |`).join('\n');
}

function cell(text: string): string {
    return text.replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
}

function commandPage(command: Command, name: string): string {
    const helper = command.createHelp();
    helper.showGlobalOptions = true;
    const usage = helper.commandUsage(command);
    const visible = new Map(
        [...helper.visibleGlobalOptions(command), ...helper.visibleOptions(command)].map((option) => [
            option.flags,
            option,
        ]),
    );
    const options = [...visible.values()].map((option) => [
        `\`${option.flags}\``,
        cell(helper.optionDescription(option)),
    ]);
    const argumentRows = command.registeredArguments.map((argument) => [
        `\`${argument.name()}\``,
        cell(argument.description || (argument.required ? 'required' : 'optional')),
    ]);
    const sections = [
        referenceHeader(`gspot ${name}`, command.description(), 'packages/cli/src/program.ts'),
        `${command.description()}.\n\n\`\`\`text\n${usage}\n\`\`\`\n`,
        section('Arguments', argumentRows.length === 0 ? '' : table(['Argument', 'Meaning'], argumentRows)),
        section('Options', options.length === 0 ? '' : table(['Flag', 'Meaning'], options)),
    ];
    return sections.join('');
}

function checkRow(check: CheckSpec): string[] {
    return [`[\`${check.name}\`](/reference/rules/${check.name}/)`, check.stage, cell(check.summary)];
}

function presetPage(manifest: Manifest): string {
    const { preset } = manifest;
    const tools = manifest.tools.map((tool) =>
        tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`,
    );
    const targets = manifest.configs.map((config) =>
        config.needs === undefined
            ? `\`${config.target}\``
            : `\`${config.target}\` when the [${config.needs} preset](/reference/presets/${config.needs}/) is selected`,
    );
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
        referenceHeader(preset.title, preset.description, `${manifest.dir}/manifest.toml`),
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
        referenceHeader(check.name, check.summary, `${preset.dir}/manifest.toml`),
        `${check.summary}\n\n## Why\n\n${check.why}\n\n## What to do\n\n${check.help}\n\n## Where it runs\n\n`,
        `- Preset: [the ${preset.preset.name} preset](/reference/presets/${preset.preset.name}/)\n- Stage: ${check.stage}\n- Level: ${check.level}\n`,
        tool === undefined ? '' : `- Tool: ${tool}\n`,
        check.engine === undefined ? '' : `- Engine: ${check.engine}\n`,
        check.waits_for === undefined ? '' : `- Required setting: \`${check.waits_for}\`\n`,
        `\nTurn it off for a path with a reason: \`gspot ignore ${check.name} --paths <glob> --reason "<why>"\`.\n`,
    ];
    return lines.join('');
}

function settingsPage(manifests: Manifest[]): string {
    const seen = new Map<string, { setting: SettingSpec; owners: string[] }>();
    const definitions = [
        ...[...exposedSettings([]).specs.values()].map((setting) => ({ setting, owner: 'Repository policy' })),
        ...manifests.flatMap((manifest) =>
            manifest.settings.map((setting) => ({
                setting,
                owner: `[the ${manifest.preset.name} preset](/reference/presets/${manifest.preset.name}/)`,
            })),
        ),
    ];
    for (const { setting, owner } of definitions) {
        const previous = seen.get(setting.name);
        if (previous === undefined) {
            seen.set(setting.name, { setting, owners: [owner] });
            continue;
        }
        if (!isDeepStrictEqual(previous.setting, setting))
            throw new Error(
                `Conflicting setting definition: ${setting.name} (${previous.owners.join(', ')} and ${owner}).`,
            );
        if (!previous.owners.includes(owner)) previous.owners.push(owner);
    }
    const rows = seen
        .values()
        .toArray()
        .toSorted((a, b) => a.setting.name.localeCompare(b.setting.name))
        .map(({ setting, owners }) => [
            `\`${setting.name}\``,
            setting.kind,
            setting.direction,
            setting.default === undefined ? '' : `\`${cell(JSON.stringify(setting.default))}\``,
            cell(setting.summary),
            owners.join(', '),
        ]);
    return `${referenceHeader('Settings', 'Settings exposed by gspot set, with their kinds, directions, defaults, and owners.')}Every key \`gspot set\` writes and \`gspot list settings\` prints. Reasons are optional unless the repository enables \`require_reasons\`.\n\n${table(['Key', 'Kind', 'Direction', 'Default', 'Meaning', 'Preset'], rows)}\n`;
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
    return `${referenceHeader('Engines', 'The checks gspot runs itself, by engine: structure, naming, prose and integrity.', 'packages/cli/src/run/engines.ts')}gspot runs external tools for what they do well and its own engines for the rest. Each engine is a set of checks; every check explains itself on its own page.\n\n${sections.join('\n')}`;
}

async function formatted(raw: Map<string, string>): Promise<Map<string, string>> {
    const options = JSON.parse(readFileSync(PRETTIER, 'utf8')) as Options;
    const out = new Map<string, string>();
    for (const [path, content] of raw) out.set(path, await format(content, { ...options, parser: 'markdown' }));
    return out;
}

/**
 * Build public references from the command definitions and validated manifests.
 * @returns generated Markdown by relative destination
 */
export function referencePages(): Map<string, string> {
    const out = new Map<string, string>();
    const program = buildProgram();
    const commands = (parent: Command, ancestors: string[]): void => {
        for (const command of parent.createHelp().visibleCommands(parent)) {
            if (!parent.commands.includes(command)) continue;
            const path = [...ancestors, command.name()];
            out.set(`commands/${path.join('/')}.md`, commandPage(command, path.join(' ')));
            commands(command, path);
        }
    };
    commands(program, []);
    const manifests = presetManifests()
        .values()
        .toArray()
        .toSorted((a, b) => a.preset.name.localeCompare(b.preset.name));
    for (const manifest of manifests) out.set(`presets/${manifest.preset.name}.md`, presetPage(manifest));
    const checks = allChecks();
    for (const { check, preset } of checks.values()) out.set(`rules/${check.name}.md`, rulePage(check, preset));
    out.set('settings.md', settingsPage(manifests));
    out.set(
        'configuration.md',
        referenceHeader('Configuration fields', 'All policy fields from the validated schema.') +
            configurationReference(),
    );
    out.set('engines.md', enginesPage(checks));
    for (const [path, page] of pluginReferencePages()) out.set(path, page);
    return out;
}

function assertDirectory(directory: string): void {
    const parent = dirname(directory);
    if (parent !== directory) assertDirectory(parent);
    const stat = lstatSync(directory, { throwIfNoEntry: false });
    if (stat !== undefined && !stat.isDirectory())
        throw new Error(`Reference output requires a directory without symbolic links: ${directory}`);
}

function onDisk(directory: string, prefix = ''): string[] {
    const stat = lstatSync(directory, { throwIfNoEntry: false });
    if (stat === undefined) return [];
    if (!stat.isDirectory()) throw new Error(`Reference output is not a directory: ${directory}`);
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
        if (entry.isSymbolicLink()) throw new Error(`Reference output contains a symbolic link: ${path}`);
        if (entry.isDirectory()) return onDisk(join(directory, entry.name), path);
        if (!entry.isFile()) throw new Error(`Reference output contains a special file: ${path}`);
        return [path];
    });
}

function hasGeneratedHeader(content: string): boolean {
    const header = /^---\r?\n[\s\S]*?\r?\n---\r?\n\r?\n/u.exec(content);
    return header !== null && content.slice(header[0].length).startsWith(`${REFERENCE_MARKER}\n`);
}

// Validate every destination before creating output or staging replacement bytes.
function assertReferenceTarget(root: string, path: string, content: string, owned: Set<string>): void {
    if (
        !path.endsWith('.md') ||
        /[\\:\p{Cc}]/u.test(path) ||
        path.split('/').some((part) => ['', '.', '..'].includes(part))
    )
        throw new Error(`Invalid reference output path: ${path}`);
    if (!hasGeneratedHeader(content)) throw new Error(`Reference page has no generation marker: ${path}`);
    const full = join(root, path);
    assertDirectory(dirname(full));
    const stat = lstatSync(full, { throwIfNoEntry: false });
    if (stat !== undefined && (!stat.isFile() || !owned.has(path)))
        throw new Error(`Reference output collides with authored content: ${path}`);
}

/**
 * Render every page before replacing or pruning marked reference output.
 * @param directory the owned reference directory
 * @param raw proposed Markdown pages by relative path
 */
export async function writeReferencePages(directory: string, raw: Map<string, string>): Promise<void> {
    const wanted = await formatted(raw);
    const root = resolve(directory);
    assertDirectory(root);
    const existing = onDisk(root);
    const owned = new Set(
        existing.filter((path) => path.endsWith('.md') && hasGeneratedHeader(readFileSync(join(root, path), 'utf8'))),
    );
    for (const [path, content] of wanted) assertReferenceTarget(root, path, content, owned);
    mkdirSync(root, { recursive: true });
    const staging = mkdtempSync(join(root, '.reference-'));
    try {
        const replacements = [...wanted].filter(
            ([path, content]) => !owned.has(path) || readFileSync(join(root, path), 'utf8') !== content,
        );
        for (const [index, [path, content]] of replacements.entries()) {
            const mode = lstatSync(join(root, path), { throwIfNoEntry: false })?.mode;
            writeFileSync(join(staging, String(index)), content, {
                flag: 'wx',
                mode: mode === undefined ? REFERENCE_MODE : mode & PERMISSION_BITS,
            });
        }
        for (const [index, [path]] of replacements.entries()) {
            const full = join(root, path);
            assertDirectory(dirname(full));
            mkdirSync(dirname(full), { recursive: true });
            renameSync(join(staging, String(index)), full);
        }
        for (const path of owned) if (!wanted.has(path)) unlinkSync(join(root, path));
    } finally {
        rmSync(staging, { recursive: true });
    }
}

if (import.meta.main) {
    try {
        new Command('bun docs/reference-pages.ts')
            .description('Generate the public reference pages')
            .version(packageManifest.version)
            .allowExcessArguments(false)
            .showHelpAfterError()
            .addHelpText('after', '\nExample: bun docs/reference-pages.ts')
            .exitOverride()
            .parse();
        const wanted = referencePages();
        await writeReferencePages(REFERENCE, wanted);
        console.log(`wrote ${String(wanted.size)} reference pages`);
    } catch (error) {
        if (!(error instanceof CommanderError)) throw error;
        process.exitCode = error.exitCode === 0 ? 0 : 2;
    }
}
