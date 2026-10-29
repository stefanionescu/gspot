export const SELECTOR_FILES = {
    'native/App.jsx':
        'const list = <FlatList data={items} />;\nconst scroll = <ScrollView>{items.map(renderItem)}</ScrollView>;\n',
    'forms/Fields.jsx': `const checkbox = <input type="checkbox" value="a" {...register("choice")} />;
const radio = <input type="radio" value="a" {...register("choice")} />;
const text = <input type="text" value="a" {...register("choice")} />;
const memberCheckbox = <input type="checkbox" value="a" {...form.register("choice")} />;
const memberRadio = <input type="radio" value="a" {...form.register("choice")} />;
const memberText = <input type="text" value="a" {...form.register("choice")} />;
`,
} as const;

export const SELECTOR_LIBRARY_FILES = {
    'cart.js':
        "import { useStore } from 'zustand';\nimport { cartStore, useCartStore } from './store.js';\nexport function readCart() {\n    const whole = useCartStore();\n    const all = useStore(cartStore);\n    return [whole, all];\n}\n",
    'form.js':
        "import { useForm } from 'react-hook-form';\nconst options = { resolver: schema };\nexport function useSignup() { return useForm(options); }\n",
    'router.js':
        'const byId = publicProcedure.input(schema);\nexport const appRouter = router({\n    item: byId.query(resolve),\n    order: publicProcedure.input(schema).query(({ input }) => pool.query(sql)),\n});\n',
} as const;

export const FRAMEWORK_SELECTOR_CASES = [
    {
        configuration: 'nestjs',
        language: 'typescript',
        file: 'source.ts',
        source: 'import { Res, Response, forwardRef } from "@nestjs/common";\nexport class Controller {\n    first(@Res() response: unknown) { return response; }\n    second(@Response({ passthrough: true }) response: unknown) { return response; }\n}\nforwardRef(() => Controller);\n',
        basic: [3],
        all: [3, 6],
    },
    {
        configuration: 'react-native',
        language: 'javascript',
        file: 'source.jsx',
        source: 'import { TouchableOpacity, Pressable } from "react-native";\nAsyncStorage.setItem("accessToken", value);\nAsyncStorage.setItem("theme", value);\nexport const button = <Pressable />;\n',
        basic: [2],
        all: [1, 2],
    },
] as const;
