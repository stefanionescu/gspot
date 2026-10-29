import assert from 'node:assert/strict';
import plugin from '@gspothq/eslint-plugin';
import { createRequire } from 'node:module';
import { ESLint, type Linter } from 'eslint';
import { CLIENT_ENV_RULE } from '#tests/config/setup/programs.ts';

const commonjs = createRequire(import.meta.url)('@gspothq/eslint-plugin') as { default: typeof plugin };

for (const published of [plugin, commonjs.default])
    for (const config of [published.configs.recommended, published.configs.all]) {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [config as Linter.Config] });
        const results = await eslint.lintText("'use client';\nconsole.log(process.env.SECRET);\n", {
            filePath: 'client.js',
        });
        assert.deepEqual(
            results
                .flatMap(({ messages }) => messages)
                .filter(({ ruleId }) => ruleId === CLIENT_ENV_RULE)
                .map(({ line, messageId }) => ({ line, messageId })),
            [{ line: 2, messageId: 'private' }],
        );
    }
