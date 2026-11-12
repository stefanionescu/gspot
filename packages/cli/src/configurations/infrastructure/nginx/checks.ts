import { mkdtempSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';

import picomatch from 'picomatch';

import {
    ADD_HOST_FLAG,
    CERTIFICATE_ARGUMENTS,
    CERTIFICATE_DIRECTIVES,
    DOCKER_DAEMON_ERROR,
    DOCKER_RUN_ARGUMENTS,
    ERROR_LOCATION,
    HOST_PATTERNS,
    LOCAL_NAMES,
    LOOPBACK_ADDRESS,
    MOUNT_FLAG,
    NGINX_CERTIFICATE_FILE,
    NGINX_CONFIG_FILE,
    NGINX_COPY_PREFIX,
    NGINX_DUMP_FILE_LINE,
    NGINX_EMERGENCY_MARK,
    NGINX_FOLDER,
    NGINX_KEY_FILE,
    NGINX_MAIN_TARGET,
    NGINX_TEST_COMMAND,
    NGINX_VARIABLE_MARK,
    OPENSSL_CERTIFICATE_FLAG,
    OPENSSL_KEY_FLAG,
    OPENSSL_PROGRAM,
} from '#cli/config/configurations/nginx.ts';
import { SYNTAX_RULE } from '#cli/config/configurations/shared.ts';
import { DOCKER_DAEMON_NOTE, DOCKER_TOOL } from '#cli/config/engine.ts';
import { parseNginxDirectives } from '#cli/configurations/infrastructure/nginx/directives.ts';
import { runCheckTool } from '#cli/engine/tool-runs/tool.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { createTemporaryFolder } from '#cli/system/files/folders.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import type { Mount, NginxMounts } from '#cli/types/configurations/infrastructure.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import {
    type BuiltInCheckResult,
    type CheckCode,
    type CheckFinding,
    type CheckSession,
} from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function listIncludedFiles(planned: PlannedCheck, text: string, base: string): Array<Pick<Mount, 'path' | 'target'>> {
    const included: Array<Pick<Mount, 'path' | 'target'>> = [];
    for (const [name, value] of parseNginxDirectives(text)) {
        if (name !== 'include' || value === undefined || value.includes(NGINX_VARIABLE_MARK)) continue;
        const target = posix.resolve(NGINX_FOLDER, value);
        const relativeTarget = posix.relative(NGINX_FOLDER, target);
        const isIncluded = picomatch(posix.normalize(posix.join(base, relativeTarget)));
        included.push(
            ...planned.files
                .filter((file) => isIncluded(file.path))
                .map((file) => ({
                    path: file.path,
                    target: posix.resolve(NGINX_FOLDER, posix.relative(base, file.path)),
                })),
        );
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
    const copy = copies.get(location?.['file'] ?? '');
    return {
        findings: [
            {
                file: copy === undefined ? path : copy.path,
                line: Number(location?.['line'] ?? '1'),
                rule: SYNTAX_RULE,
                message,
            },
        ],
        files: copy === undefined ? [] : [copy.path],
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
            throw new CheckStop(
                'error',
                `The nginx in ${image} did not read ${NGINX_MAIN_TARGET}, so the check tested none of your files. Set nginx.image to an image whose nginx reads ${NGINX_MAIN_TARGET}.`,
            );
        return {
            findings: [],
            files: parsed.flatMap((target) => {
                const configuration = copies.get(target);
                return configuration === undefined ? [] : [configuration.path];
            }),
        };
    }
    if (DOCKER_DAEMON_ERROR.test(result.stderr)) throw new CheckStop('missing', DOCKER_DAEMON_NOTE);
    const errorLine = result.stderr.split('\n').find((line) => line.includes(NGINX_EMERGENCY_MARK));
    if (errorLine === undefined || result.code !== 1)
        throw new CheckStop('error', `The nginx run failed (exit ${String(result.code)}): ${result.stderr.trim()}`);
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
    const mountFields = [
        ...mounts.configs.map(({ source, target }) => [`source=${source}`, `target=${target}`]),
        ...parsed.flatMap(([name, path]) => {
            if (path === undefined || path.includes(NGINX_VARIABLE_MARK)) return [];
            const source = certificates.get(name);
            return source === undefined ? [] : [[`source=${source}`, `target=${posix.resolve(NGINX_FOLDER, path)}`]];
        }),
    ];
    const volumes = mountFields.map((fields) => {
        const quoted = fields.map((field) => `"${field.replaceAll('"', '""')}"`);
        return `type=bind,${quoted.join(',')},readonly`;
    });
    return [
        ...DOCKER_RUN_ARGUMENTS,
        ...[...hosts].flatMap((host) => [ADD_HOST_FLAG, `${host}:${LOOPBACK_ADDRESS}`]),
        ...[...new Set(volumes)].flatMap((mount) => [MOUNT_FLAG, mount]),
        image,
        ...NGINX_TEST_COMMAND,
    ];
}

async function checkSyntax(session: CheckSession, planned: PlannedCheck): Promise<BuiltInCheckResult> {
    const image = getTable(planned.scope.settings, 'nginx').image;
    const paths = listSourcePaths(planned.files, [NGINX_CONFIG_FILE]);
    if (paths.length === 0) return { findings: [], files: [] };
    using workFolder = createTemporaryFolder();
    await runCheckTool(
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
        { cwd: workFolder.path, exitCodes: [] },
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

export const NGINX_CHECKS: Readonly<Record<string, CheckCode>> = {
    'nginx/syntax': { check: checkSyntax },
};
