import reactHooks from 'eslint-plugin-react-hooks';

const composition = {
  rules: {
    'jsx-uses-vars': {
      create(context) {
        return {
          JSXOpeningElement(node) {
            const name =
              node.name.type === 'JSXMemberExpression' ? node.name.object.name : node.name.name;
            if (name && /^[A-Z]/.test(name)) context.sourceCode.markVariableAsUsed(name, node);
          },
        };
      },
    },
    'single-component': {
      create(context) {
        const components = new Set();
        return {
          ':matches(JSXElement, JSXFragment)'(node) {
            const owner = context.sourceCode
              .getAncestors(node)
              .reverse()
              .find((ancestor) => {
                if (
                  ![
                    'FunctionDeclaration',
                    'FunctionExpression',
                    'ArrowFunctionExpression',
                  ].includes(ancestor.type)
                )
                  return false;
                return (
                  ancestor.parent?.type !== 'CallExpression' ||
                  ancestor.parent.callee.property?.name !== 'map'
                );
              });
            if (owner) components.add(owner);
          },
          'Program:exit'(node) {
            if (components.size !== 1)
              context.report({
                node,
                message:
                  'Cada index.jsx debe declarar un único componente; mueve los subcomponentes a sus carpetas.',
              });
          },
        };
      },
    },
    'single-utility': {
      create(context) {
        return {
          Program(node) {
            const declarations = node.body.map((item) => item.declaration || item);
            const functions = declarations.filter(
              (item) =>
                item.type === 'FunctionDeclaration' ||
                (item.type === 'VariableDeclaration' &&
                  item.declarations.some((declaration) =>
                    ['ArrowFunctionExpression', 'FunctionExpression'].includes(
                      declaration.init?.type,
                    ),
                  )),
            );
            if (functions.length !== 1)
              context.report({
                node,
                message: 'Cada archivo de utils contiene una única función.',
              });
          },
        };
      },
    },
    'translated-text': {
      create(context) {
        return {
          JSXText(node) {
            if (/[\p{L}\p{N}]/u.test(node.value))
              context.report({ node, message: 'Los textos de interfaz deben pasar por i18n.' });
          },
          JSXAttribute(node) {
            if (
              ['aria-label', 'title', 'placeholder', 'alt'].includes(node.name.name) &&
              node.value?.type === 'Literal' &&
              node.value.value
            )
              context.report({
                node,
                message: 'Las etiquetas accesibles y textos de ayuda deben pasar por i18n.',
              });
          },
        };
      },
    },
  },
};

const asynchronousRules = [
  {
    selector: 'VariableDeclaration[kind="let"]',
    message: 'Usa const y devuelve el resultado del cálculo o agrupa el estado de la operación.',
  },
  {
    selector:
      'CallExpression[callee.type="MemberExpression"][callee.property.name=/^(then|catch|finally)$/]',
    message: 'Usa async/await y try/catch/finally.',
  },
];

const backendModuleRules = ['azure'].flatMap((provider) => {
  const boundaries = [
    {
      group: ['react', 'react/*', 'next', 'next/*'],
      message: 'Los módulos del backend no dependen de React ni de Next.js.',
    },
  ];
  const dataOnly = {
    group: ['**/repositories/**', '**/services/**', '**/db.mjs', 'pg'],
    message: 'Storage y normalización no dependen de persistencia ni servicios.',
  };
  return [
    {
      files: [`server/modules/${provider}/**/*.mjs`],
      rules: { 'no-restricted-imports': ['error', { patterns: boundaries }] },
    },
    {
      files: [`server/modules/${provider}/storage/**/*.mjs`],
      rules: { 'no-restricted-imports': ['error', { patterns: [...boundaries, dataOnly] }] },
    },
    {
      files: [`server/modules/${provider}/normalization/**/*.mjs`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              ...boundaries,
              dataOnly,
              {
                group: [
                  '@azure/*',
                  '**/storage/**',
                  'node:fs',
                  'node:fs/promises',
                  'node:http',
                  'node:https',
                  'node:process',
                ],
                message: 'La normalización recibe datos y no realiza I/O ni usa SDK.',
              },
            ],
          },
        ],
      },
    },
    {
      files: [`server/modules/${provider}/repositories/**/*.mjs`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              ...boundaries,
              {
                group: ['@azure/*', '**/storage/**', '**/services/**'],
                message: 'Los repositorios contienen persistencia, sin SDK ni orquestación.',
              },
            ],
          },
        ],
      },
    },
  ];
});

export default [
  { ignores: ['vendor/**', 'node_modules/**', '.next/**', 'dist/**', '_site/**', '.local-dev/**'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { composition },
    rules: {
      'no-nested-ternary': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'composition/jsx-uses-vars': 'error',
      'no-restricted-syntax': ['error', ...asynchronousRules],
    },
  },
  { files: ['src/**/index.jsx'], rules: { 'composition/single-component': 'error' } },
  ...backendModuleRules,
  {
    files: ['app/api/**/route.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/repositories/**',
                '**/providers/**',
                '**/storage/**',
                '**/normalization/**',
                '**/db.mjs',
              ],
              message: 'Los Route Handlers usan servicios y no SDK o repositorios directamente.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'server/db.mjs',
      'server/config.mjs',
      'server/database/**/*.mjs',
      'server/logging/**/*.mjs',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/modules/**', '@azure/*'],
              message: 'La infraestructura común no depende de los módulos cloud.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/utils/*.js', 'server/**/utils/*.mjs'],
    rules: { 'composition/single-utility': 'error' },
  },
  {
    files: ['src/**/*.{js,jsx}', 'app/**/*.jsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'composition/translated-text': 'error',
    },
  },
  {
    files: ['src/**/*.jsx', 'src/**/hooks/*.js', 'app/**/*.jsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...asynchronousRules,
        {
          selector: 'CallExpression[callee.name="fetch"]',
          message: 'Las llamadas HTTP pertenecen a los servicios API.',
        },
      ],
    },
  },
  {
    files: ['src/core/**/*.js'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'react',
            'react/*',
            'next',
            'next/*',
            '**/features/**',
            '**/components/**',
            '**/hooks/**',
            '**/api/**',
          ],
        },
      ],
    },
  },
];
