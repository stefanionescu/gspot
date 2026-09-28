import { stringify } from 'smol-toml';
import { patch } from '@decimalturn/toml-patch';
import { policySchema } from '#cli/policy/schema.ts';
import { asRaw } from '#cli/policy/adoption/source.ts';
import type { InitProposal } from '#cli/types/commands/init.ts';
import type { AdoptionResult } from '#cli/types/policy/adoption.ts';
import type { TomlTable } from '#cli/types/repository/repository.ts';
import { SCHEMA_LINE, PROFILE_HEAD } from '#cli/config/commands/init.ts';
import { policyIndent, wrapLongArrays } from '#cli/policy/toml/width.ts';

const PREFACE = [
    SCHEMA_LINE,
    '',
    '# The policy of this repository under gspot. Every setting has a command that writes it:',
    '# gspot set, ignore, add, remove. Run gspot explain <anything> for what it means.',
    '',
    '',
].join('\n');

function xcodeTable(xcode: InitProposal['xcode']): TomlTable | undefined {
    if (xcode === undefined) return undefined;
    return xcode.scheme === undefined ? { project: xcode.project } : { project: xcode.project, scheme: xcode.scheme };
}

function toolTables(
    carried: AdoptionResult,
    commitScopes: string[] | undefined,
    xcode?: InitProposal['xcode'],
): Record<string, TomlTable | undefined> {
    const tables: Record<string, TomlTable | undefined> = Object.fromEntries(
        [...carried.tools]
            .filter(([, entry]) => Object.keys(entry.settings).length > 0)
            .map(([tool, entry]) => [tool, entry.settings]),
    );
    if (carried.formatter?.ignorePatterns !== undefined)
        tables['prettier'] = { ...tables['prettier'], ignore_patterns: carried.formatter.ignorePatterns };
    if (commitScopes !== undefined && commitScopes.length > 0)
        tables['commitlint'] = { ...tables['commitlint'], scopes: commitScopes };
    if (xcode?.scope === '') tables['xcode'] = xcodeTable(xcode);
    return Object.fromEntries(Object.entries(tables).filter(([, table]) => table !== undefined));
}

function headTables(proposal: InitProposal): TomlTable {
    const document: TomlTable = {
        version: 1,
        level: policySchema.shape.level.parse(undefined),
        configurations: proposal.configurations,
    };
    const scopes = new Map<string, { path: string; configurations: string[]; tools: TomlTable }>(
        proposal.scopes.map((scope) => [
            scope.path,
            {
                path: scope.path,
                configurations: scope.configurations,
                tools: proposal.xcode?.scope === scope.path ? { xcode: xcodeTable(proposal.xcode) } : {},
            },
        ]),
    );
    for (const [path, adopted] of proposal.carried.scopes) {
        const scope = scopes.get(path) ?? { path, configurations: [], tools: {} };
        scope.configurations = [...new Set([...scope.configurations, ...adopted.configurations])];
        scope.tools = { ...scope.tools, ...adopted.tools };
        scopes.set(path, scope);
    }
    if (scopes.size > 0)
        document['scope'] = [...scopes.values()].map(({ tools, ...scope }) => ({
            ...scope,
            ...(Object.keys(tools).length === 0 ? {} : { tools }),
        }));
    if (proposal.formatter !== undefined && Object.keys(proposal.formatter.format).length > 0)
        document['format'] = proposal.formatter.format;
    return document;
}

// Repository keys override each tool setting without dropping profile siblings.
function mergeToolSettings(base: unknown, overrides: unknown): TomlTable {
    const tools = { ...asRaw(base) };
    for (const [tool, settings] of Object.entries(asRaw(overrides) ?? {}))
        tools[tool] = { ...asRaw(tools[tool]), ...asRaw(settings) };
    return tools;
}

function applyFormatter(tools: Record<string, TomlTable | undefined>, formatter: InitProposal['formatter']): void {
    if (formatter === undefined) return;
    if (formatter.extra !== undefined) tools['prettier'] = { ...tools['prettier'], extra: formatter.extra };
    if (formatter.nativeDefaults === true) tools['prettier'] = { ...tools['prettier'], native_defaults: true };
    if (formatter.editorconfig !== undefined) tools['editorconfig'] = { adopted: formatter.editorconfig };
}

