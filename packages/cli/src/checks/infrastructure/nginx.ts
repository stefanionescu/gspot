import picomatch from 'picomatch';
import { join, posix } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { DOCKER_TOOL } from '#cli/config/tools/inspect.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseNginxDirectives } from '#cli/parsers/nginx.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { type Finding, type BuiltInCheckResult } from '#cli/types/runs/check.ts';
import type { Mount, NginxMounts } from '#cli/types/checks/infrastructure/nginx.ts';

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
    NGINX_COPY_PREFIX,
    NGINX_MAIN_TARGET,
    NGINX_TEST_COMMAND,
    NGINX_VARIABLE_MARK,
    NGINX_DUMP_FILE_LINE,
    NGINX_EMERGENCY_MARK,
    DOCKER_RUN_ARGUMENTS,
    CERTIFICATE_ARGUMENTS,
    NGINX_CERTIFICATE_FILE,
    CERTIFICATE_DIRECTIVES,
    OPENSSL_CERTIFICATE_FLAG,
} from '#cli/config/checks/infrastructure/nginx.ts';

// nginx resolves include paths from the folder of the main configuration file.
function listIncludedFiles(planned: PlannedCheck, text: string, base: string): Pick<Mount, 'path' | 'target'>[] {
    const included: Pick<Mount, 'path' | 'target'>[] = [];
    for (const [name, value] of parseNginxDirectives(text)) {
        if (name !== 'include' || value === undefined || value.includes(NGINX_VARIABLE_MARK)) continue;
        const target = posix.resolve(NGINX_FOLDER, value);
        const isIncluded = picomatch(posix.normalize(posix.join(base, posix.relative(NGINX_FOLDER, target))));
        for (const file of planned.files.filter((entry) => isIncluded(entry.path)))
            included.push({ path: file.path, target: posix.resolve(NGINX_FOLDER, posix.relative(base, file.path)) });
    }
    return included;
}

function copyNginxFiles(session: Session, planned: PlannedCheck, path: string, work: string): Map<string, Mount> {
    const folder = mkdtempSync(join(work, NGINX_COPY_PREFIX));
    const copies = new Map<string, Mount>();
    const pending = [{ path, target: NGINX_MAIN_TARGET }];
    const base = posix.dirname(path);
    for (const entry of pending) {
        if (copies.has(entry.target)) continue;
        const source = join(folder, `${String(copies.size)}.conf`);
        const bytes = readCachedBytes(session.reads, entry.path);
        writeFileSync(source, bytes);
        const text = bytes.toString('utf8');
        copies.set(entry.target, { ...entry, source, text });
        pending.push(...listIncludedFiles(planned, text, base));
    }
    return copies;
}

function buildSyntaxResult(
    planned: PlannedCheck,
    path: string,
    copies: Map<string, Mount>,
    message: string,
): BuiltInCheckResult {
    const location = ERROR_LOCATION.exec(message)?.groups;
    const { file: target = '', line = '1' } = location === undefined ? {} : location;
    const file = copies.get(target)?.path ?? path;
    return {
        findings: [buildFinding(planned, { file, line: Number(line) }, 'syntax', message)],
        files: copies.has(target) ? [file] : [],
    };
}

async function testNginxFile(
    session: Session,
    planned: PlannedCheck,
    path: string,
    work: string,
    image: string,
): Promise<BuiltInCheckResult> {
    const copies = copyNginxFiles(session, planned, path, work);
    const mounts = {
        configs: [...copies.values()],
        certificate: join(work, NGINX_CERTIFICATE_FILE),
        key: join(work, NGINX_KEY_FILE),
    };
    const commandArguments = buildNginxTestArguments(
        [...copies.values()].map((entry) => entry.text).join('\n'),
        mounts,
        image,
    );
    const result = await runCheckTool(session, planned, [DOCKER_TOOL, ...commandArguments], { cwd: session.root });
    if (result.code === 0) {
        const parsed = [...result.stdout.matchAll(NGINX_DUMP_FILE_LINE)]
            .map((match) => match.groups?.['path'])
            .filter((path) => path !== undefined);
        if (!parsed.includes(NGINX_MAIN_TARGET))
            throw new Error(
                'The output of nginx -T holds no configuration, so gspot cannot tell which file nginx tested.',
            );
        return {
            findings: [],
            files: parsed.flatMap((target) => {
                const configuration = copies.get(target);
                return configuration === undefined ? [] : [configuration.path];
            }),
        };
    }
    const errorLine = result.stderr.split('\n').find((line) => line.includes(NGINX_EMERGENCY_MARK));
    if (result.code !== 1 || errorLine === undefined)
        throw new Error(`The nginx run failed (exit ${String(result.code)}): ${result.stderr.trim()}`);
    return buildSyntaxResult(planned, path, copies, errorLine);
}

/**
 * Builds the Docker arguments that run `nginx -T` on one nginx configuration. `nginx -T` tests the configuration and
 * prints every file it read.
 *
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
            if (value === undefined || value.includes(NGINX_VARIABLE_MARK)) return [];
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
            if (path === undefined || path.includes(NGINX_VARIABLE_MARK)) return [];
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
 *
 * @param session the repository and its tools.
 * @param planned the scope files and nginx image.
 * @returns one finding for each file nginx refuses.
 */
export async function checkNginxSyntax(session: Session, planned: PlannedCheck): Promise<BuiltInCheckResult> {
    const image = getTable(planned.scope.settings, 'tools.nginx')['image'];
    const paths = listSourcePaths(planned.files, [NGINX_CONF]);
    if (paths.length === 0) return { findings: [], files: [] };
    using workFolder = createTemporaryFolder();
    const work = workFolder.path;
    const certificate = await runCheckTool(
        session,
        planned,
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
        const result = await testNginxFile(session, planned, path, work, image);
        findings.push(...result.findings);
        for (const file of result.files) checked.add(file);
    }
    return { findings, files: [...checked] };
}
