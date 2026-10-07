// Installed React and React Native repositories: the generated ESLint configuration reaches each configuration's plugins.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { parseToolProject } from '#cli/parsers/packages.ts';
import { createTestRepository } from '#tests/harness/repository.ts';
import { test, expect, afterAll, describe, beforeAll } from 'bun:test';
import { suiteTimeout, openTestBudget } from '#tests/harness/command.ts';
import type { OwnedTestRepository } from '#tests/types/harness/repository.ts';
import { NATIVE_REPOSITORY } from '#tests/config/tools/configurations/framework/react.ts';

describe('the bare react-native configuration', () => {
    const resources = new AsyncDisposableStack();
    let testRepository: OwnedTestRepository;
    beforeAll(async () => {
        const budget = openTestBudget(suiteTimeout());
        try {
            testRepository = resources.use(await createTestRepository(NATIVE_REPOSITORY, spawnGspot));
        } finally {
            budget[Symbol.dispose]();
        }
    }, suiteTimeout());
    afterAll(async () => {
        await resources.disposeAsync();
    });

    test('the installed bare project requires native linting without Expo or DOM tools', () => {
        const project = parseToolProject(readFileSync(join(testRepository.root, '.gspot/package.json'), 'utf8'));
        expect(project.dependencies).toHaveProperty('eslint-plugin-react-native');
        expect(project.dependencies).not.toHaveProperty('eslint-plugin-expo');
        expect(project.dependencies).not.toHaveProperty('expo-doctor');
        expect(project.dependencies).not.toHaveProperty('eslint-plugin-jsx-a11y');
    });
});
