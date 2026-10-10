import picomatch from 'picomatch';
import { join, posix } from 'node:path';
import type { Scalar, Document } from 'yaml';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { copyIntoScratch } from '#cli/execution/copy/public.ts';
import { parseDirectives } from '#cli/parsers/tool/contracts.ts';
import type { Mount, NginxMounts } from '#cli/types/checks/nginx.ts';
import { isMap, isSeq, isAlias, isScalar, parseDocument } from 'yaml';
import { toolOutputDetail } from '#cli/execution/command/contracts.ts';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { ACTIONLINT_COMMAND } from '#cli/config/checks/tool/github-actions.ts';
import { runCheckTool, runCheckCommand } from '#cli/execution/command/public.ts';
import type { CheckInput, CheckResult, CheckOutcome } from '#cli/types/execution/check.ts';
import { NGINX_MAIN, LOCAL_NAMES, HOST_PATTERNS, CERTIFICATE_ARGUMENTS } from '#cli/config/checks/tool/nginx.ts';

function stepReferences(steps: unknown): unknown[] {
    if (!isSeq(steps)) return [];
    const mappings = steps.items.filter(isMap);
    return mappings.map((step) => step.get('uses', true));
}

function workflowReferences(document: Document): unknown[] {
    const references: unknown[] = [];
    const jobs = document.get('jobs', true);
    if (isMap(jobs)) {
        for (const { value: job } of jobs.items) {
            if (!isMap(job)) continue;
            references.push(job.get('uses', true), ...stepReferences(job.get('steps', true)));
        }
    }
    references.push(...stepReferences(document.getIn(['runs', 'steps'], true)));
    return references;
}

// Change only the self-repository marker. Later dollar signs belong to the referenced path.
function replaceReference(text: string, reference: Scalar): string {
    const token = reference.srcToken;
    if (token === undefined || !('source' in token)) return text;
    const start =
        token.type === 'block-scalar'
            ? Math.max(
                  token.offset,
                  ...token.props.map((part) => ('source' in part ? part.offset + part.source.length : token.offset)),
              )
            : token.offset;
    const source = token.source;
    const replaced = source.replace(/\$|\\x24|\\u0024|\\U00000024/u, (value) =>
        value === '$' ? '.' : value.replace(/24$/u, '2e'),
    );
    return text.slice(0, start) + replaced + text.slice(start + source.length);
}

// Include paths use the main configuration directory, matching nginx prefix semantics.
function includedFiles(input: CheckInput, text: string, base: string): Pick<Mount, 'path' | 'target'>[] {
    const included: Pick<Mount, 'path' | 'target'>[] = [];
    for (const [name, value] of parseDirectives(text)) {
        if (name !== 'include' || value === undefined || value.includes('$')) continue;
        const target = posix.resolve('/etc/nginx', value);
        const isIncluded = picomatch(posix.normalize(posix.join(base, posix.relative('/etc/nginx', target))));
        for (const file of input.files.filter((candidate) => isIncluded(candidate.path)))
            included.push({ path: file.path, target: posix.resolve('/etc/nginx', posix.relative(base, file.path)) });
    }
    return included;
}

function copyConfigurations(input: CheckInput, path: string, work: string): Map<string, Mount> {
    const directory = mkdtempSync(join(work, 'configuration-'));
    const configurations = new Map<string, Mount>();
    const pending = [{ path, target: '/etc/nginx/nginx.conf' }];
    const base = posix.dirname(path);
    for (const entry of pending) {
        if (configurations.has(entry.target)) continue;
        const source = join(directory, `${String(configurations.size)}.conf`);
        const bytes = readSource(input.root, entry.path, input.reads);
        writeFileSync(source, bytes);
        const text = bytes.toString('utf8');
        configurations.set(entry.target, { ...entry, source, text });
        pending.push(...includedFiles(input, text, base));
    }
    return configurations;
}

function syntaxOutcome(
    check: string,
    path: string,
    configurations: Map<string, Mount>,
    diagnostic: string,
): CheckOutcome {
    const location = / in (?<file>\/[^\n]+):(?<line>\d+)\s*$/u.exec(diagnostic)?.groups;
    const { file: target = '', line = '1' } = location === undefined ? {} : location;
    const file = configurations.get(target)?.path ?? path;
    return {
        findings: [{ check, file, line: Number(line), rule: 'syntax', message: diagnostic, fixable: false }],
        files: configurations.has(target) ? [file] : [],
    };
}

