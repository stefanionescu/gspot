import { parse } from 'yaml';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { stringify } from '@decimalturn/toml-patch';
import { matchItems } from '#tests/setup/matchers.ts';
import { generate } from '#cli/generation/generate.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';

test.each([true, false])('the v8r catalog lists your custom schemas: %s', async (hasSchemas) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['files'], {
            level: 'all',
            rules: true,
            tables: stringify({
                tools: {
                    v8r: {
                        schema: hasSchemas
                            ? [
                                  {
                                      paths: ['custom.json'],
                                      url: 'https://example.com/schema.json',
                                  },
                              ]
                            : [],
                    },
                },
            }),
        }),
        'custom.json': '{}\n',
    });

    const output = generate(await openSession(sandbox.path));
    const text = output.files.find((file) => file.path === '.gspot/configurations/general/files/v8r.yml')!.content;
    const parsed: unknown = parse(text);
    if (hasSchemas)
        expect(parsed).toMatchObject({
            customCatalog: {
                schemas: matchItems([
                    {
                        name: 'https://example.com/schema.json',
                        fileMatch: ['custom.json'],
                        location: 'https://example.com/schema.json',
                    },
                ]),
            },
        });
    expect(text).toContain('name: mise');
    expect(text).not.toContain('name: gspot');
    expect(output.files.some((file) => file.path.endsWith('/gspot-toml.schema.json'))).toBe(false);
});
