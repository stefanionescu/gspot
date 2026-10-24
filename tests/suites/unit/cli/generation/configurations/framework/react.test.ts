import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, readEslintRules, listLintFindings } from '#tests/setup/eslint/lint.ts';

test.each([...LEVELS])('React props need no ignored runtime declarations at level %s', async (level) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['react'], { level }),
        'Card.jsx': 'export function Card(props) { return <p>{props.label}</p>; }\n',
    });
    const eslint = await createEslint(sandbox.path);
    const rules = await readEslintRules(eslint, ['Card.jsx']);
    expect(rules['Card.jsx']!['react/prop-types']).toBeUndefined();
    expect(rules['Card.jsx']!['@eslint-react/no-missing-key']![0]).toBe(2);
    expect(await listLintFindings(eslint, sandbox.path, ['Card.jsx'], ['@eslint-react/no-missing-key'])).toStrictEqual(
        [],
    );
});
