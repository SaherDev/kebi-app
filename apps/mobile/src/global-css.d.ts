// Side-effect CSS imports (e.g. `import './global.css'`) are processed by
// Metro + NativeWind at build time. This ambient declaration lives under src/
// so the app TS program (tsconfig.app.json, rootDir: src) resolves the import
// — the copy in nativewind-env.d.ts is only in the root tsconfig program.
declare module '*.css';
