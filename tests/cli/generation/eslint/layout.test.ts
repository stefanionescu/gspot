import { ESLint } from 'eslint';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openSession } from '#cli/execution/session.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';

test.each(['recommended', 'all'])('generated %s ESLint configuration selects layout by level', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level: level }),
        'package.json': '{"name":"layout-consumer","private":true,"type":"module"}',
        'src/order.ts': 'export const value = 1;\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
    });
    linkInstalledModules(join(sandbox.path, 'node_modules'));
    const session = await openSession(sandbox.path);
    const output = emitAll(session);
    const config = output.files.find((file) => file.path === '.gspot/config/eslint.config.mjs');
    expect(config).toBeDefined();
    using log = openOwnership(sandbox.path);
    writeOutputs(session, log, undefined, output);
    const eslint = new ESLint({
        cwd: sandbox.path,
        overrideConfigFile: join(sandbox.path, '.gspot/config/eslint.config.mjs'),
    });
    const [result] = await eslint.lintText('export const value = 1;\nconst internal = 2;\nconsole.log(internal);\n', {
        filePath: 'src/order.js',
    });
    expect(result?.fatalErrorCount).toBe(0);
    const layout = result!.messages.filter((diagnostic) => diagnostic.ruleId === 'import-x/exports-last');
    // The layout rule belongs to the all level alone.
    expect(layout).toMatchObject(level === 'recommended' ? [] : [{ ruleId: 'import-x/exports-last', line: 1 }]);
});
