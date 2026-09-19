// The crate graph checks of a Rust scope: RustSec advisories, and the licenses, bans, and sources cargo-deny reads.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import type { AuditReport, DenyLine } from '#types/cargo.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';

const LOCKFILE = 'Cargo.lock';
const MANIFEST = 'Cargo.toml';
const COMMAND_TIMEOUT_MS = 900_000;

function inScope(input: EngineInput, path: string): string {
    return input.scope === '' ? path : `${input.scope}/${path}`;
}

function lastLine(text: string): string {
    return text.trim().split('\n').at(-1) ?? '';
}

function denyLine(line: string): DenyLine | undefined {
    if (!line.startsWith('{')) return undefined;
    try {
        return JSON.parse(line) as DenyLine;
    } catch {
        return undefined;
    }
}

/**
 * One finding for each advisory that names a crate version in Cargo.lock.
 * @param input the engine input
 * @returns the findings
 */
export async function rustAdvisories(input: EngineInput): Promise<Finding[]> {
    const cwd = join(input.root, input.scope);
    if (!existsSync(join(cwd, LOCKFILE))) return [];
    const result = await run(['cargo', 'audit', '--json'], { cwd, timeoutMs: COMMAND_TIMEOUT_MS });
    if (result.missing) throw new MissingToolError('The cargo command is not installed.');
    if (result.stderr.includes('no such command'))
        throw new MissingToolError('The cargo-audit command is not installed.');
    if (!result.stdout.trimStart().startsWith('{'))
        throw new Error(`The cargo audit command failed: ${lastLine(result.stderr)}`);
    const report = JSON.parse(result.stdout) as AuditReport;
    return report.vulnerabilities.list.map((entry) => {
        const patched = entry.versions.patched.join(', ');
        const remedy = patched === '' ? 'No patched version exists yet.' : `Patched in ${patched}.`;
        return {
            check: input.spec.id,
            file: inScope(input, LOCKFILE),
            line: 1,
            rule: entry.advisory.id,
            message: `${entry.package.name} ${entry.package.version}: ${entry.advisory.title}. ${remedy}`,
            fixable: false,
        };
    });
}

/**
 * One finding for each error cargo-deny reports about licenses, banned crates, and registries.
 * @param input the engine input
 * @returns the findings
 */
export async function rustCratePolicy(input: EngineInput): Promise<Finding[]> {
    const cwd = join(input.root, input.scope);
    if (!existsSync(join(cwd, MANIFEST))) return [];
    const settings = join(input.root, '.gspot', 'deny.toml');
    const command = ['cargo', 'deny', '--format', 'json', '--config', settings, 'check', 'licenses', 'bans', 'sources'];
    const result = await run(command, { cwd, timeoutMs: COMMAND_TIMEOUT_MS });
    if (result.missing) throw new MissingToolError('The cargo command is not installed.');
    if (result.stderr.includes('no such command'))
        throw new MissingToolError('The cargo-deny command is not installed.');
    const told = `${result.stdout}\n${result.stderr}`.split('\n').flatMap((line) => {
        const entry = denyLine(line);
        return entry?.type === 'diagnostic' && entry.fields.severity === 'error' ? [entry.fields] : [];
    });
    if (result.code !== 0 && told.length === 0)
        throw new Error(`The cargo deny command failed: ${lastLine(result.stderr)}`);
    return told.map((fields) => ({
        check: input.spec.id,
        file: inScope(input, MANIFEST),
        line: 1,
        rule: fields.code ?? 'policy',
        message: fields.message,
        fixable: false,
    }));
}
