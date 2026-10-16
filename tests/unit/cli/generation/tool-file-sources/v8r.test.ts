import { parse } from 'yaml';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { generate } from '#cli/generation/generate.ts';
import { containingAll } from '#tests/setup/matchers.ts';

test.each([true, false])('the v8r catalog lists your custom schemas: %s', async (hasSchemas) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            configurations: ['files'],
            level: 'all',
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
        'custom.json': '{}\n',
    });
    const output = generate(await openSession(sandbox.path));
    const text = output.files.find((file) => file.path === '.gspot/config/v8r.yml')!.content;
    const parsed: unknown = parse(text);
    if (hasSchemas)
        expect(parsed).toMatchObject({
            customCatalog: {
                schemas: containingAll([
                    {
                        name: 'https://example.com/schema.json',
                        fileMatch: ['custom.json'],
                        location: 'https://example.com/schema.json',
                    },
                ]),
            },
        });
    expect(text).toContain('name: mise');
});
