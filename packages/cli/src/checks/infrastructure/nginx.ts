import picomatch from 'picomatch';
import { join, posix } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { readBytes } from '#cli/system/files/reads.ts';
import { DOCKER_TOOL } from '#cli/config/executables.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { formatOutputTail } from '#cli/runs/command/output.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { parseNginxDirectives } from '#cli/parsers/formats/nginx.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import type { Mount, NginxMounts } from '#cli/types/checks/infrastructure.ts';
import { type CheckFinding, type BuiltInCheckResult } from '#cli/types/runs/check.ts';
import { SYNTAX_RULE } from '#cli/config/checks/cross-configuration/cross-configuration.ts';

import {
    NGINX_CONF,
    NGINX_TABLE,
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
    DOCKER_DAEMON_NOTE,
    NGINX_TEST_COMMAND,
    DOCKER_DAEMON_ERROR,
    NGINX_VARIABLE_MARK,
    NGINX_DUMP_FILE_LINE,
    NGINX_EMERGENCY_MARK,
    DOCKER_RUN_ARGUMENTS,
    CERTIFICATE_ARGUMENTS,
    NGINX_CERTIFICATE_FILE,
    CERTIFICATE_DIRECTIVES,
    OPENSSL_CERTIFICATE_FLAG,
} from '#cli/config/checks/infrastructure.ts';

function listIncludedFiles(planned: PlannedCheck, text: string, base: string): Pick<Mount, 'path' | 'target'>[] {
    const included: Pick<Mount, 'path' | 'target'>[] = [];
    for (const [name, value] of parseNginxDirectives(text)) {
        if (name !== 'include' || value === undefined || value.includes(NGINX_VARIABLE_MARK)) continue;
        const target = posix.resolve(NGINX_FOLDER, value);
        const relativeTarget = posix.relative(NGINX_FOLDER, target);
        const isIncluded = picomatch(posix.normalize(posix.join(base, relativeTarget)));
        for (const file of planned.files) {
            if (!isIncluded(file.path)) continue;
            included.push({ path: file.path, target: posix.resolve(NGINX_FOLDER, posix.relative(base, file.path)) });
        }
    }
    return included;
}

function copyNginxFiles(session: Session, planned: PlannedCheck, path: string, workFolder: string): Map<string, Mount> {
    const folder = mkdtempSync(join(workFolder, NGINX_COPY_PREFIX));
    const copies = new Map<string, Mount>();
    const pending = [{ path, target: NGINX_MAIN_TARGET }];
    const base = posix.dirname(path);
    for (let pendingFile = pending.shift(); pendingFile !== undefined; pendingFile = pending.shift()) {
        if (copies.has(pendingFile.target)) continue;
        const source = join(folder, `${String(copies.size)}.conf`);
        const bytes = readBytes(session.cache, pendingFile.path);
        writeFileSync(source, bytes);
        const text = bytes.toString('utf8');
        copies.set(pendingFile.target, { ...pendingFile, source, text });
        pending.push(...listIncludedFiles(planned, text, base));
    }
    return copies;
}

function buildSyntaxResult(path: string, copies: Map<string, Mount>, message: string): BuiltInCheckResult {
    const location = ERROR_LOCATION.exec(message)?.groups;
    const { file: target = '', line = '1' } = location === undefined ? {} : location;
    const file = copies.get(target)?.path ?? path;
    return {
        findings: [
            {
                file,
                line: Number(line),
                rule: SYNTAX_RULE,
                message: message,
            },
        ],
        files: copies.has(target) ? [file] : [],
    };
}

async function testNginxFile(
    session: CheckSession,
    planned: PlannedCheck,
    path: string,
    workFolder: string,
    image: string,
): Promise<BuiltInCheckResult> {
    const copies = copyNginxFiles(session, planned, path, workFolder);
    const mounts = {
        configs: copies.values().toArray(),
        certificate: join(workFolder, NGINX_CERTIFICATE_FILE),
        key: join(workFolder, NGINX_KEY_FILE),
    };
    const commandArguments = buildNginxTestArguments(
        copies
            .values()
            .map((copy) => copy.text)
            .toArray()
            .join('\n'),
        mounts,
        image,
    );
    const result = await runCheckTool(session, planned, [DOCKER_TOOL, ...commandArguments], { cwd: session.root });
    if (result.code === 0) {
        const parsed = result.stdout
            .matchAll(NGINX_DUMP_FILE_LINE)
            .map((match) => match.groups?.['path'])
            .filter((path) => path !== undefined)
            .toArray();
        if (!parsed.includes(NGINX_MAIN_TARGET))
            throw new GspotError(
                'check',
                `The nginx in ${image} did not read ${NGINX_MAIN_TARGET}, so the check tested none of your files. Set tools.nginx.image to an image whose nginx reads ${NGINX_MAIN_TARGET}.`,
            );
        return {
            findings: [],
            files: parsed.flatMap((target) => {
                const configuration = copies.get(target);
                return configuration === undefined ? [] : [configuration.path];
            }),
        };
    }
    if (DOCKER_DAEMON_ERROR.test(result.stderr)) throw new GspotError('tool', DOCKER_DAEMON_NOTE);
    const errorLine = result.stderr.split('\n').find((line) => line.includes(NGINX_EMERGENCY_MARK));
    if (errorLine === undefined || result.code !== 1)
        throw new GspotError('check', `The nginx run failed (exit ${String(result.code)}): ${result.stderr.trim()}`);
    return buildSyntaxResult(path, copies, errorLine);
}

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
Tests every tracked nginx.conf with the server's own parser.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
@returns one finding for each file nginx refuses.
*/
export async function checkSyntax(session: CheckSession, planned: PlannedCheck): Promise<BuiltInCheckResult> {
    const image = getTable(planned.scope.settings, NGINX_TABLE)['image'];
    const paths = listSourcePaths(planned.files, [NGINX_CONF]);
    if (paths.length === 0) return { findings: [], files: [] };
    using workFolder = createTemporaryFolder();
    const certificate = await runCheckTool(
        session,
        planned,
        [
            OPENSSL_PROGRAM,
            ...CERTIFICATE_ARGUMENTS,
            OPENSSL_KEY_FLAG,
            join(workFolder.path, NGINX_KEY_FILE),
            OPENSSL_CERTIFICATE_FLAG,
            join(workFolder.path, NGINX_CERTIFICATE_FILE),
        ],
        { cwd: workFolder.path },
    );
    if (certificate.code !== 0)
        throw new GspotError(
            'check',
            `The openssl command could not write the temporary certificate: ${formatOutputTail(certificate)}`,
        );
    const findings: CheckFinding[] = [];
    const checked = new Set<string>();
    for (const path of paths) {
        const result = await testNginxFile(session, planned, path, workFolder.path, image);
        findings.push(...result.findings);
        for (const file of result.files) checked.add(file);
    }
    return { findings, files: [...checked] };
}
