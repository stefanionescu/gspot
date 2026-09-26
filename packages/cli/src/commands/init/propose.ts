import { stringify } from 'smol-toml';
import { patch } from '@decimalturn/toml-patch';
import { policySchema } from '#cli/policy/schema.ts';
import type { InitProposal } from '#cli/types/commands/init.ts';
import type { TomlTable } from '#cli/types/repository/repository.ts';
import { policyIndent, wrapLongArrays } from '#cli/policy/toml-width.ts';
import type { CarriedConfiguration } from '#cli/types/policy/adoption.ts';

const SCHEMA_LINE = '#:schema https://gspot.dev/schema/gspot.schema.json';

const PREFACE = [
    SCHEMA_LINE,
    '',
    '# The policy of this repository under gspot. Every setting has a command that writes it:',
    '# gspot set, ignore, add, remove. Run gspot explain <anything> for what it means.',
    '',
    '',
].join('\n');

function nonEmpty(table: Record<string, unknown[]>): TomlTable | undefined {
    const kept = Object.entries(table).filter(([, list]) => list.length > 0);
    return kept.length === 0 ? undefined : Object.fromEntries(kept);
}

function xcodeTable(xcode: InitProposal['xcode']): TomlTable | undefined {
    if (xcode === undefined) return undefined;
    return xcode.scheme === undefined ? { project: xcode.project } : { project: xcode.project, scheme: xcode.scheme };
}

function toolTables(
    carried: CarriedConfiguration,
    commitScopes: string[] | undefined,
    xcode?: InitProposal['xcode'],
): TomlTable {
    const tables: Record<string, TomlTable | undefined> = Object.fromEntries(
        [...carried.tools]
            .filter(([, entry]) => Object.keys(entry.settings).length > 0)
            .map(([tool, entry]) => [tool, entry.settings]),
    );
    if (carried.formatter?.ignorePatterns !== undefined)
        tables['prettier'] = { ...tables['prettier'], ignore_patterns: carried.formatter.ignorePatterns };
    const commits = nonEmpty({ scopes: commitScopes ?? [] });
    if (commits !== undefined) tables['commitlint'] = { ...tables['commitlint'], ...commits };
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

function ignoreTables(carried: CarriedConfiguration): TomlTable[] {
    return [...carried.tools.values()]
        .flatMap((tool) => tool.ignores)
        .map((entry) => ({
            check: entry.check,
            ...(entry.rule === undefined ? {} : { rule: entry.rule }),
            ...(entry.paths === undefined ? {} : { paths: entry.paths }),
            reason: entry.reason,
        }));
}

const PROFILE_HEAD = new Set(['version', 'profile', 'selection', 'configurations']);

function asTable(value: unknown): TomlTable {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as TomlTable) : {};
}

// Repository settings override the same profile setting, without dropping other settings of that tool.
function mergeProfile(document: TomlTable, tables: TomlTable | undefined): void {
    const entries = Object.entries(tables ?? {}).filter(([key]) => !PROFILE_HEAD.has(key));
    for (const [key, value] of entries) {
        const existing = document[key];
        if (key === 'tools') {
            const tools = { ...asTable(value) };
            for (const [tool, settings] of Object.entries(asTable(existing)))
                tools[tool] = { ...asTable(tools[tool]), ...asTable(settings) };
            document[key] = tools;
            continue;
        }
        const isBothTables = Object.keys(asTable(existing)).length > 0 && Object.keys(asTable(value)).length > 0;
        document[key] = isBothTables ? { ...asTable(value), ...asTable(existing) } : value;
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
    return wrapLongArrays(patch(seed, document, { inlineTableStart: 2, bracketSpacing: false }), indent);
}

/**
 * The gspot.toml text for a proposal.
 * @param proposal the proposal
 * @returns the TOML text with the schema line and the preface
 */
export function proposeText(proposal: InitProposal): string {
    const document = headTables(proposal);
    const tools = toolTables(proposal.carried, proposal.commitScopes, proposal.xcode);
    if (proposal.formatter?.extra !== undefined)
        tools['prettier'] = { ...(tools['prettier'] as TomlTable), extra: proposal.formatter.extra };
    if (proposal.formatter?.nativeDefaults === true)
        tools['prettier'] = { ...(tools['prettier'] as TomlTable), native_defaults: true };
    if (proposal.formatter?.editorconfig !== undefined)
        tools['editorconfig'] = { adopted: proposal.formatter.editorconfig };
    // What init read from the repository for the settings whose manifests say where to look (K-93).
    for (const { key, value } of proposal.detected ?? []) {
        const [table, first, second, ...more] = key.split('.');
        if (table === 'tools' && first !== undefined && second !== undefined && more.length === 0)
            tools[first] = { ...asTable(tools[first]), [second]: value };
        else if (table === 'architecture' && first !== undefined && second === undefined)
            document['architecture'] = { ...asTable(document['architecture']), [first]: value };
    }
    if (Object.keys(tools).length > 0) document['tools'] = tools;
    mergeProfile(document, proposal.profileTables);
    if ([...proposal.carried.tools.values()].some((tool) => tool.ignores.length > 0))
        document['ignore'] = [
            ...((document['ignore'] as TomlTable[] | undefined) ?? []),
            ...ignoreTables(proposal.carried),
        ];
    if (proposal.hooks === 'none') delete document['hooks'];
    else document['hooks'] = { ...asTable(document['hooks']), tool: proposal.hooks };
    if (proposal.ci === 'none') delete document['ci'];
    else document['ci'] = { ...asTable(document['ci']), provider: proposal.ci };
    document['rules'] = { directory: '.gspot/rules', ...asTable(document['rules']), install: proposal.rules };
    document['coverage'] = { strict: false, ...asTable(document['coverage']) };
    if (proposal.runner === 'none') delete document['runner'];
    else {
        const runner = asTable(document['runner']);
        const tasks = { ...proposal.runnerTasks, ...asTable(runner['tasks']) };
        document['runner'] = {
            ...runner,
            tool: proposal.runner,
            ...(Object.keys(tasks).length === 0 ? {} : { tasks }),
        };
    }
    return `${PREFACE}${bodyText(document)}`;
}