function applyDetectedTools(tools: Record<string, TomlTable | undefined>, detected: InitProposal['detected']): void {
    for (const { key, value } of detected ?? []) {
        const [table, first, second, ...more] = key.split('.');
        if (table === 'tools' && first !== undefined && second !== undefined && more.length === 0)
            tools[first] = { ...tools[first], [second]: value };
    }
}

function applyDetectedArchitecture(document: TomlTable, detected: InitProposal['detected']): void {
    for (const { key, value } of detected ?? []) {
        const [table, first, second] = key.split('.');
        if (table === 'architecture' && first !== undefined && second === undefined)
            document['architecture'] = { ...asRaw(document['architecture']), [first]: value };
    }
}

// Repository settings override the same profile setting, without dropping other settings of that tool.
function mergeProfile(document: TomlTable, tables: TomlTable | undefined): void {
    const entries = Object.entries(tables ?? {}).filter(([key]) => !PROFILE_HEAD.has(key));
    for (const [key, value] of entries) {
        const existing = document[key];
        if (key === 'tools') {
            document[key] = mergeToolSettings(value, existing);
            continue;
        }
        const isBothTables =
            Object.keys(asRaw(existing) ?? {}).length > 0 && Object.keys(asRaw(value) ?? {}).length > 0;
        document[key] = isBothTables ? { ...asRaw(value), ...asRaw(existing) } : value;
    }
}

// Initialization selects enabled integrations; profile task names retain precedence.
function applyIntegrations(document: TomlTable, proposal: InitProposal): void {
    if (proposal.hooks === 'none') delete document['hooks'];
    else document['hooks'] = { ...asRaw(document['hooks']), tool: proposal.hooks };
    if (proposal.ci === 'none') delete document['ci'];
    else document['ci'] = { ...asRaw(document['ci']), provider: proposal.ci };
    document['rules'] = { directory: '.gspot/rules', ...asRaw(document['rules']), install: proposal.rules };
    document['coverage'] = { strict: false, ...asRaw(document['coverage']) };
    if (proposal.runner === 'none') delete document['runner'];
    else {
        const runner = asRaw(document['runner']) ?? {};
        const tasks = { ...proposal.runnerTasks, ...asRaw(runner['tasks']) };
        document['runner'] = {
            ...runner,
            tool: proposal.runner,
            ...(Object.keys(tasks).length === 0 ? {} : { tasks }),
        };
    }
}

// The settings of a scope are written the way gspot set writes them, as one inline table inside the scope.
// The patcher refuses a document where one scope holds an inline tools table and another a sub-table.
function bodyText(document: TomlTable): string {
    const scopes = (document['scope'] as TomlTable[] | undefined) ?? [];
    const bare = { ...document, scope: scopes.map(({ tools: _tools, ...rest }) => rest) };
    const plain = stringify(scopes.length === 0 ? document : bare);
    // Arrays take the layout the TOML formatter keeps, so the first format check of the policy passes.
    const tight = plain.replaceAll(/= \[ (?<items>[^\n]*) \]$/gmu, '= [$<items>]');
    const seed = tight.endsWith('\n') ? tight : `${tight}\n`;
    const indent = policyIndent(document);
    if (scopes.every((scope) => scope['tools'] === undefined)) return wrapLongArrays(seed, indent);
    return wrapLongArrays(
        patch(seed, document, { inlineTableStart: 2, bracketSpacing: false, trailingComma: false }),
        indent,
    );
}

/**
 * The gspot.toml text for a proposal.
 * @param proposal the proposal
 * @returns the TOML text with the schema line and the preface
 */
export function proposeText(proposal: InitProposal): string {
    const document = headTables(proposal);
    const tools = toolTables(proposal.carried, proposal.commitScopes, proposal.xcode);
    applyFormatter(tools, proposal.formatter);
    applyDetectedTools(tools, proposal.detected);
    applyDetectedArchitecture(document, proposal.detected);
    if (Object.keys(tools).length > 0) document['tools'] = tools;
    mergeProfile(document, proposal.profileTables);
    const ignores = [...proposal.carried.tools.values()]
        .flatMap((tool) => tool.ignores)
        .map((entry) => ({
            check: entry.check,
            ...(entry.rule === undefined ? {} : { rule: entry.rule }),
            ...(entry.paths === undefined ? {} : { paths: entry.paths }),
            reason: entry.reason,
        }));
    if (ignores.length > 0)
        document['ignore'] = [...((document['ignore'] as TomlTable[] | undefined) ?? []), ...ignores];
    applyIntegrations(document, proposal);
    return `${PREFACE}${bodyText(document)}`;
}
