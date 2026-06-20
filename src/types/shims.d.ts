// Ambient declarations for runtime deps that ship without bundled TypeScript
// types. Declaring the module bare makes all of its imports `any`, which
// matches how this code already consumes them (behavior-preserving).
declare module 'papaparse';
declare module 'react-window';
