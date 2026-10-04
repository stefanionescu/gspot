import { PYPROJECT } from '#tests/config/samples/python/source.ts';
import type { FindingCase } from '#tests/types/harness/check-case.ts';
import type { RepositoryScenario } from '#tests/types/harness/repository.ts';

export const STRUCTURE_CLEAN =
    '"""Prices."""\n\n\ndef _rounded(amount: float) -> float:\n    """Round to cents, half up."""\n    shifted = amount * 100\n    whole = int(shifted + 0.5)\n    return whole / 100\n\n\ndef total(prices: list[float]) -> float:\n    """Add prices and round the sum."""\n    summed = sum(prices)\n    checked = max(summed, 0.0)\n    return _rounded(checked) + _rounded(0.0)\n\n\n__all__ = ["total"]\n';

/** Authored inputs and configuration selection for this scenario. */
export const REPOSITORY: RepositoryScenario = {
    configurations: ['python'],
    modules: false,
    installs: false,
    without: ['naming', 'spelling', 'dependencies'],
    files: {
        'pyproject.toml': PYPROJECT,
        'example/__init__.py': '"""The test package."""\n',
        'example/prices.py': STRUCTURE_CLEAN,
    },
};

export const LONG_FILE =
    'VALUE_0 = 0\nVALUE_1 = 1\nVALUE_2 = 2\nVALUE_3 = 3\nVALUE_4 = 4\nVALUE_5 = 5\nVALUE_6 = 6\nVALUE_7 = 7\nVALUE_8 = 8\nVALUE_9 = 9\nVALUE_10 = 10\nVALUE_11 = 11\nVALUE_12 = 12\nVALUE_13 = 13\nVALUE_14 = 14\nVALUE_15 = 15\nVALUE_16 = 16\nVALUE_17 = 17\nVALUE_18 = 18\nVALUE_19 = 19\nVALUE_20 = 20\nVALUE_21 = 21\nVALUE_22 = 22\nVALUE_23 = 23\nVALUE_24 = 24\nVALUE_25 = 25\nVALUE_26 = 26\nVALUE_27 = 27\nVALUE_28 = 28\nVALUE_29 = 29\nVALUE_30 = 30\nVALUE_31 = 31\nVALUE_32 = 32\nVALUE_33 = 33\nVALUE_34 = 34\nVALUE_35 = 35\nVALUE_36 = 36\nVALUE_37 = 37\nVALUE_38 = 38\nVALUE_39 = 39\nVALUE_40 = 40\nVALUE_41 = 41\nVALUE_42 = 42\nVALUE_43 = 43\nVALUE_44 = 44\nVALUE_45 = 45\nVALUE_46 = 46\nVALUE_47 = 47\nVALUE_48 = 48\nVALUE_49 = 49\nVALUE_50 = 50\nVALUE_51 = 51\nVALUE_52 = 52\nVALUE_53 = 53\nVALUE_54 = 54\nVALUE_55 = 55\nVALUE_56 = 56\nVALUE_57 = 57\nVALUE_58 = 58\nVALUE_59 = 59\nVALUE_60 = 60\nVALUE_61 = 61\nVALUE_62 = 62\nVALUE_63 = 63\nVALUE_64 = 64\nVALUE_65 = 65\nVALUE_66 = 66\nVALUE_67 = 67\nVALUE_68 = 68\nVALUE_69 = 69\nVALUE_70 = 70\nVALUE_71 = 71\nVALUE_72 = 72\nVALUE_73 = 73\nVALUE_74 = 74\nVALUE_75 = 75\nVALUE_76 = 76\nVALUE_77 = 77\nVALUE_78 = 78\nVALUE_79 = 79\nVALUE_80 = 80\nVALUE_81 = 81\nVALUE_82 = 82\nVALUE_83 = 83\nVALUE_84 = 84\nVALUE_85 = 85\nVALUE_86 = 86\nVALUE_87 = 87\nVALUE_88 = 88\nVALUE_89 = 89\nVALUE_90 = 90\nVALUE_91 = 91\nVALUE_92 = 92\nVALUE_93 = 93\nVALUE_94 = 94\nVALUE_95 = 95\nVALUE_96 = 96\nVALUE_97 = 97\nVALUE_98 = 98\nVALUE_99 = 99\nVALUE_100 = 100\nVALUE_101 = 101\nVALUE_102 = 102\nVALUE_103 = 103\nVALUE_104 = 104\nVALUE_105 = 105\nVALUE_106 = 106\nVALUE_107 = 107\nVALUE_108 = 108\nVALUE_109 = 109\nVALUE_110 = 110\nVALUE_111 = 111\nVALUE_112 = 112\nVALUE_113 = 113\nVALUE_114 = 114\nVALUE_115 = 115\nVALUE_116 = 116\nVALUE_117 = 117\nVALUE_118 = 118\nVALUE_119 = 119\nVALUE_120 = 120\nVALUE_121 = 121\nVALUE_122 = 122\nVALUE_123 = 123\nVALUE_124 = 124\nVALUE_125 = 125\nVALUE_126 = 126\nVALUE_127 = 127\nVALUE_128 = 128\nVALUE_129 = 129\nVALUE_130 = 130\nVALUE_131 = 131\nVALUE_132 = 132\nVALUE_133 = 133\nVALUE_134 = 134\nVALUE_135 = 135\nVALUE_136 = 136\nVALUE_137 = 137\nVALUE_138 = 138\nVALUE_139 = 139\nVALUE_140 = 140\nVALUE_141 = 141\nVALUE_142 = 142\nVALUE_143 = 143\nVALUE_144 = 144\nVALUE_145 = 145\nVALUE_146 = 146\nVALUE_147 = 147\nVALUE_148 = 148\nVALUE_149 = 149\nVALUE_150 = 150\nVALUE_151 = 151\nVALUE_152 = 152\nVALUE_153 = 153\nVALUE_154 = 154\nVALUE_155 = 155\nVALUE_156 = 156\nVALUE_157 = 157\nVALUE_158 = 158\nVALUE_159 = 159\nVALUE_160 = 160\nVALUE_161 = 161\nVALUE_162 = 162\nVALUE_163 = 163\nVALUE_164 = 164\nVALUE_165 = 165\nVALUE_166 = 166\nVALUE_167 = 167\nVALUE_168 = 168\nVALUE_169 = 169\nVALUE_170 = 170\nVALUE_171 = 171\nVALUE_172 = 172\nVALUE_173 = 173\nVALUE_174 = 174\nVALUE_175 = 175\nVALUE_176 = 176\nVALUE_177 = 177\nVALUE_178 = 178\nVALUE_179 = 179\nVALUE_180 = 180\nVALUE_181 = 181\nVALUE_182 = 182\nVALUE_183 = 183\nVALUE_184 = 184\nVALUE_185 = 185\nVALUE_186 = 186\nVALUE_187 = 187\nVALUE_188 = 188\nVALUE_189 = 189\nVALUE_190 = 190\nVALUE_191 = 191\nVALUE_192 = 192\nVALUE_193 = 193\nVALUE_194 = 194\nVALUE_195 = 195\nVALUE_196 = 196\nVALUE_197 = 197\nVALUE_198 = 198\nVALUE_199 = 199\nVALUE_200 = 200\nVALUE_201 = 201\nVALUE_202 = 202\nVALUE_203 = 203\nVALUE_204 = 204\nVALUE_205 = 205\nVALUE_206 = 206\nVALUE_207 = 207\nVALUE_208 = 208\nVALUE_209 = 209\nVALUE_210 = 210\nVALUE_211 = 211\nVALUE_212 = 212\nVALUE_213 = 213\nVALUE_214 = 214\nVALUE_215 = 215\nVALUE_216 = 216\nVALUE_217 = 217\nVALUE_218 = 218\nVALUE_219 = 219\nVALUE_220 = 220\nVALUE_221 = 221\nVALUE_222 = 222\nVALUE_223 = 223\nVALUE_224 = 224\nVALUE_225 = 225\nVALUE_226 = 226\nVALUE_227 = 227\nVALUE_228 = 228\nVALUE_229 = 229\nVALUE_230 = 230\nVALUE_231 = 231\nVALUE_232 = 232\nVALUE_233 = 233\nVALUE_234 = 234\nVALUE_235 = 235\nVALUE_236 = 236\nVALUE_237 = 237\nVALUE_238 = 238\nVALUE_239 = 239\nVALUE_240 = 240\nVALUE_241 = 241\nVALUE_242 = 242\nVALUE_243 = 243\nVALUE_244 = 244\nVALUE_245 = 245\nVALUE_246 = 246\nVALUE_247 = 247\nVALUE_248 = 248\nVALUE_249 = 249\nVALUE_250 = 250\nVALUE_251 = 251\nVALUE_252 = 252\nVALUE_253 = 253\nVALUE_254 = 254\nVALUE_255 = 255\nVALUE_256 = 256\nVALUE_257 = 257\nVALUE_258 = 258\nVALUE_259 = 259\nVALUE_260 = 260\nVALUE_261 = 261\nVALUE_262 = 262\nVALUE_263 = 263\nVALUE_264 = 264\nVALUE_265 = 265\nVALUE_266 = 266\nVALUE_267 = 267\nVALUE_268 = 268\nVALUE_269 = 269\nVALUE_270 = 270\nVALUE_271 = 271\nVALUE_272 = 272\nVALUE_273 = 273\nVALUE_274 = 274\nVALUE_275 = 275\nVALUE_276 = 276\nVALUE_277 = 277\nVALUE_278 = 278\nVALUE_279 = 279\nVALUE_280 = 280\nVALUE_281 = 281\nVALUE_282 = 282\nVALUE_283 = 283\nVALUE_284 = 284\nVALUE_285 = 285\nVALUE_286 = 286\nVALUE_287 = 287\nVALUE_288 = 288\nVALUE_289 = 289\nVALUE_290 = 290\nVALUE_291 = 291\nVALUE_292 = 292\nVALUE_293 = 293\nVALUE_294 = 294\nVALUE_295 = 295\nVALUE_296 = 296\nVALUE_297 = 297\nVALUE_298 = 298\nVALUE_299 = 299\nVALUE_300 = 300';

