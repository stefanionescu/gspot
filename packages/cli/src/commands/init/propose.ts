import { stringify } from 'smol-toml';
import { patch } from '@decimalturn/toml-patch';
import { policySchema } from '#cli/policy/schema.ts';
import { asRaw } from '#cli/policy/adoption/source.ts';
import type { InitPlan } from '#cli/types/commands/init.ts';
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

function xcodeTable(xcode: InitPlan['xcode']): TomlTable | undefined {
    if (xcode === undefined) return undefined;
    return xcode.scheme === undefined ? { project: xcode.project } : { project: xcode.project, scheme: xcode.scheme };
}

function toolTables(
    kept: AdoptionResult,
    commitScopes: string[] | undefined,
    xcode?: InitPlan['xcode'],
): Record<string, TomlTable | undefined> {
    const tables: Record<string, TomlTable | undefined> = Object.fromEntries(
        [...kept.tools]
            .filter(([, entry]) => Object.keys(entry.settings).length > 0)
            .map(([tool, entry]) => [tool, entry.settings]),
    );
    if (kept.formatter?.ignorePatterns !== undefined)
        tables['prettier'] = { ...tables['prettier'], ignore_patterns: kept.formatter.ignorePatterns };
    if (commitScopes !== undefined && commitScopes.length > 0)
        tables['commitlint'] = { ...tables['commitlint'], scopes: commitScopes };
    if (xcode?.scope === '') tables['xcode'] = xcodeTable(xcode);
    return Object.fromEntries(Object.entries(tables).filter(([, table]) => table !== undefined));
}

function headTables(plan: InitPlan): TomlTable {
    const document: TomlTable = {
        version: 1,
        level: policySchema.shape.level.parse(undefined),
        kits: plan.kits,
    };
    const scopes = new Map<string, { path: string; kits: string[]; tools: TomlTable }>(
        plan.scopes.map((scope) => [
            scope.path,
            {
                path: scope.path,
                kits: scope.kits,
                tools: plan.xcode?.scope === scope.path ? { xcode: xcodeTable(plan.xcode) } : {},
            },
        ]),
    );
    for (const [path, adopted] of plan.kept.scopes) {
        const scope = scopes.get(path) ?? { path, kits: [], tools: {} };
        scope.kits = [...new Set([...scope.kits, ...adopted.kits])];
        scope.tools = { ...scope.tools, ...adopted.tools };
        scopes.set(path, scope);
    }
    if (scopes.size > 0)
        document['scope'] = [...scopes.values()].map(({ tools, ...scope }) => ({
            ...scope,
            ...(Object.keys(tools).length === 0 ? {} : { tools }),
        }));
    if (plan.formatter !== undefined && Object.keys(plan.formatter.format).length > 0)
        document['format'] = plan.formatter.format;
    return document;
}

// Repository keys override each tool setting without dropping profile siblings.
function mergeToolSettings(base: unknown, overrides: unknown): TomlTable {
    const tools = { ...asRaw(base) };
    for (const [tool, settings] of Object.entries(asRaw(overrides) ?? {}))
        tools[tool] = { ...asRaw(tools[tool]), ...asRaw(settings) };
    return tools;
}

function applyFormatter(tools: Record<string, TomlTable | undefined>, formatter: InitPlan['formatter']): void {
    if (formatter === undefined) return;
    if (formatter.extra !== undefined) tools['prettier'] = { ...tools['prettier'], extra: formatter.extra };
    if (formatter.nativeDefaults === true) tools['prettier'] = { ...tools['prettier'], native_defaults: true };
    if (formatter.editorconfig !== undefined) tools['editorconfig'] = { adopted: formatter.editorconfig };
}

function applyDetectedTools(tools: Record<string, TomlTable | undefined>, detected: InitPlan['detected']): void {
    for (const { key, value } of detected ?? []) {
        const [table, first, second, ...more] = key.split('.');
        if (table === 'tools' && first !== undefined && second !== undefined && more.length === 0)
            tools[first] = { ...tools[first], [second]: value };
    }
}

function applyDetectedArchitecture(document: TomlTable, detected: InitPlan['detected']): void {
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
function applyIntegrations(document: TomlTable, plan: InitPlan): void {
    if (plan.hooks === 'none') delete document['hooks'];
    else document['hooks'] = { ...asRaw(document['hooks']), tool: plan.hooks };
    if (plan.ci === 'none') delete document['ci'];
    else document['ci'] = { ...asRaw(document['ci']), provider: plan.ci };
    document['guides'] = { directory: '.gspot/guides', ...asRaw(document['guides']), install: plan.rules };
    document['coverage'] = { strict: false, ...asRaw(document['coverage']) };
    if (plan.runner === 'none') delete document['runner'];
    else {
        const runner = asRaw(document['runner']) ?? {};
        const tasks = { ...plan.runnerTasks, ...asRaw(runner['tasks']) };
        document['runner'] = {
            ...runner,
            tool: plan.runner,
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
 * The gspot.toml text for a plan.
 * @param plan the plan
 * @returns the TOML text with the schema line and the preface
 */
export function proposeText(plan: InitPlan): string {
    const document = headTables(plan);
    const tools = toolTables(plan.kept, plan.commitScopes, plan.xcode);
    applyFormatter(tools, plan.formatter);
    applyDetectedTools(tools, plan.detected);
    applyDetectedArchitecture(document, plan.detected);
    if (Object.keys(tools).length > 0) document['tools'] = tools;
    mergeProfile(document, plan.profileTables);
    const ignores = [...plan.kept.tools.values()]
        .flatMap((tool) => tool.ignores)
        .map((entry) => ({
            check: entry.check,
            ...(entry.rule === undefined ? {} : { rule: entry.rule }),
            ...(entry.paths === undefined ? {} : { paths: entry.paths }),
            reason: entry.reason,
        }));
    if (ignores.length > 0)
        document['ignore'] = [...((document['ignore'] as TomlTable[] | undefined) ?? []), ...ignores];
    applyIntegrations(document, plan);
    return `${PREFACE}${bodyText(document)}`;
}
