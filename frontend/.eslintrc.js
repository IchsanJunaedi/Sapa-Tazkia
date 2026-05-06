// frontend/.eslintrc.js
module.exports = {
    env: {
        browser: true,
        es2022: true,
        node: true
    },
    extends: [
        'react-app',
        'react-app/jest'
    ],
    rules: {
        // No console in production frontend
        'no-console': ['warn', { allow: ['warn', 'error'] }],

        // React specific
        'react/prop-types': 'warn',
        'react/no-unused-prop-types': 'warn',
        'react-hooks/exhaustive-deps': 'warn',

        // Code quality
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'prefer-const': 'warn',
        'eqeqeq': ['warn', 'always']
    },
    overrides: [
        {
            // Test files often need patterns the strict testing-library /
            // import rules disallow (e.g. jest.mock with hoisted imports,
            // direct DOM access for icon/SVG components, container queries).
            files: ['**/*.test.{js,jsx,ts,tsx}', '**/__tests__/**/*.{js,jsx,ts,tsx}'],
            rules: {
                'import/first': 'off',
                'testing-library/no-node-access': 'off',
                'testing-library/no-container': 'off',
                'testing-library/prefer-screen-queries': 'off',
                'testing-library/no-unnecessary-act': 'off',
                'testing-library/no-wait-for-multiple-assertions': 'off',
                'testing-library/no-render-in-lifecycle': 'off',
                'react/prop-types': 'off',
                'no-unused-vars': 'off'
            }
        }
    ],
    ignorePatterns: [
        'node_modules/',
        'build/',
        'public/'
    ]
};
