// Explain a check, or one rule of the tool a check runs.
import { probeTool } from '#cli/tools/probe.ts';
import { runBlocking } from '#cli/platform/spawn.ts';
import type { Session } from '#cli/execution/session.ts';
import { allChecks } from '#cli/configurations/listing.ts';
import { quoteArgument } from '#cli/platform/arguments.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import { repositoryCheckSpec } from '#cli/policy/check-state.ts';
import type { Explanation } from '#cli/commands/explain/subjects.ts';
import type { Manifest, ToolPin } from '#cli/configurations/manifests.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

type Found = { check: CheckSpec; configuration: Manifest | undefined };
type OwnCheck = Session['policyFiles']['policy']['checks'][number];
type Facts = { settings: string[]; rules: string[]; crashPattern: string | undefined };

const TOOL_TIMEOUT_MS = 10_000;
const SWIFTLINT_LINES = 6;

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
    return configurationManifests()
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

function isSelected(session: Session, configurationName: string): boolean {
    return session.scopes.some((scope) =>
        scope.selected.some((manifest) => manifest.configuration.name === configurationName),
    );
}

// The tool a check runs: the declared tool, or the first word of its command.
function toolOf(check: CheckSpec): string | undefined {
    return check.tool ?? check.command?.[0];
}

// The settings that change the check, and the rule files and crash pattern it carries.
function checkFacts(check: CheckSpec, configuration: Found['configuration']): Facts {
    const toolPrefix = `tools.${toolOf(check) ?? '~'}.`;
    const settings = (configuration?.settings ?? [])
        .filter((setting) => setting.name === check.limit || setting.name.startsWith(toolPrefix))
        .map((setting) => setting.name);
    const rules = Object.values(configuration?.rule_files ?? {}).flat();
    const crashPattern = check.tool_errors ?? pinNamed(toolOf(check))?.crash_pattern;
    return { settings, rules, crashPattern };
}

// The lines that say what the check does and how to turn it off.
function checkHeader(checkName: string, check: CheckSpec, owner: string): string[] {
    return [
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
    ];
}

// The lines that state the check's declared facts, each only when the check declares it.
function factLines(check: CheckSpec, facts: Facts): string[] {
    const { settings, rules, crashPattern } = facts;
    return [
        ...(check.fix_findings_exit_codes === undefined
            ? []
            : [`Correction exit codes that mean findings remain: ${check.fix_findings_exit_codes.join(', ')}`]),
        ...(crashPattern === undefined ? [] : [`Fatal tool diagnostic pattern: ${crashPattern}`]),
        ...(check.isolated_files === true
            ? ['Runs with selected files and declared configuration in an isolated directory.']
            : []),
        ...(settings.length === 0 ? [] : [`Settings that change it: ${settings.join(', ')} (gspot set <key> <value>)`]),
        ...(rules.length === 0 ? [] : [`Rule files that state it: ${rules.join(', ')}`]),
    ];
}

// The lines about this repository: a [[check]] entry's command and paths, or whether the configuration is selected.
function repositoryLines(
    session: Session | undefined,
    own: OwnCheck | undefined,
    configuration: Found['configuration'],
): string[] {
    const lines: string[] = [];
    if (own !== undefined)
        lines.push(
            `Command: ${own.command.map((part) => quoteArgument(part)).join(' ')}`,
            `Paths: ${own.paths.join(', ')}`,
        );
    if (session && configuration !== undefined)
        lines.push(
            isSelected(session, configuration.configuration.name)
                ? 'Selected in this repository: yes'
                : `Selected in this repository: no (gspot add ${configuration.configuration.name})`,
        );
    return lines;
}

// The explanation's data: what the text says, as fields.
function checkData(checkName: string, found: Found, own: OwnCheck | undefined, facts: Facts): Record<string, unknown> {
    const { check, configuration } = found;
    return {
        check: checkName,
        ...(configuration === undefined
            ? { command: own?.command, paths: own?.paths }
            : { configuration: configuration.configuration.name }),
        stage: check.stage,
        level: check.level,
        summary: check.summary,
        why: check.why,
        help: check.help,
        waits_for: check.waits_for,
        ...(check.fix_findings_exit_codes === undefined
            ? {}
            : { fix_findings_exit_codes: check.fix_findings_exit_codes }),
        ...(facts.crashPattern === undefined ? {} : { tool_errors: facts.crashPattern }),
        ...(check.isolated_files === undefined ? {} : { isolated_files: check.isolated_files }),
        ...(check.file_prefix === undefined ? {} : { file_prefix: check.file_prefix }),
        settings: facts.settings,
        rules: facts.rules,
    };
}

function toolSummary(session: Session | undefined, tool: string, rule: string): string | undefined {
    const source = TOOL_RULE_SOURCES[tool];
    if (!source) return undefined;
    const pin = pinNamed(tool);
    const probe = session && pin ? probeTool(session, pin) : undefined;
    return source(rule, probe?.path ?? tool);
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
        (own === undefined ? undefined : { check: repositoryCheckSpec(own), configuration: undefined });
    if (!found) return undefined;
    const { check, configuration } = found;
    const facts = checkFacts(check, configuration);
    const owner =
        configuration === undefined ? 'repository command' : `${configuration.configuration.name} configuration`;
    const lines = [
        ...checkHeader(checkName, check, owner),
        ...factLines(check, facts),
        ...repositoryLines(session, own, configuration),
    ];
    return {
        kind: 'check',
        subject: checkName,
        text: `${lines.join('\n')}\n`,
        data: checkData(checkName, found, own, facts),
    };
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
