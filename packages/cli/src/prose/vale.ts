// Vale, driven by gspot: the style files rendered from the limits, the packages synced at setup, every alert a finding.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { existsSync, readFileSync } from 'node:fs';
import { locateTool } from '#cli/doctor/probes.ts';
import type { GeneratedFile } from '#types/emit.ts';
import { routeGroups } from '#cli/prose/grammars.ts';
import type { MergedView, Policy } from '#types/config.ts';
import type { ProseRoute, ValeAlert } from '#types/prose.ts';
import { listAssets, readAsset } from '#cli/platform/assets.ts';
import { vocabularyFor, vocabularyText } from '#cli/prose/vocabulary.ts';
import { GSPOT_STYLE, LENGTH_RULES, STYLES_DIRECTORY, VALE_LINE, VALE_PACKAGES, VALE_STDIN } from '#config/prose.ts';

const STYLE_ASSETS = 'prose/styles/gspot/';

const VALE_CONFIG = '.gspot/vale.ini';

const MAX_LINE = /^max: \d+$/mu;
const LONGER_THAN = /longer than \d+/u;

function renderedRule(stem: string, text: string, view: MergedView): string {
    const key = LENGTH_RULES[stem];
    const limit = key === undefined ? undefined : view.limit(key);
    if (limit === undefined) return text;
    return text
        .replace(MAX_LINE, () => `max: ${String(limit)}`)
        .replace(LONGER_THAN, () => `longer than ${String(limit)}`);
}

async function alertsFor(root: string, binary: string, group: ProseRoute[]): Promise<ValeAlert[]> {
    const [first] = group;
    if (first === undefined) return [];
    const base = [binary, '--config', join(root, VALE_CONFIG), '--output', 'line', '--no-exit'];
    if (first.mode === 'path') {
        const result = await run([...base, ...group.map((route) => route.path)], { cwd: root });
        return parseAlerts(result.stdout).map((alert) => ({
            ...alert,
            file: alert.file.startsWith(root) ? alert.file.slice(root.length + 1) : alert.file,
        }));
    }
    const text = readFileSync(join(root, first.path), 'utf8');
    const result = await run([...base, `--ext=${first.extension}`], { cwd: root, stdin: text });
    return parseAlerts(result.stdout).map((alert) => ({
        ...alert,
        file: alert.file.startsWith(VALE_STDIN) ? first.path : alert.file,
    }));
}

/**
 * The style and vocabulary files apply writes under .gspot/vale/styles.
 * @param policy the repository policy
 * @param view the root scope's merged view, for the docs limits
 * @returns the generated files
 */
export function styleFiles(policy: Policy, view: MergedView): GeneratedFile[] {
    const rules = listAssets(STYLE_ASSETS).map((asset): GeneratedFile => {
        const name = asset.slice(STYLE_ASSETS.length);
        const stem = name.replace(/\.yml$/u, '');
        return {
            path: `${STYLES_DIRECTORY}/${GSPOT_STYLE}/${name}`,
            content: renderedRule(stem, readAsset(asset), view),
            readOnly: true,
            kind: 'config',
            preset: 'prose',
        };
    });
    const vocabulary = vocabularyFor(policy);
    const base = `${STYLES_DIRECTORY}/config/vocabularies/${GSPOT_STYLE}`;
    return [
        ...rules,
        {
            path: `${base}/accept.txt`,
            content: vocabularyText(vocabulary.accept),
            readOnly: true,
            kind: 'config',
            preset: 'prose',
        },
    ];
}

/**
 * True when every upstream package is present under the styles directory.
 * @param root the repository root
 * @returns whether vale sync has run
 */
export function hasPackages(root: string): boolean {
    return VALE_PACKAGES.every((name) => existsSync(join(root, STYLES_DIRECTORY, name)));
}

/**
 * Downloads the upstream packages the config names. Needs the network; runs at setup.
 * @param root the repository root
 * @returns what went wrong, or undefined when the packages are in place
 */
export async function installPackages(root: string): Promise<string | undefined> {
    const binary = locateTool(root, 'vale');
    if (binary === undefined) return 'vale is not installed';
    const result = await run([binary, '--config', join(root, VALE_CONFIG), 'sync'], { cwd: root });
    return result.code === 0 ? undefined : result.stderr.trim() || result.stdout.trim();
}

/**
 * Parses the Vale line output.
 * @param stdout the output
 * @returns the alerts
 */
export function parseAlerts(stdout: string): ValeAlert[] {
    return stdout.split('\n').flatMap((line) => {
        const groups = VALE_LINE.exec(line)?.groups;
        if (groups === undefined) return [];
        return [
            {
                file: groups['file'] ?? '',
                line: Number(groups['line']),
                column: Number(groups['column']),
                check: groups['check'] ?? '',
                message: groups['message'] ?? '',
            },
        ];
    });
}

/**
 * Runs Vale over the scope's files, by path where Vale has a grammar and through stdin elsewhere. Every alert is a finding.
 * @param input the engine input
 * @returns the findings
 */
export async function valeFindings(input: EngineInput): Promise<Finding[]> {
    const binary = locateTool(input.root, 'vale');
    if (binary === undefined) throw new Error('Vale is not installed; run mise install.');
    if (!hasPackages(input.root))
        throw new Error('The Vale packages are not synced; run gspot apply with the network on.');
    const groups = routeGroups(input.files.filter((file) => file.nature === 'source'));
    const findings: Finding[] = [];
    for (const group of groups) {
        const alerts = await alertsFor(input.root, binary, group);
        findings.push(
            ...alerts.map((alert) => ({
                check: input.spec.id,
                file: alert.file,
                line: alert.line,
                column: alert.column,
                rule: alert.check,
                message: alert.message,
                fixable: false,
            })),
        );
    }
    return findings;
}
