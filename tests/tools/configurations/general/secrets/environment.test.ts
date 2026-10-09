// Environment linting, template declarations and tracked-file policy share the secrets owner.
import { join } from 'node:path';
import { test, expect, describe } from 'bun:test';
import { spawnGspot } from '#tests/harness/gspot.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { shareRepository } from '#tests/harness/repository.ts';
import { REPOSITORY } from '#tests/config/tools/configurations/general/secrets/environment.ts';

describe('environment checks in the secrets configuration', () => {
    const repository = shareRepository(() => REPOSITORY);

    test('the pinned dotenv fixer corrects the tracked environment template', async () => {
        const { root, environment } = repository();
        await Bun.write(join(root, '.env.example'), 'lowercase=value\n');
        const fixed = await spawnGspot(root, ['check', '--only', 'secrets/dotenv-linter', '--fix'], environment);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(root, '.env.example')).text()).toBe('LOWERCASE=value\n');
        const checked = await spawnGspot(root, ['check', '--only', 'secrets/dotenv-linter', '--json'], environment);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect((JSON.parse(checked.stdout) as RunReport).checks).toMatchObject([
            { check: 'secrets/dotenv-linter', status: 'passed', findings: [] },
        ]);
    });
});
