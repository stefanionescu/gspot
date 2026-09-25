import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';

const SEGMENT_NAME = /^(?<kind>page|route)\.[jt]sx?$/u;
const CONFIG_FILE = /(?:^|\/)next\.config\.(?:js|mjs|cjs|ts|mts)$/u;
const SWITCHED_OFF = /\b(?<name>ignoreDuringBuilds|ignoreBuildErrors)\s*:\s*true\b/gu;
const SECRET_KEY = /\b(?<name>[A-Z][A-Z\d_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|API_KEY)[A-Z\d_]*)\s*:/gu;
const PAIRS: [string, string][] = [
    ['next', 'eslint-config-next'],
    ['next', '@next/eslint-plugin-next'],
    ['react', 'react-dom'],
];

function finding(input: EngineInput, file: string, line: number, rule: string, text: string): Finding {
    return { check: input.spec.name, file, line, rule, message: text, fixable: false };
}

function paths(input: EngineInput): string[] {
    return input.files.filter((file) => file.nature === 'source').map((file) => file.path);
}

function lineOf(text: string, offset: number): number {
    return text.slice(0, offset).split('\n').length;
}

/**
 * One finding for each route segment that holds a page and a route handler.
 * @param input the engine input
 * @returns the findings
 */
export function routeSegments(input: EngineInput): Finding[] {
    const kinds = new Map<string, Map<string, string>>();
    for (const path of paths(input)) {
        const groups = SEGMENT_NAME.exec(path.slice(path.lastIndexOf('/') + 1))?.groups;
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
            finding(
                input,
                held.get('route') ?? folder,
                1,
                'route-segment',
                `${folder} holds a page and a route handler, and the framework serves one address from one of them.`,
            ),
        )
        .toArray();
}

/**
 * The framework configuration turns no build check off, and puts no secret into the client environment.
 * @param input the engine input
 * @returns the findings
 */
export function nextjsConfiguration(input: EngineInput): Finding[] {
    return paths(input)
        .filter((path) => CONFIG_FILE.test(path))
        .flatMap((path) => {
            const text = readSource(input.root, path, input.observations).toString('utf8');
            const off = text
                .matchAll(SWITCHED_OFF)
                .map((match) =>
                    finding(
                        input,
                        path,
                        lineOf(text, match.index),
                        'build-check-off',
                        `${match.groups?.['name'] ?? ''} lets a build pass with findings the gate stops.`,
                    ),
                );
            const env = text.indexOf('env:');
            const block = env === -1 ? '' : text.slice(env, text.indexOf('}', env) + 1);
            const secrets = block
                .matchAll(SECRET_KEY)
                .map((match) =>
                    finding(
                        input,
                        path,
                        lineOf(text, env + match.index),
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
        const parsed = JSON.parse(readSource(input.root, path, input.observations).toString('utf8')) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };
        const versions = { ...parsed.devDependencies, ...parsed.dependencies };
        return PAIRS.filter(
            ([left, right]) =>
                versions[left] !== undefined && versions[right] !== undefined && versions[left] !== versions[right],
        ).map(([left, right]) =>
            finding(
                input,
                path,
                1,
                'version-pair',
                `${left} is ${versions[left] ?? ''} and ${right} is ${versions[right] ?? ''}. They ship together, so they sit on one version.`,
            ),
        );
    });
}
