// Explain a check, or one rule of the tool a check runs.
import { allChecks } from '#cli/kits/listing.ts';
import { inspectTool } from '#cli/tools/inspect.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import { kitManifests } from '#cli/kits/manifests.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { quoteArgument } from '#cli/platform/quoting.ts';
import type { ToolPin, CheckSpec } from '#cli/types/kits.ts';
import { repositoryCheckSpec } from '#cli/policy/check-state.ts';
import { SWIFTLINT_LINES, TOOL_TIMEOUT_MS } from '#cli/config/commands/explain.ts';
import type { Found, OwnCheck, Explanation, ExplainFields } from '#cli/types/commands/explain.ts';

const TOOL_RULE_SOURCES: Record<string, (rule: string, path: string) => string | undefined> = {
    ruff: (rule, path) => {
        const result = runBlocking([path, 'rule', rule, '--output-format', 'json'], {
            cwd: process.cwd(),
            timeoutMs: TOOL_TIMEOUT_MS,
        });
        if (result.code !== 0) return undefined;
        try {
            const parsed = JSON.parse(result.stdout) as { name?: string; summary?: string };
            return [parsed.name, parsed.summary].filter((part) => part !== undefined && part !== '').join(': ');
        } catch {
            return undefined;
        }
    },
    swiftlint: (rule, path) => {
        const result = runBlocking([path, 'rules', rule], { cwd: process.cwd(), timeoutMs: TOOL_TIMEOUT_MS });
        return result.code === 0 ? result.stdout.split('\n').slice(0, SWIFTLINT_LINES).join('\n').trim() : undefined;
    },
};

function pinNamed(name: string | undefined): ToolPin | undefined {
    if (name === undefined) return undefined;
    return kitManifests()
        .values()
        .flatMap((manifest) => manifest.tools)
        .find((entry) => entry.name === name);
}

// The page a manifest declares for a rule: the tool's own page, or the page of the plugin whose prefix the rule carries.
function rulePage(check: CheckSpec, tool: string, rule: string): string | undefined {
    const slash = rule.lastIndexOf('/');
    if (slash === -1) {
        const pin = pinNamed(tool) ?? pinNamed(toolOf(check));
        return pin?.rule_page?.replace('{rule}', rule);
    }
    const prefix = rule.slice(0, slash).replace(/^@/u, '');
    const plugin = [prefix, `${tool}-plugin-${prefix}`, `@${prefix}/${tool}-plugin`]
        .map((name) => pinNamed(name))
        .find((pin) => pin !== undefined);
    return plugin?.rule_page?.replace('{rule}', rule.slice(slash + 1));
}

// The tool a check runs: the declared tool, or the first word of its command.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Four lookups name the tool of a check, which falls back to the first word of its command.
function toolOf(check: CheckSpec): string | undefined {
    return check.tool ?? check.command?.[0];
}

// The settings that change the check, and the guides and crash pattern it carries.
function checkFacts(check: CheckSpec, kit: Found['kit']): ExplainFields {
    const toolPrefix = `tools.${toolOf(check) ?? '~'}.`;
    const settings = (kit?.settings ?? [])
        .filter((setting) => setting.name === check.limit || setting.name.startsWith(toolPrefix))
        .map((setting) => setting.name);
    const rules = Object.values(kit?.guides ?? {})
        .flat()
        .map((entry) => entry.path);
    const crashPattern = check.crash_pattern ?? pinNamed(toolOf(check))?.crash_pattern;
    return { settings, rules, crashPattern };
}

// The lines about this repository: a [[check]] entry's command and paths, or whether the kit is selected.
function repositoryLines(session: Session | undefined, own: OwnCheck | undefined, kit: Found['kit']): string[] {
    const lines: string[] = [];
    if (own !== undefined)
        lines.push(
            `Command: ${own.command.map((part) => quoteArgument(part)).join(' ')}`,
            `Paths: ${own.paths.join(', ')}`,
        );
    if (session && kit !== undefined)
        lines.push(
            session.scopes.some((scope) => scope.selected.some((manifest) => manifest.kit.name === kit.kit.name))
                ? 'Selected in this repository: yes'
                : `Selected in this repository: no (gspot add ${kit.kit.name})`,
        );
    return lines;
}

