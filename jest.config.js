const path = require('path');
const jp = path.dirname(require.resolve('@react-native/jest-preset/package.json'));
const pnp = path.dirname(require.resolve('react-native/package.json'));

const allowPkgs = [
  'react-native', '@react-native', 'expo', '@expo', 'nanoid',
  'react-native-web', 'react-native-safe-area-context', 'react-native-screens',
  'react-native-gesture-handler', 'react-native-reanimated',
  'react-native-get-random-values', 'expo-router', 'expo-constants',
  'expo-secure-store', 'expo-sqlite', 'expo-file-system', 'expo-linking',
  'react-native-worklets', 'react-native-gifted-chat',
  'babel-jest', 'jest-expo', '@react-native/js-polyfills',
];

module.exports = {
  projects: [{
    displayName: 'test',
    testEnvironment: 'node',
    rootDir: '.',
    roots: ['<rootDir>/__tests__'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    transform: {
      '\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.js' }],
      '\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': path.join(jp, 'jest/assetFileTransformer.js'),
    },
    moduleNameMapper: {
      '^react-native$': path.join(pnp, 'index.js'),
      '^react-native/(.*)$': path.join(pnp, ''),
      '^@expo/vector-icons$': '<rootDir>/node_modules/@expo/vector-icons',
    },
    resolver: path.join(jp, 'jest/resolver.js'),
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    transformIgnorePatterns: [
      'node_modules/(?!.pnpm|' + allowPkgs.join('|') + '/)',
    ],
    setupFiles: ['<rootDir>/__tests__/jest.setup.ts'],
  }],
};