export const LONG_BODY =
    '    step_0 = 0\n    step_1 = 1\n    step_2 = 2\n    step_3 = 3\n    step_4 = 4\n    step_5 = 5\n    step_6 = 6\n    step_7 = 7\n    step_8 = 8\n    step_9 = 9\n    step_10 = 10\n    step_11 = 11\n    step_12 = 12\n    step_13 = 13\n    step_14 = 14\n    step_15 = 15\n    step_16 = 16\n    step_17 = 17\n    step_18 = 18\n    step_19 = 19\n    step_20 = 20\n    step_21 = 21\n    step_22 = 22\n    step_23 = 23\n    step_24 = 24\n    step_25 = 25\n    step_26 = 26\n    step_27 = 27\n    step_28 = 28\n    step_29 = 29\n    step_30 = 30\n    step_31 = 31\n    step_32 = 32\n    step_33 = 33\n    step_34 = 34\n    step_35 = 35\n    step_36 = 36\n    step_37 = 37\n    step_38 = 38\n    step_39 = 39\n    step_40 = 40\n    step_41 = 41\n    step_42 = 42\n    step_43 = 43\n    step_44 = 44\n    step_45 = 45\n    step_46 = 46\n    step_47 = 47\n    step_48 = 48\n    step_49 = 49\n    step_50 = 50\n    step_51 = 51\n    step_52 = 52\n    step_53 = 53\n    step_54 = 54\n    step_55 = 55\n    step_56 = 56\n    step_57 = 57\n    step_58 = 58\n    step_59 = 59\n    step_60 = 60';

