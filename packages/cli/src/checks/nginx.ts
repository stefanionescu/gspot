import picomatch from 'picomatch';
import { join, posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { parseNginxDirectives } from '#cli/parsers/nginx.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import type { Mount, NginxMounts } from '#cli/types/checks/nginx.ts';
import { type Finding, type CheckInput, type BuiltInCheckResult } from '#cli/types/runs/check.ts';

import {
    NGINX_CONF,
    LOCAL_NAMES,
    VOLUME_FLAG,
    NGINX_FOLDER,
    ADD_HOST_FLAG,
    HOST_PATTERNS,
    NGINX_KEY_FILE,
    ERROR_LOCATION,
    OPENSSL_PROGRAM,
    READ_ONLY_MOUNT,
    LOOPBACK_ADDRESS,
    OPENSSL_KEY_FLAG,
    NGINX_MAIN_TARGET,
    NGINX_TEST_COMMAND,
    DOCKER_RUN_ARGUMENTS,
    CERTIFICATE_ARGUMENTS,
    NGINX_CERTIFICATE_FILE,
    CERTIFICATE_DIRECTIVES,
    OPENSSL_CERTIFICATE_FLAG,
} from '#cli/config/checks/nginx.ts';

// nginx resolves include paths from the folder of the main configuration file.
function listIncludedFiles(input: CheckInput, text: string, base: string): Pick<Mount, 'path' | 'target'>[] {
    const included: Pick<Mount, 'path' | 'target'>[] = [];
    for (const [name, value] of parseNginxDirectives(text)) {
        if (name !== 'include' || value === undefined || value.includes('$')) continue;
        const target = posix.resolve(NGINX_FOLDER, value);
        const isIncluded = picomatch(posix.normalize(posix.join(base, posix.relative(NGINX_FOLDER, target))));
        for (const file of input.files.filter((candidate) => isIncluded(candidate.path)))
            included.push({ path: file.path, target: posix.resolve(NGINX_FOLDER, posix.relative(base, file.path)) });
    }
    return included;
}

function copyNginxFiles(input: CheckInput, path: string, work: string): Map<string, Mount> {
    const folder = mkdtempSync(join(work, 'configuration-'));
    const configurations = new Map<string, Mount>();
    const pending = [{ path, target: NGINX_MAIN_TARGET }];
    const base = posix.dirname(path);
    for (const entry of pending) {
        if (configurations.has(entry.target)) continue;
        const source = join(folder, `${String(configurations.size)}.conf`);
        const bytes = readCachedBytes(input.reads, entry.path);
        writeFileSync(source, bytes);
        const text = bytes.toString('utf8');
        configurations.set(entry.target, { ...entry, source, text });
        pending.push(...listIncludedFiles(input, text, base));
    }
    return configurations;
}

function buildSyntaxResult(
    input: CheckInput,
    path: string,
    configurations: Map<string, Mount>,
    message: string,
): BuiltInCheckResult {
    const location = ERROR_LOCATION.exec(message)?.groups;
    const { file: target = '', line = '1' } = location === undefined ? {} : location;
    const file = configurations.get(target)?.path ?? path;
    return {
        findings: [buildFinding(input, { file, line: Number(line) }, 'syntax', message)],
        files: configurations.has(target) ? [file] : [],
    };
}

async function testNginxFile(
    input: CheckInput,
    path: string,
    work: string,
    image: string,
): Promise<BuiltInCheckResult> {
    const configurations = copyNginxFiles(input, path, work);
    const mounts = {
        configs: [...configurations.values()],
        certificate: join(work, NGINX_CERTIFICATE_FILE),
        key: join(work, NGINX_KEY_FILE),
    };
    const commandArguments = buildNginxTestArguments(
        [...configurations.values()].map((entry) => entry.text).join('\n'),
        mounts,
        image,
    );
    const result = await runCheckTool(input, ['docker', ...commandArguments], { cwd: input.root });
    if (result.code === 0) {
        const parsed = [...result.stdout.matchAll(/^# configuration file (?<path>[^\n]+):$/gmu)]
            .map((match) => match.groups?.['path'])
            .filter((path) => path !== undefined);
        if (!parsed.includes(NGINX_MAIN_TARGET))
            throw new Error('The nginx run produced no configuration dump confirming the tested source.');
        return {
            findings: [],
            files: parsed.flatMap((target) => {
                const configuration = configurations.get(target);
                return configuration === undefined ? [] : [configuration.path];
            }),
        };
    }
    const errorLine = result.stderr.split('\n').find((line) => line.includes('[emerg]'));
    if (result.code !== 1 || errorLine === undefined)
        throw new Error(`The nginx run failed (exit ${String(result.code)}): ${result.stderr.trim()}`);
    return buildSyntaxResult(input, path, configurations, errorLine);
}

/**
 * Builds the Docker arguments that run nginx -t on one nginx configuration.
 * @param text the nginx configuration, with its includes.
 * @param mounts the host paths to mount.
 * @param mounts.configs the copied nginx files and their container paths.
 * @param mounts.certificate a self-signed file to mount.
 * @param mounts.key a throwaway secret to mount.
 * @param image the nginx container tag.
 * @returns the command arguments after docker.
 */
function buildNginxTestArguments(text: string, mounts: NginxMounts, image: string): string[] {
    const parsed = parseNginxDirectives(text);
    const hosts = new Set(
        parsed.flatMap(([name, value]) => {
            if (value === undefined || value.includes('$')) return [];
            const host = HOST_PATTERNS.get(name)?.exec(value)?.[1];
            return host === undefined || LOCAL_NAMES.has(host) ? [] : [host];
        }),
    );
    const certificates = new Map(
        Object.entries(CERTIFICATE_DIRECTIVES).map(([directive, kind]) => [directive, mounts[kind]]),
    );
    const volumes = [
        ...mounts.configs.map(({ source, target }) => `${source}:${target}${READ_ONLY_MOUNT}`),
        ...parsed.flatMap(([name, path]) => {
            if (path === undefined || path.includes('$')) return [];
            const source = certificates.get(name);
            return source === undefined ? [] : [`${source}:${posix.resolve(NGINX_FOLDER, path)}${READ_ONLY_MOUNT}`];
        }),
    ];
    return [
        ...DOCKER_RUN_ARGUMENTS,
        ...[...hosts].flatMap((host) => [ADD_HOST_FLAG, `${host}:${LOOPBACK_ADDRESS}`]),
        ...[...new Set(volumes)].flatMap((volume) => [VOLUME_FLAG, volume]),
        image,
        ...NGINX_TEST_COMMAND,
    ];
}

/**
 * Tests every tracked nginx.conf with the server's own parser.
 * @param input the scope files and nginx image.
 * @returns one finding for each file nginx refuses.
 */
export async function checkNginxSyntax(input: CheckInput): Promise<BuiltInCheckResult> {
    const image = input.selection.view.options('tools.nginx')['image'];
    const paths = input.files
        .map((file) => file.path)
        .filter((path) => path === NGINX_CONF || path.endsWith(`/${NGINX_CONF}`));
    if (paths.length === 0) return { findings: [], files: [] };
    using workFolder = createScratchFolder();
    const work = workFolder.path;
    const certificate = await runCheckTool(
        input,
        [
            OPENSSL_PROGRAM,
            ...CERTIFICATE_ARGUMENTS,
            OPENSSL_KEY_FLAG,
            join(work, NGINX_KEY_FILE),
            OPENSSL_CERTIFICATE_FLAG,
            join(work, NGINX_CERTIFICATE_FILE),
        ],
        { cwd: work },
    );
    if (certificate.code !== 0)
        throw new Error(
            `The openssl command could not write the temporary certificate: ${formatOutputTail(certificate)}`,
        );
    const findings: Finding[] = [];
    const checked = new Set<string>();
    for (const path of paths) {
        const result = await testNginxFile(input, path, work, image);
        findings.push(...result.findings);
        for (const file of result.files) checked.add(file);
    }
    return { findings, files: [...checked] };
}