function checkText(
    session: Session | undefined,
    checkName: string,
    found: Found,
    own: OwnCheck | undefined,
    fields: ExplainFields,
    owner: string,
): string {
    const { check, kit } = found;
    const { settings, rules, crashPattern } = fields;
    const lines = [
        `${checkName}  (${owner}, ${check.stage} stage, ${check.level} level)`,
        '',
        `What it looks for: ${check.summary}`,
        `Why it matters: ${check.why}`,
        `What to do: ${check.help}`,
        ...(check.waits_for === undefined ? [] : [`Required setting: ${check.waits_for}`]),
        '',
        `Turn it off for some paths: gspot ignore ${quoteArgument(checkName)} --paths "<glob>" --reason "..."`,
        ...(check.command
            ? [`Turn one of its rules off: gspot ignore ${quoteArgument(checkName)} --rule <rule> --reason "..."`]
            : []),
        ...(crashPattern === undefined ? [] : [`Fatal tool diagnostic pattern: ${crashPattern}`]),
        ...(check.isolated_files === true
            ? ['Runs with selected files and declared configuration in an isolated directory.']
            : []),
        ...(settings.length === 0 ? [] : [`Settings that change it: ${settings.join(', ')} (gspot set <key> <value>)`]),
        ...(rules.length === 0 ? [] : [`Guides that state it: ${rules.join(', ')}`]),
        ...repositoryLines(session, own, kit),
    ];
    return `${lines.join('\n')}\n`;
}

function buildCheckExplanation(
    session: Session | undefined,
    checkName: string,
    found: Found,
    own: OwnCheck | undefined,
    owner: string,
): Explanation {
    const { check, kit } = found;
    const fields = checkFacts(check, kit);
    return {
        kind: 'check',
        subject: checkName,
        text: checkText(session, checkName, found, own, fields, owner),
        data: {
            check: checkName,
            ...(kit === undefined ? { command: own?.command, paths: own?.paths } : { kit: kit.kit.name }),
            stage: check.stage,
            level: check.level,
            summary: check.summary,
            why: check.why,
            help: check.help,
            waits_for: check.waits_for,
            ...(fields.crashPattern === undefined ? {} : { crash_pattern: fields.crashPattern }),
            ...(check.isolated_files === undefined ? {} : { isolated_files: check.isolated_files }),
            ...(check.file_prefix === undefined ? {} : { file_prefix: check.file_prefix }),
            settings: fields.settings,
            rules: fields.rules,
        },
    };
}

function toolSummary(session: Session | undefined, tool: string, rule: string): string | undefined {
    const source = TOOL_RULE_SOURCES[tool];
    if (!source) return undefined;
    const pin = pinNamed(tool);
    const inspection = session && pin ? inspectTool(session, pin) : undefined;
    return source(rule, inspection?.path ?? tool);
}

// The nested explanation of what a tool rule means: the tool's own words, its page, or where to look.
function ruleMeaning(rule: string, summary: string | undefined, page: string | undefined): string {
    if (summary !== undefined) return `The tool says: ${summary}`;
    return page === undefined ? `The tool's documentation has the page for ${rule}.` : `The tool's page: ${page}`;
}

/**
 * Explains a check by name: a shipped check, or a [[check]] entry of the policy.
 * @param session the session, or undefined outside a repository
 * @param checkName the check
 * @returns the explanation, or undefined when no check has the name
 */
export function checkExplanation(session: Session | undefined, checkName: string): Explanation | undefined {
    const own = session?.policyFiles.policy.checks.find((entry) => entry.name === checkName);
    const found: Found | undefined =
        allChecks().get(checkName) ??
        (own === undefined ? undefined : { check: repositoryCheckSpec(own), kit: undefined });
    if (!found) return undefined;
    const owner = found.kit === undefined ? 'repository command' : `${found.kit.kit.name} kit`;
    return buildCheckExplanation(session, checkName, found, own, owner);
}

/**
 * Explains one rule of a tool: what the tool says about it, and how to turn it off or change its options.
 * @param session the session, or undefined outside a repository
 * @param tool the tool
 * @param rule the rule
 * @returns the explanation, or undefined when no check runs the tool
 */
export function toolRuleExplanation(session: Session | undefined, tool: string, rule: string): Explanation | undefined {
    const check = allChecks()
        .values()
        .find(({ check: spec }) => (toolOf(spec) ?? '~') === tool || spec.name.endsWith(`/${tool}`))?.check;
    if (!check) return undefined;
    const summary = toolSummary(session, tool, rule);
    const page = rulePage(check, tool, rule);
    const optionKey = quoteArgument(`tools.${tool}.rules.${rule}`);
    const lines = [
        `${tool}/${rule}  (run by ${check.name})`,
        '',
        ruleMeaning(rule, summary, page),
        '',
        `Turn it off everywhere: gspot ignore ${quoteArgument(check.name)} --rule ${quoteArgument(rule)} --reason "..."`,
        `Turn it off for some paths: gspot ignore ${quoteArgument(check.name)} --rule ${quoteArgument(rule)} --paths "<glob>" --reason "..."`,
        `Change its options: gspot set ${optionKey} <options> --reason "..."`,
    ];
    return {
        kind: 'tool-rule',
        subject: `${tool}/${rule}`,
        text: `${lines.join('\n')}\n`,
        data: { tool, rule, check: check.name, summary: summary ?? null, page: page ?? null },
    };
}
