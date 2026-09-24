import { z } from 'zod';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { run } from '#cli/platform/spawn.ts';
import { toPosix } from '#cli/platform/paths.ts';
import type { Finding } from '#cli/output/schema.ts';
import { routeGroups } from '#cli/prose/grammars.ts';
import { locateTool } from '#cli/tools/tool-probe.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import type { MergedView } from '#cli/policy/merge.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import { fileBatches } from '#cli/run/file-batches.ts';
import { readSource } from '#cli/repository/tracked.ts';
import type { GeneratedFile } from '#cli/emit/targets.ts';
// Vale, driven by gspot: the style files rendered from the limits, the packages synced at setup, every alert a finding.
import type { SpawnResult } from '#cli/platform/spawn.ts';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { listAssets, readAsset } from '#cli/platform/assets.ts';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { isValePackageFile } from '#cli/repository/file-classification.ts';
import { readOwnership, withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { GSPOT_STYLE, LENGTH_RULES, STYLES_DIRECTORY, VALE_STDIN } from '#cli/prose/syntax.ts';

const STYLE_ASSETS = 'packages/cli/configurations/policy/prose/styles/gspot/';

const VALE_CONFIG = '.gspot/config/vale.ini';

const MAX_LINE = /^max: \d+$/mu;
const LONGER_THAN = /longer than \d+/u;
const alertsSchema = z.record(
    z.string().min(1),
    z.array(
        z.object({
            Line: z.number().int().positive(),
            Span: z.tuple([z.number().int().positive(), z.number().int().positive()]),
            Check: z.string().min(1),
            Message: z.string().min(1),
        }),
    ),
);

function renderedRule(stem: string, text: string, view: MergedView): string {
    const key = LENGTH_RULES[stem];
    const limit = key === undefined ? undefined : view.limit(key);
    if (limit === undefined) return text;
    return text
        .replace(MAX_LINE, () => `max: ${String(limit)}`)
        .replace(LONGER_THAN, () => `longer than ${String(limit)}`);
}

// Vale runs with --no-exit, so alerts leave the exit code at 0; any other code means Vale itself failed, and that is never a pass.
function assertValeRan(result: SpawnResult): void {
    if (result.code === 0 && !result.missing) return;
    const lines = `${result.stderr}\n${result.stdout}`.split('\n').filter((line) => line.trim() !== '');
    const reason = lines.find((line) => /(?:^E\d+)|(?:not found)|(?:error)/iu.test(line)) ?? lines[0] ?? 'no output';
    throw new Error(`Vale did not run (exit ${String(result.code)}): ${reason.trim()}`);
}

async function alertsFor(input: EngineInput, group: ProseRoute[]): Promise<ValeAlert[]> {
    const [first] = group;
    if (first === undefined) return [];
    const root = input.root;
    const base = ['vale', '--config', join(root, VALE_CONFIG), '--output', 'JSON', '--no-exit'];
    if (first.mode === 'path') {
        const alerts: ValeAlert[] = [];
        for (const batch of fileBatches(
            group.map((route) => route.path),
            base,
            process.platform,
        )) {
            const result = await runCheckCommand(input, [...base, ...batch], { cwd: root });
            assertValeRan(result);
            alerts.push(...parseAlerts(result.stdout));
        }
        return alerts.map((alert) => ({
            ...alert,
            file: toPosix(isAbsolute(alert.file) ? relative(root, alert.file) : alert.file),
        }));
    }
    const text = readSource(root, first.path).toString('utf8');
    const result = await runCheckCommand(input, [...base, `--ext=${first.extension}`], { cwd: root, stdin: text });
    assertValeRan(result);
    return parseAlerts(result.stdout).map((alert) => ({
        ...alert,
        file: alert.file.startsWith(VALE_STDIN) ? first.path : alert.file,
    }));
}

/** Names of the bundled Vale styles, shared by configuration and asset generation. */
export function styleNames(): string[] {
    return listAssets(STYLE_ASSETS).map((asset) => asset.slice(STYLE_ASSETS.length).replace(/\.yml$/u, ''));
}

/**
 * The style and vocabulary files apply writes under .gspot/config/vale/styles.
 * @param policy the repository policy
 * @param view the root scope's merged view, for the docs limits
 * @returns the generated files
 */
export function styleFiles(policy: Policy, view: MergedView): GeneratedFile[] {
    const rules = styleNames().map((stem): GeneratedFile => {
        const name = `${stem}.yml`;
        const asset = `${STYLE_ASSETS}${name}`;
        return {
            path: `${STYLES_DIRECTORY}/${GSPOT_STYLE}/${name}`,
            content: renderedRule(stem, readAsset(asset), view),
            readOnly: true,
            kind: 'config',
            configuration: 'prose',
        };
    });
    const shipped = readAsset('packages/cli/configurations/policy/prose/vocabularies/gspot/accept.txt')
        .trim()
        .split(/\r?\n/u);
    const vocabulary = [...new Set([...shipped, ...policy.prose.vocabulary])].toSorted((a, b) => a.localeCompare(b));
    const base = `${STYLES_DIRECTORY}/config/vocabularies/${GSPOT_STYLE}`;
    return [
        ...rules,
        {
            path: `${base}/accept.txt`,
            content: `${vocabulary.join('\n')}\n`,
            readOnly: true,
            kind: 'config',
            configuration: 'prose',
        },
    ];
}

/**
 * True when every upstream package is present under the styles directory.
 * @param root the repository root
 * @param requireOwnership require matching recorded package bytes and modes for setup
 * @returns whether vale sync has run
 */
export function hasPackages(root: string, requireOwnership = false): boolean {
    const files = openConfinedRoot(root);
    try {
        const source = files.read(VALE_CONFIG);
        if (source === undefined) return false;
        const configured = /^Packages = (.*)$/mu.exec(source.bytes.toString('utf8'))?.[1] ?? '';
        const packages = configured
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name !== '')
            .map((name) => basename(/^https?:\/\//u.test(name) ? new URL(name).pathname : name).replace(/\.zip$/u, ''));
        // Harper requires the dictionaries installed beside its styles.
        const needed = [...packages, ...(packages.includes('Harper') ? ['config/dictionaries'] : [])];
        if (!needed.every((name) => files.stat(`${STYLES_DIRECTORY}/${name}`)?.isDirectory())) return false;
        if (!requireOwnership || packages.length === 0) return true;
        const selected = (path: string) =>
            isValePackageFile(path) && needed.some((name) => path.startsWith(`${STYLES_DIRECTORY}/${name}/`));
        const recorded = new Map(
            readOwnership(root)
                .files.filter((entry) => selected(entry.path))
                .map((entry) => [entry.path, entry.installed]),
        );
        const installed: string[] = [];
        const visit = (directory: string): void => {
            for (const name of files.list(directory)) {
                const path = `${directory}/${name}`;
                if (files.stat(path)?.isDirectory()) visit(path);
                else if (selected(path)) installed.push(path);
            }
        };
        for (const name of needed) visit(`${STYLES_DIRECTORY}/${name}`);
        return (
            needed.every((name) => installed.some((path) => path.startsWith(`${STYLES_DIRECTORY}/${name}/`))) &&
            [...new Set([...installed, ...recorded.keys()])].every((path) => {
                const content = files.read(path);
                const identity = recorded.get(path);
                return (
                    content !== undefined &&
                    identity !== undefined &&
                    content.mode === identity.mode &&
                    createHash('sha256').update(content.bytes).digest('hex') === identity.hash
                );
            })
        );
    } finally {
        files.close();
    }
}

/**
 * Downloads the upstream packages the config names. Needs the network; runs at setup.
 * @param root the repository root
 * @returns what went wrong, or undefined when the packages are in place
 */
export async function installPackages(root: string): Promise<string | undefined> {
    const binary = locateTool(root, 'vale');
    if (binary === undefined) return 'vale is not installed';
    return withLifecycleOwner(root, async (owner) => {
        const work = mkdtempSync(join(tmpdir(), 'gspot-vale-'));
        try {
            const inputs = [
                VALE_CONFIG,
                ...owner
                    .installedPaths()
                    .filter((path) => path.startsWith(`${STYLES_DIRECTORY}/`) && !isValePackageFile(path)),
            ];
            for (const path of inputs) {
                const content = owner.read(path);
                if (content === undefined) throw new Error(`Vale setup input is missing: ${path}`);
                mkdirSync(dirname(join(work, path)), { recursive: true });
                writeFileSync(join(work, path), content.bytes, { mode: 0o600 });
            }
            const result = await run([binary, '--config', join(work, VALE_CONFIG), 'sync'], { cwd: work });
            if (result.code !== 0) return result.stderr.trim() || result.stdout.trim();
            const staged = openConfinedRoot(work);
            try {
                if (staged.stat(STYLES_DIRECTORY)?.isDirectory() !== true)
                    throw new Error('Vale did not produce a styles directory.');
                const outputs = readdirSync(join(work, STYLES_DIRECTORY), { recursive: true, withFileTypes: true })
                    .filter((entry) => !entry.isDirectory())
                    .map((entry) => {
                        const path = toPosix(relative(work, join(entry.parentPath, entry.name)));
                        const content = staged.read(path);
                        if (content === undefined) throw new Error(`Vale setup output disappeared: ${path}`);
                        return { path, content };
                    })
                    .filter((entry) => isValePackageFile(entry.path));
                const proposals = outputs.map((output) => {
                    const current = owner.read(output.path);
                    const mode = current?.bytes.equals(output.content.bytes) === true ? current.mode : 0o444;
                    return owner.proposeReplacement(output.path, { bytes: output.content.bytes, mode }, 'config');
                });
                const retained = new Set(outputs.map((output) => output.path));
                proposals.push(
                    ...owner
                        .installedPaths()
                        .filter((path) => isValePackageFile(path) && !retained.has(path))
                        .map((path) => owner.proposeRestoration(path)),
                );
                const conflict = proposals.find((proposal) => proposal.status === 'preserved');
                if (conflict !== undefined) return `preserved edited or unowned ${conflict.path}`;
                owner.applyProposals(proposals);
            } finally {
                staged.close();
            }
            return undefined;
        } finally {
            rmSync(work, { recursive: true, force: true });
        }
    });
}

/**
 * Validates native Vale JSON before converting alerts to source locations.
 * @param stdout the output
 * @returns the alerts
 */
export function parseAlerts(stdout: string): ValeAlert[] {
    return Object.entries(alertsSchema.parse(JSON.parse(stdout))).flatMap(([file, alerts]) =>
        alerts.map((alert) => ({
            file: toPosix(file),
            line: alert.Line,
            column: alert.Span[0],
            check: alert.Check,
            message: alert.Message,
        })),
    );
}

/**
 * Runs Vale over the scope's files, by path where Vale has a grammar and through stdin elsewhere. Every alert is a finding.
 * @param input the engine input
 * @returns the findings
 */
export async function valeFindings(input: EngineInput): Promise<Finding[]> {
    if (!hasPackages(input.root))
        throw new Error('The Vale packages are not synced; run gspot apply with the network on.');
    const groups = routeGroups(input.files.filter((file) => file.nature === 'source'));
    const findings: Finding[] = [];
    for (const group of groups) {
        const alerts = await alertsFor(input, group);
        findings.push(
            ...alerts.map((alert) => ({
                check: input.spec.name,
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

// Type aliases of the prose engine.

/** How one file reaches Vale. */
export type ProseRoute = { path: string; mode: 'path' | 'stdin'; extension: string };

/** One Vale alert, parsed. */
export type ValeAlert = { file: string; line: number; column: number; check: string; message: string };
