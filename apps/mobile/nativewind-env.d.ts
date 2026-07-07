/**
 * NativeWind v4 global type augmentations.
 *
 * NativeWind v4 relies on react-native-css-interop to add className to RN
 * component props, but that package is in pnpm's virtual store and is not
 * directly resolvable as a TypeScript module reference.  We inline the
 * relevant augmentations here.
 *
 * CSS side-effect imports (import './global.css') are handled by Metro at
 * build time; this empty declaration keeps TypeScript happy.
 */

// Make this file a module so that the react-native block below is a proper
// module augmentation (not an ambient override that shadows the real types).
export {};

// CSS side-effect imports -- Metro processes them; TS just needs the type.
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// Add className (and related NativeWind props) to React Native components.
declare module 'react-native' {
  interface ViewProps {
    className?: string;
    cssInterop?: boolean;
  }
  interface TextProps {
    className?: string;
    cssInterop?: boolean;
  }
  interface TextInputProps {
    className?: string;
    placeholderClassName?: string;
    cssInterop?: boolean;
  }
  interface ImagePropsBase {
    className?: string;
    cssInterop?: boolean;
  }
  interface SwitchProps {
    className?: string;
    cssInterop?: boolean;
  }
  interface ScrollViewProps {
    className?: string;
    contentContainerClassName?: string;
    cssInterop?: boolean;
  }
  interface TouchableOpacityProps {
    className?: string;
    cssInterop?: boolean;
  }
  interface PressableProps {
    className?: string;
    cssInterop?: boolean;
  }
}
