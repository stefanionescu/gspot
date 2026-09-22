import { z } from 'zod';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
/** Import flat configuration while preserving selectors and repository-owned executable modules. */
export async function evaluateEslint(request: z.infer<typeof eslintRequest>): Promise<z.infer<typeof eslintResponse>> {
    if (!request.flat)
        throw new Error(
            'ESLint conversion requires flat configuration. Convert the legacy extends and overrides with ESLint before adopting it.',
        );
    const require = createRequire(join(request.root, 'package.json'));
    const module = (await import(pathToFileURL(require.resolve('eslint')).href)) as typeof import('eslint');
    const Constructor = await module.loadESLint({ useFlatConfig: true });
    const eslint = new Constructor({ cwd: request.root });
    const configPath = await eslint.findConfigFile();
    if (configPath === undefined) throw new Error('ESLint conversion could not find the active flat configuration.');
    const loaded = (await import(pathToFileURL(configPath).href)) as {
        default: unknown;
    };
    if (!Array.isArray(loaded.default)) throw new Error('ESLint conversion requires a flat configuration array.');
    const syntax = ts.createSourceFile(configPath, readFileSync(configPath, 'utf8'), ts.ScriptTarget.Latest, true);
    const references = new Map<
        unknown,
        {
            module: string;
            export: string;
        }
    >();
    for (const statement of syntax.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
        const name = statement.moduleSpecifier.text;
        const resolved = createRequire(configPath).resolve(name);
        const imported = (await import(pathToFileURL(resolved).href)) as Record<string, unknown>;
        const specifier =
            name.startsWith('.') || isAbsolute(name)
                ? `./${relative(request.root, resolved).split('\\').join('/')}`
                : name;
        if (specifier.startsWith('./../'))
            throw new Error(`ESLint conversion cannot register a module outside the repository: ${name}`);
        for (const [key, value] of Object.entries(imported)) {
            references.set(value, { module: specifier, export: key });
            if (value !== null && typeof value === 'object') {
                for (const [member, entry] of Object.entries(value))
                    references.set(entry, { module: specifier, export: `${key}.${member}` });
            }
        }
    }
    const adopted = [];
    for (const [index, raw] of loaded.default.entries()) {
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
            throw new Error(`ESLint configuration ${index} is not a flat configuration object.`);
        const entry = { ...raw } as Record<string, unknown>;
        if (entry['processor'] !== undefined)
            throw new Error(
                `ESLint configuration ${index}: processor conversion is unsupported; the original configuration is retained.`,
            );
        if (entry['basePath'] !== undefined || dirname(configPath) !== request.root)
            throw new Error(
                `ESLint configuration ${index}: a scoped configuration base path needs explicit conversion.`,
            );
        const plugins = entry['plugins'] as Record<string, unknown> | undefined;
        if (plugins !== undefined) {
            entry['plugins'] = Object.fromEntries(
                Object.entries(plugins).map(([name, value]) => {
                    const reference = references.get(value);
                    if (reference === undefined)
                        throw new Error(
                            `ESLint plugin ${name} has no imported module owner. Export the custom plugin from repository-owned code and import it before adopting configuration.`,
                        );
                    return [name, reference];
                }),
            );
        }
        const language = entry['languageOptions'] as Record<string, unknown> | undefined;
        if (language?.['parser'] !== undefined) {
            const reference = references.get(language['parser']);
            if (reference === undefined)
                throw new Error(`ESLint configuration ${index}: parser has no imported module owner.`);
            entry['languageOptions'] = { ...language, parser: reference };
        }
        if (!z.json().safeParse(entry).success)
            throw new Error(
                `ESLint configuration ${index} contains data TOML cannot represent outside a registered plugin or parser.`,
            );
        const serialized = JSON.stringify(entry, (_key, value: unknown) => {
            if (
                value === null ||
                typeof value === 'undefined' ||
                (typeof value === 'number' && !Number.isFinite(value)) ||
                typeof value === 'function' ||
                typeof value === 'symbol' ||
                typeof value === 'bigint' ||
                value instanceof RegExp
            )
                throw new Error(
                    `ESLint configuration ${index} contains data TOML cannot represent outside a registered plugin or parser.`,
                );
            return value;
        });
        adopted.push(JSON.parse(serialized) as Record<string, unknown>);
    }
    const result = eslintResponse.parse({ adopted });
    for (const path of request.paths) await eslint.calculateConfigForFile(join(request.root, path));
    return result;
}
import { policySchema } from '#cli/policy/schema.ts';
export const eslintRequest = z.strictObject({
    root: z.string().min(1),
    paths: z.array(z.string().min(1)),
    flat: z.boolean(),
});
export const eslintResponse = z.strictObject({
    adopted: policySchema.shape.tools.unwrap().shape.eslint.unwrap().shape.adopted.unwrap(),
});
