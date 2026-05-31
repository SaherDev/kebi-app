// jest.mock() calls must be at the top of test files so babel-plugin-jest-hoist
// can safely move them before the imports.

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('@expo-google-fonts/inter', () => ({
  Inter_400Regular:   'Inter_400Regular',
  Inter_500Medium:    'Inter_500Medium',
  Inter_600SemiBold:  'Inter_600SemiBold',
  Inter_700Bold:      'Inter_700Bold',
  Inter_800ExtraBold: 'Inter_800ExtraBold',
  useFonts: () => [true, null],
}));

jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(undefined),
  isLoaded: jest.fn().mockReturnValue(true),
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(undefined),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({
    colorScheme: 'light',
    setColorScheme: jest.fn(),
    toggleColorScheme: jest.fn(),
  }),
  cssInterop:  (c: unknown) => c,
  remapProps:  (c: unknown) => c,
  vars:        (v: unknown) => v,
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────
// eslint-disable-next-line import/first -- jest.mock() calls above must precede imports for babel-plugin-jest-hoist hoisting
import * as React from 'react';
// eslint-disable-next-line import/first -- see above
import { render } from '@testing-library/react-native';
// eslint-disable-next-line import/first -- see above
import App from './App';

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('App (A2 token-preview)', () => {
  it('renders the token-preview screen', () => {
    const { getByText } = render(<App />);
    expect(getByText('kebi tokens')).toBeTruthy();
  });

  it('renders all section headers', () => {
    const { getByText } = render(<App />);
    expect(getByText('01 · canvas')).toBeTruthy();
    expect(getByText('02 · text')).toBeTruthy();
    expect(getByText('03 · semantic')).toBeTruthy();
    expect(getByText('04 · pills')).toBeTruthy();
    expect(getByText('05 · type scale')).toBeTruthy();
    expect(getByText('06 · spacing (fixed scale only)')).toBeTruthy();
    expect(getByText('07 · radius')).toBeTruthy();
    expect(getByText('08 · buttons')).toBeTruthy();
  });
});
