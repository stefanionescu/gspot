// Where a template is fetched from: an https address as given, a GitHub shorthand mapped to its raw file, never http.
import { test, spyOn, expect } from 'bun:test';
import { rejection } from '#tests/harness/expectations.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import { getTemplate } from '#cli/policy/document/contracts.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { TEMPLATE } from '#tests/config/cli/policy/templates-sources.ts';
import { RAW_HOST, TEMPLATE_FILE } from '#cli/config/policy/templates.ts';

test.each([
    ['https://example.com/house.template.toml', 'https://example.com/house.template.toml'],
    ['github:acme/policies', `${RAW_HOST}/acme/policies/HEAD/${TEMPLATE_FILE}`],
    ['github:acme/policies/team/house.template.toml@v2', `${RAW_HOST}/acme/policies/v2/team/house.template.toml`],
])('%s is fetched from %s', async (source, address) => {
    using request = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(TEMPLATE));
    const template = await getTemplate(source, '.');
    expect(request.mock.calls[0]?.[0]).toBe(address);
    expect(template.tables.configurations).toStrictEqual(['bash']);
});

test('a template address that answers 404 is refused with its status', async () => {
    using request = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not found', { status: 404 }));
    expect(await rejection(getTemplate('github:acme/missing', '.'))).toContain('answered 404');
    expect(request).toHaveBeenCalledTimes(1);
});

test('a template address over plain http is refused before any request', async () => {
    using request = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No request is expected.'));

    // eslint-disable-next-line unicorn/prefer-https -- reason: This negative test proves plain HTTP is refused before any network request.
    expect(await rejection(getTemplate('http://example.com/house.template.toml', '.'))).toContain('https, not http');
    expect(request).not.toHaveBeenCalled();
});

test('private GitHub templates receive environment credentials without sending them to other hosts', async () => {
    const previous = environmentVariables()['GITHUB_TOKEN'];
    using request = spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(TEMPLATE))
        .mockResolvedValueOnce(new Response(TEMPLATE));
    setEnvironmentVariable('GITHUB_TOKEN', 'fixture-github-token');
    try {
        await getTemplate('github:acme/policies', '.');
        await getTemplate('https://example.com/house.template.toml', '.');
        expect(request.mock.calls[0]?.[1]?.headers).toStrictEqual({ Authorization: 'Bearer fixture-github-token' });
        expect(request.mock.calls[1]?.[1]?.headers).toStrictEqual({});
    } finally {
        setEnvironmentVariable('GITHUB_TOKEN', previous);
    }
});