/** Defects, expected findings, and explicit corrections. */
export const CASES: FindingCase[] = [
    {
        check: 'python/file-lines',
        files: { 'example/big.py': `"""A test module."""\n\n\n${LONG_FILE}\n` },
        expected: { file: 'example/big.py', rule: 'file-lines', line: 1 },
    },
    {
        check: 'python/function-lines',
        files: {
            'example/long.py': `"""A test module."""\n\n\ndef long_one() -> None:\n    """Hold many steps."""\n${LONG_BODY}\n`,
        },
        expected: { file: 'example/long.py', rule: 'function-lines', line: 4 },
    },
    {
        check: 'python/trivial-functions',
        files: {
            'example/tiny.py': `"""A test module."""\n\n\ndef tiny(value: int) -> int:\n    """Add one to a number."""\n    return value + 1\n\n\ndef caller() -> int:\n    """Call the tiny one, then do more."""\n    first = tiny(1)\n    second = first * 2\n    return second - 1\n`,
        },
        expected: { file: 'example/tiny.py', rule: 'trivial-function', line: 4 },
    },
    {
        check: 'python/trivial-functions',
        files: {
            'example/forward.py': `"""A test module."""\n\n\ndef forward(left: int, right: int) -> int:\n    """Forward to the builtin."""\n    return max(left, right)\n`,
        },
        expected: { file: 'example/forward.py', rule: 'trivial-function', line: 4 },
    },
    {
        check: 'python/placeholder-docstrings',
        files: {
            'example/empty.py': `"""A test module."""\n\n\ndef load_orders() -> None:\n    """Load orders."""\n    first = 1\n    second = first\n    third = second\n    print(third)\n`,
        },
        expected: { file: 'example/empty.py', rule: 'placeholder-docstring', line: 4 },
    },
    {
        check: 'python/private-prefix',
        files: {
            'example/leaky.py': `"""A test module."""\n\n\ndef shown() -> int:\n    """Give one."""\n    return 1\n\n\ndef hidden() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown"]\n`,
        },
        expected: { file: 'example/leaky.py', rule: 'private-prefix', line: 9 },
    },
    {
        check: 'python/private-before-public',
        files: {
            'example/order.py': `"""A test module."""\n\n\ndef shown() -> int:\n    """Give one."""\n    return _part()\n\n\ndef _part() -> int:\n    """Give one part."""\n    return 1\n`,
        },
        expected: { file: 'example/order.py', rule: 'private-before-public', line: 9 },
    },
    {
        check: 'python/exports-at-bottom',
        files: {
            'example/top.py': `"""A test module."""\n\n\n__all__ = ["shown"]\n\n\ndef shown() -> int:\n    """Give one."""\n    return 1\n`,
        },
        expected: { file: 'example/top.py', rule: 'exports-at-bottom', line: 4 },
    },
    {
        check: 'python/import-comments',
        files: {
            'example/noted.py': `"""A test module."""\n\nimport os\n# the path tools\nimport sys\n\nVALUE = [os.sep, sys.prefix]\n`,
        },
        expected: { file: 'example/noted.py', rule: 'import-comment', line: 4 },
    },
    {
        check: 'python/export-order',
        files: {
            'example/listed.py': `"""A test module."""\n\n\ndef shown() -> int:\n    """Give one."""\n    return 1\n\n\ndef ab() -> int:\n    """Give two."""\n    return 2\n\n\n__all__ = ["shown", "ab"]\n`,
        },
        expected: { file: 'example/listed.py', rule: 'export-order', line: 14 },
    },
    {
        check: 'python/lazy-exports',
        files: {
            'example/lazy.py': `"""A test module."""\n\n\ndef __getattr__(name: str) -> int:\n    """Make names appear."""\n    return len(name)\n`,
        },
        expected: { file: 'example/lazy.py', rule: 'lazy-export', line: 4 },
    },
    {
        check: 'python/package-exports',
        files: { 'example/__init__.py': `"""A test module."""\n\n\n__all__ = ["a", "b", "c"]\n` },
        policy: '[limits.python]\npackage_exports = 2\n',
        expected: { file: 'example/__init__.py', rule: 'package-exports', line: 4 },
    },
    {
        check: 'python/singletons',
        files: {
            'example/shared.py': `"""A test module."""\n\n\nclass Store:\n    """Holds things."""\n\n\nstore = Store()\n`,
        },
        expected: { file: 'example/shared.py', rule: 'singleton', line: 8 },
    },
];
