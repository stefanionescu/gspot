// Build the plugin as Node ESM and CommonJS beside its declaration and license.
import { format } from 'prettier';
import plugin from '#plugin/plugin.ts';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import packageManifest from '#plugin-package' with { type: 'json' };
import { rmSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { JSON_INDENT, BUILD_FORMATS, ALL_RULES_PATH, PLUGIN_DECLARATION } from '#plugin/config/build.ts';
import { captureEslintPreset, eslintPresetsSchema, eslintAllRulesSchema } from '#cli/parsers/schema/eslint.ts';

const root = fileURLToPath(new URL('../packages/eslint-plugin/', import.meta.url));
const distribution = join(root, 'dist');
rmSync(distribution, { recursive: true, force: true });
mkdirSync(distribution);
for (const [format, name] of BUILD_FORMATS) {
    const result = await Bun.build({
        entrypoints: [join(root, 'src/plugin.ts')],
        outdir: distribution,
        naming: name,
        format,
        target: 'node',
        external: Object.keys(packageManifest.dependencies),
        minify: false,
        sourcemap: 'none',
    });
    if (!result.success) throw new Error(result.logs.map((log) => log.message).join('\n'));
}
writeFileSync(join(distribution, 'plugin.d.ts'), PLUGIN_DECLARATION);
copyFileSync(join(root, '../..', 'LICENSE.md'), join(distribution, 'LICENSE.md'));
const allRulesPath = join(root, ALL_RULES_PATH);
const allRules = eslintAllRulesSchema.parse(JSON.parse(readFileSync(allRulesPath, 'utf8')));
const externalRules = [...allRules].filter((name) => !name.startsWith('gspot/'));
const rules = [
    ...Object.entries(plugin.rules).flatMap(([name, rule]) => {
        const docs = rule.meta.docs;
        if (docs === undefined) throw new Error(`Rule ${name} has no documentation metadata.`);
        return docs.level === 'all' ? [`gspot/${name}`] : [];
    }),
    ...externalRules,
].toSorted((first, second) => first.localeCompare(second));
writeFileSync(allRulesPath, `${JSON.stringify(rules, null, JSON_INDENT)}\n`);
const presetsPath = join(dirname(allRulesPath), 'eslint-presets.json');
const presets = eslintPresetsSchema.parse(JSON.parse(readFileSync(presetsPath, 'utf8')));
presets['gspot'] = captureEslintPreset(packageManifest.name, packageManifest.version, 'configs.recommended', plugin);
writeFileSync(presetsPath, await format(JSON.stringify(presets), { parser: 'json', tabWidth: JSON_INDENT }));
console.log('built packages/eslint-plugin/dist/plugin.js and plugin.cjs');
