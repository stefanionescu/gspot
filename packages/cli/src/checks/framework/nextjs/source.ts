import { baseName } from '#cli/platform/paths.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';
import { PAIRS, SECRET_KEY, CONFIG_FILE, SEGMENT_NAME, SWITCHED_OFF } from '#cli/config/checks/framework/nextjs.ts';

function paths(input: EngineInput): string[] {
    return input.files.filter((file) => file.kind === 'source').map((file) => file.path);
}
/**
 * One finding for each route segment that holds a page and a route handler.
 * @param input the engine input
 * @returns the findings
 */
export function routeSegments(input: EngineInput): Finding[] {
    const kinds = new Map<string, Map<string, string>>();
    for (const path of paths(input)) {
        const groups = SEGMENT_NAME.exec(baseName(path))?.groups;
        if (groups === undefined || !`/${path}`.includes('/app/')) continue;
        const folder = path.slice(0, path.lastIndexOf('/'));
        const held = kinds.get(folder) ?? new Map<string, string>();
        held.set(groups['kind'] ?? '', path);
        kinds.set(folder, held);
    }
    return kinds
        .entries()
        .filter(([, held]) => held.has('page') && held.has('route'))
        .map(([folder, held]) =>
            findingAt(
                input,
                { file: held.get('route') ?? folder, line: 1 },
                'route-segment',
                `${folder} holds a page and a route handler, and the framework serves one address from one of them.`,
            ),
        )
        .toArray();
}

/**
 * The framework kit turns no build check off, and puts no secret into the client environment.
 * @param input the engine input
 * @returns the findings
 */
export function nextjsConfiguration(input: EngineInput): Finding[] {
    return paths(input)
        .filter((path) => CONFIG_FILE.test(path))
        .flatMap((path) => {
            const text = readSource(input.root, path, input.reads).toString('utf8');
            const off = text
                .matchAll(SWITCHED_OFF)
                .map((match) =>
                    findingAt(
                        input,
                        { file: path, line: text.slice(0, match.index).split('\n').length },
                        'build-check-off',
                        `${match.groups?.['name'] ?? ''} lets a build pass with findings the gate stops.`,
                    ),
                );
            const env = text.indexOf('env:');
            const block = env === -1 ? '' : text.slice(env, text.indexOf('}', env) + 1);
            const secrets = block
                .matchAll(SECRET_KEY)
                .map((match) =>
                    findingAt(
                        input,
                        { file: path, line: text.slice(0, env + match.index).split('\n').length },
                        'secret-in-env',
                        `${match.groups?.['name'] ?? ''} under env is written into the client bundle. Read it on the server.`,
                    ),
                );
            return [...off, ...secrets];
        });
}

/**
 * Packages that ship together sit on one version in every package.json.
 * @param input the engine input
 * @returns the findings
 */
export function dependencyAlignment(input: EngineInput): Finding[] {
    const manifests = paths(input).filter((path) => path === 'package.json' || path.endsWith('/package.json'));
    return manifests.flatMap((path) => {
        const parsed = JSON.parse(readSource(input.root, path, input.reads).toString('utf8')) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };
        const versions = { ...parsed.devDependencies, ...parsed.dependencies };
        return PAIRS.filter(
            ([left, right]) =>
                versions[left] !== undefined && versions[right] !== undefined && versions[left] !== versions[right],
        ).map(([left, right]) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'version-pair',
                `${left} is ${versions[left] ?? ''} and ${right} is ${versions[right] ?? ''}. They ship together, so they sit on one version.`,
            ),
        );
    });
}
