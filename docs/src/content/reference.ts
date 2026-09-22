import type { Loader } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { parse as parseYaml } from 'yaml';
import { isDeepStrictEqual } from 'node:util';
import type { Command } from 'commander';
import { buildProgram } from '@gspot/cli/src/program.ts';
import { allChecks } from '@gspot/cli/src/presets/listing.ts';
import { presetManifests } from '@gspot/cli/src/presets/read-manifests.ts';
import { exposedSettings } from '@gspot/cli/src/policy/settings.ts';
import packageManifest from '@gspot/cli/package.json' with { type: 'json' };
import type { CheckSpec, Manifest, SettingSpec } from '@gspot/cli/src/presets/types.ts';
import type { JSONSchema } from 'zod/v4/core';
import { policyJsonSchema } from '@gspot/cli/src/policy/json-schema.ts';
import plugin from '../../../packages/eslint-plugin/src/plugin.ts';

const revision = process.env['GSPOT_DOCS_REVISION'];
if (revision !== undefined && !/^[a-f\d]{40}$/u.test(revision)) {
    throw new Error('GSPOT_DOCS_REVISION must be a full source commit ID.');
}

export const sourceRevision = revision ?? 'main';

/**
 * Label generated documentation with its version, source owner, and source attribution.
 * @param title the page title
 * @param description the page description
 * @param owner the repository-relative definition path
 * @returns Markdown front matter and source provenance
 */
export function referenceHeader(
    title: string,
    description: string,
    owner = 'packages/cli/src/policy/schema.ts',
): string {
    const source = `https://github.com/stefanionescu/gspot/blob/${sourceRevision}/${owner}`;
    return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\neditUrl: ${JSON.stringify(source)}\n---\n\ngspot ${packageManifest.version} · [Source definition](${source})\n\n`;
}

function schemaCell(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('|', '&#124;')
        .replaceAll('\n', ' ');
}

function constraints(node: JSONSchema.JSONSchema): string {
    const nested = new Set(['properties', 'items', 'anyOf', 'description']);
    const rest = Object.fromEntries(
        Object.entries(node).filter(
            ([key, value]) => !nested.has(key) && (key !== 'additionalProperties' || typeof value === 'boolean'),
        ),
    );
    return `<code>${schemaCell(JSON.stringify(rest))}</code>`;
}

function rows(node: JSONSchema.JSONSchema | boolean, path: string, required: boolean): string[] {
    if (typeof node === 'boolean')
        return [
            `| <code>${schemaCell(path)}</code> | ${required ? 'Required' : 'Optional'} | ${node ? 'Any value' : 'Not accepted'} | |`,
        ];
    const row = `| <code>${schemaCell(path)}</code> | ${required ? 'Required' : 'Optional'} | ${constraints(node)} | ${schemaCell(node.description ?? '')} |`;
    const properties = Object.entries(node.properties ?? {}).flatMap(([name, child]) =>
        rows(child, `${path}.${name}`, node.required?.includes(name) === true),
    );
    return [row, ...properties, ...arrayRows(node, path), ...variantRows(node, path, required)];
}

function arrayRows(node: JSONSchema.JSONSchema, path: string): string[] {
    if (node.items === undefined) return [];
    const items = Array.isArray(node.items) ? node.items : [node.items];
    return items.flatMap((child) => rows(child, `${path}[]`, false));
}

function variantRows(node: JSONSchema.JSONSchema, path: string, required: boolean): string[] {
    const alternatives = (node.anyOf ?? []).flatMap((child, index) =>
        rows(child, `${path} (form ${String(index + 1)})`, required),
    );
    const additional =
        typeof node.additionalProperties === 'object' ? rows(node.additionalProperties, `${path}.*`, false) : [];
    return [...alternatives, ...additional];
}

/**
 * Render all policy fields from the schema used by the production reader.
 * @returns Markdown reference tables
 */
export function configurationReference(): string {
    const schema: JSONSchema.JSONSchema = policyJsonSchema();
    const sections = Object.entries(schema.properties ?? {}).map(
        ([name, node]) =>
            `## ${name}\n\n| Field | Presence | Accepted structure and defaults | Meaning |\n| --- | --- | --- | --- |\n${rows(node, name, schema.required?.includes(name) === true).join('\n')}\n`,
    );
    return `The [machine-readable configuration schema](/schema/gspot.schema.json) defines these fields. Required means required within the containing table or array item. An optional table does not make its required children mandatory at the repository root.\n\n\`[]\` identifies an array item; \`*\` identifies a user-defined key. Alternative forms describe different accepted values for the same field. Constraints use JSON Schema notation, including \`enum\` for accepted values, \`default\` for schema defaults, and \`additionalProperties: false\` for tables that reject unknown keys.\n\nThe policy reader also validates selected presets, exposed settings, cross-field relationships, and required reasons. Use version 1 policies. See [scopes](/guides/scopes/) for inheritance and [settings](/reference/settings/) for preset-owned values.\n\n${sections.join('\n')}`;
}

