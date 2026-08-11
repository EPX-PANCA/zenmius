module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true
  },
  extends: [
    '@electron-toolkit/eslint-config-ts',
    'plugin:react/recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  settings: {
    react: {
      version: 'detect'
    }
  },
  ignorePatterns: ['build/**', 'dist/**', 'graphify-out/**', 'node_modules/**', 'out/**'],
  overrides: [
    {
      files: ['*.js', '*.cjs'],
      parserOptions: {
        sourceType: 'commonjs'
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off'
  }
}
