// Every route file of an express service has a test that names it.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { pathMatcher } from '#cli/presets/claims.ts';

const DEFAULT_TESTS = ['**/*.test.*', '**/*.spec.*', '**/tests/**'];

function stem(path: string): string {
    const name = path.slice(path.lastIndexOf('/') + 1);
    return name.slice(0, name.indexOf('.'));
}

/**
 * One finding for each file under tools.express.route_glob that no file under tools.express.test_glob names.
 * @param input the engine input
 * @returns the findings
 */
export function routesTested(input: EngineInput): Promise<Finding[]> {
    const tool = input.view.tool('express');
    const routes = (tool['route_glob'] as string[] | undefined) ?? [];
    const tests = (tool['test_glob'] as string[] | undefined) ?? DEFAULT_TESTS;
    if (routes.length === 0 || tests.length === 0) return Promise.resolve([]);
    const isRoute = pathMatcher(routes);
    const isTest = pathMatcher(tests);
    const paths = input.session.repository.files.map((file) => file.path);
    const testText = paths
        .filter((path) => isTest(path))
        .map((path) => `${path}\n${readFileSync(join(input.root, path), 'utf8')}`);
    const untested = paths.filter(
        (path) => isRoute(path) && !isTest(path) && testText.every((text) => !text.includes(stem(path))),
    );
    return Promise.resolve(
        untested.map((path) => ({
            check: input.spec.name,
            file: path,
            line: 1,
            rule: 'untested-route',
            message: `No test file names ${stem(path)}, in its path or its text.`,
            fixable: false,
        })),
    );
}