async function testConfiguration(input: CheckInput, path: string, work: string, image: string): Promise<CheckOutcome> {
    const configurations = copyConfigurations(input, path, work);
    const mounts = {
        configs: [...configurations.values()],
        certificate: join(work, 'certificate.pem'),
        key: join(work, 'key.pem'),
    };
    const argv = testArguments([...configurations.values()].map((entry) => entry.text).join('\n'), mounts, image);
    const result = await runCheckTool(input, ['docker', ...argv], { cwd: input.root });
    if (result.code === 0) {
        const parsed = [...result.stdout.matchAll(/^# configuration file (?<path>[^\n]+):\r?$/gmu)]
            .map((match) => match.groups?.['path'])
            .filter((path) => path !== undefined);
        if (!parsed.includes('/etc/nginx/nginx.conf'))
            throw new Error('The nginx run produced no configuration dump confirming the tested source.');
        return {
            findings: [],
            files: parsed.flatMap((target) => {
                const configuration = configurations.get(target);
                return configuration === undefined ? [] : [configuration.path];
            }),
        };
    }
    const diagnostic = result.stderr.split('\n').find((line) => line.includes('[emerg]'));
    if (result.code !== 1 || diagnostic === undefined)
        throw new Error(`The nginx run failed (exit ${String(result.code)}): ${result.stderr.trim()}`);
    return syntaxOutcome(input.check.name, path, configurations, diagnostic);
}

/**
 * Converts self-repository references to local paths for the pinned actionlint parser, preserving offsets.
 * @param text a workflow or action file
 * @returns the text with each self-repository marker of a reference turned into a local path, at the same offsets
 */
export function actionlintSource(text: string): string {
    const document = parseDocument(text, { keepSourceTokens: true });
    if (document.errors.length > 0 || !isMap(document.contents)) return text;
    let prepared = text;
    for (const value of workflowReferences(document)) {
        const reference = isAlias(value) ? value.resolve(document) : value;
        if (!isScalar(reference) || typeof reference.value !== 'string' || !reference.value.startsWith('$/')) continue;
        prepared = replaceReference(prepared, reference);
    }
    return prepared;
}

/**
 * Runs actionlint. If a workflow or action uses a $/ reference, checks a temporary copy with that reference changed to ./.
 * @param session the open session
 * @param planned the planned check
 * @returns the check result
 */
export async function actionlint(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const replacements = new Map<string, string>();
    for (const file of session.repository.files) {
        if (!/\.ya?ml$/u.test(file.path)) continue;
        const source = readSource(session.root, file.path, session.reads).toString('utf8');
        const prepared = actionlintSource(source);
        if (prepared !== source) replacements.set(file.path, prepared);
    }
    if (replacements.size === 0) return runCheckCommand(session, planned, { command: ACTIONLINT_COMMAND });
    using workspace = await copyIntoScratch({
        root: session.root,
        paths: session.repository.files.map((file) => file.path),
        dependencies: [],
    });
    // Actionlint discovers local reusable workflows only inside a Git project.
    mkdirSync(join(workspace.path, '.git'));
    for (const [path, source] of replacements) {
        const target = join(workspace.path, path);
        chmodSync(target, PRIVATE_FILE);
        writeFileSync(target, source);
    }
    return await runCheckCommand(session, planned, { command: ACTIONLINT_COMMAND, workspace: workspace.path });
}

/**
 * Tests every tracked nginx.conf with the server's own parser.
 * @param input the check input
 * @returns one finding for each file nginx refuses
 */
export async function nginxTest(input: CheckInput): Promise<CheckOutcome> {
    const image = input.view.options('tools.nginx')['image'];
    const paths = input.files
        .map((file) => file.path)
        .filter((path) => path === NGINX_MAIN || path.endsWith(`/${NGINX_MAIN}`));
    if (paths.length === 0) return { findings: [], files: [] };
    using workFolder = scratchFolder('gspot-nginx-');
    const work = workFolder.path;
    const certificate = await runCheckTool(
        input,
        ['openssl', ...CERTIFICATE_ARGUMENTS, '-keyout', join(work, 'key.pem'), '-out', join(work, 'certificate.pem')],
        { cwd: work },
    );
    if (certificate.code !== 0)
        throw new Error(
            `The openssl command could not write the temporary certificate: ${toolOutputDetail(certificate, 'The tool printed no diagnostic.')}`,
        );
    const findings: Finding[] = [];
    const checked = new Set<string>();
    for (const path of paths) {
        const outcome = await testConfiguration(input, path, work, image);
        findings.push(...outcome.findings);
        for (const file of outcome.files) checked.add(file);
    }
    return { findings, files: [...checked] };
}

/**
 * Docker arguments that run nginx -t over one tool file.
 * @param text the tool file text.
 * @param mounts the host paths: the tool file, certificate, and key.
 * @param mounts.configs the captured tool files and container paths.
 * @param mounts.certificate the throwaway certificate.
 * @param mounts.key the throwaway key.
 * @param image the nginx image.
 * @returns the argv after docker.
 */
export function testArguments(text: string, mounts: NginxMounts, image: string): string[] {
    const parsed = parseDirectives(text);
    const hosts = new Set(
        parsed.flatMap(([name, value]) => {
            if (value === undefined || value.includes('$')) return [];
            const host = HOST_PATTERNS.get(name)?.exec(value)?.[1];
            return host === undefined || LOCAL_NAMES.has(host) ? [] : [host];
        }),
    );
    const certificates = new Map([
        ['ssl_certificate_key', mounts.key],
        ['ssl_certificate', mounts.certificate],
        ['ssl_trusted_certificate', mounts.certificate],
    ]);
    const volumes = [
        ...mounts.configs.map(({ source, target }) => `${source}:${target}:ro`),
        ...parsed.flatMap(([name, path]) => {
            if (path === undefined || path.includes('$')) return [];
            const source = certificates.get(name);
            return source === undefined ? [] : [`${source}:${posix.resolve('/etc/nginx', path)}:ro`];
        }),
    ];
    return [
        'run',
        '--rm',
        ...[...hosts].flatMap((host) => ['--add-host', `${host}:127.0.0.1`]),
        ...[...new Set(volumes)].flatMap((volume) => ['-v', volume]),
        image,
        'nginx',
        '-T',
    ];
}
