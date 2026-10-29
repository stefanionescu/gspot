export const DUPLICATED_METADATA = JSON.stringify(
    Array.from({ length: 40 }, (_, value) => ({ name: `entry-${String(value)}`, value })),
    null,
    4,
);

export const SHARED_IMPORTS = Array.from(
    { length: 12 },
    (_, index) => `import { value${String(index)} } from './values/value-${String(index)}.ts';`,
).join('\n');

export const SHARED_PYTHON_IMPORTS = Array.from(
    { length: 12 },
    (_, index) =>
        `import module_${String(index)} as alias_${String(index)}\nfrom package_${String(index)} import (\n    first_${String(index)},\n    second_${String(index)},\n)\nfrom package_${String(index)} import third_${String(index)}, \\\n    fourth_${String(index)}`,
).join('\n');

export const DUPLICATED_PYTHON_LOGIC = Array.from(
    { length: 20 },
    (_, index) => `    total += values[${String(index)}] * ${String(index + 2)}`,
).join('\n');
