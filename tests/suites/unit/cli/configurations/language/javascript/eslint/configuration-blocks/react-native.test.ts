import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, readEslintRules } from '#tests/setup/eslint/lint.ts';

test('Expo app code may read only EXPO_PUBLIC_ variables, and API routes and configs may read any', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'expo']),
        'package.json': '{"private":true,"type":"module","dependencies":{"expo":"0.0.0-test"}}',
        'app/index.jsx': 'export default function Home() { return null; }\n',
        'app/items+api.js': 'export function GET() { return Response.json([]); }\n',
        'app.config.js': 'export default {};\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = await readEslintRules(eslint, ['app/index.jsx', 'app/items+api.js', 'app.config.js']);
    expect(rules['app/index.jsx']!['gspot/no-client-env']).toStrictEqual([
        2,
        { client: true, publicPrefixes: ['EXPO_PUBLIC_'], allowedNames: ['NODE_ENV'] },
    ]);
    expect(rules['app/items+api.js']!['gspot/no-client-env']?.[1]).toMatchObject({ client: false });
    expect(rules['app.config.js']!['gspot/no-client-env']?.[1]).toMatchObject({ client: false });
});