/**
 * Read standalone plugin documentation from the rule definitions and actual configurations.
 * @returns generated pages by reference-relative path
 */
export function pluginReferencePages(): Map<string, string> {
    return new Map(
        Object.entries(plugin.rules).map(([name, rule]) => {
            const docs = rule.meta.docs;
            if (docs === undefined) throw new Error(`Plugin rule ${name} has no documentation.`);
            const configurations = Object.entries(plugin.configs)
                .filter(([, configuration]) => configuration.rules[`gspot/${name}`] !== undefined)
                .map(([level]) => `\`${level}\``);
            const selected =
                configurations.length === 0
                    ? 'Select this rule explicitly for the files it governs.'
                    : `Enabled by ${configurations.join(' and ')}.`;
            const body = `${docs.summary}\n\n${selected}\n\n## Why\n\n${docs.why}\n\n## Resolve the finding\n\n${docs.fix}\n\n## Options\n\nThe rule accepts options described by this JSON schema:\n\n\`\`\`json\n${JSON.stringify(rule.meta.schema, null, 2)}\n\`\`\`\n\nDefault options:\n\n\`\`\`json\n${JSON.stringify(rule.meta.defaultOptions ?? [], null, 2)}\n\`\`\`\n`;
            return [
                `plugin/${name}.md`,
                referenceHeader(`gspot/${name}`, docs.summary, `packages/eslint-plugin/src/rules/${name}.ts`) + body,
            ];
        }),
    );
}

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
                manifest.checks.map((check) => [
                    `[\`${check.name}\`](/reference/rules/${check.name}/)`,
                    check.stage,
                    cell(check.summary),
                ]),
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
    list.map((check) => [`[\`${check.name}\`](/reference/rules/${check.name}/)`, check.stage, cell(check.summary)]),
)}\n`,
        );
    return `${referenceHeader('Engines', 'The checks gspot runs itself, by engine: structure, naming, prose and integrity.', 'packages/cli/src/run/engines.ts')}gspot runs external tools for what they do well and its own engines for the rest. Each engine is a set of checks; every check explains itself on its own page.\n\n${sections.join('\n')}`;
}

export function referencePages(): Map<string, string> {
    const out = new Map<string, string>();
    const add = (path: string, content: string): void => {
        if (out.has(path)) throw new Error(`Duplicate reference identity: ${path}`);
        out.set(path, content);
    };
    const program = buildProgram();
    const commands = (parent: Command, ancestors: string[]): void => {
        for (const command of parent.createHelp().visibleCommands(parent)) {
            if (!parent.commands.includes(command)) continue;
            const path = [...ancestors, command.name()];
            add(`commands/${path.join('/')}.md`, commandPage(command, path.join(' ')));
            commands(command, path);
        }
    };
    commands(program, []);
    const manifests = presetManifests()
        .values()
        .toArray()
        .toSorted((a, b) => a.preset.name.localeCompare(b.preset.name));
    for (const manifest of manifests) add(`presets/${manifest.preset.name}.md`, presetPage(manifest));
    const checks = allChecks();
    for (const { check, preset } of checks.values()) add(`rules/${check.name}.md`, rulePage(check, preset));
    add('settings.md', settingsPage(manifests));
    add(
        'configuration.md',
        referenceHeader('Configuration fields', 'All policy fields from the validated schema.') +
            configurationReference(),
    );
    add('engines.md', enginesPage(checks));
    for (const [path, page] of pluginReferencePages()) add(path, page);
    return out;
}

/** Load authored documentation and definition-owned references into one Astro collection. */
export function referenceLoader(): Loader {
    return {
        name: 'gspot-reference',
        async load(context) {
            const previous = JSON.parse(context.meta.get('reference-ids') ?? '[]') as string[];
            for (const id of previous) context.store.delete(id);
            await docsLoader().load(context);
            const entries = [];
            for (const [path, markdown] of referencePages()) {
                const id = `reference/${path.slice(0, -3)}`;
                if (context.store.has(id)) throw new Error(`Duplicate reference identity: ${id}`);
                const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(markdown)!;
                const body = match[2]!;
                const data = await context.parseData({ id, data: parseYaml(match[1]!) as Record<string, unknown> });
                entries.push({
                    id,
                    filePath: `src/content/docs/${id}.md`,
                    data,
                    body,
                    rendered: await context.renderMarkdown(body),
                    digest: context.generateDigest(markdown),
                });
            }
            for (const entry of entries) context.store.set(entry);
            context.meta.set('reference-ids', JSON.stringify(entries.map((entry) => entry.id)));
        },
    };
}
