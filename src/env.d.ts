/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare global {
  const __APP_VERSION__: string;
}

declare module 'svelte/elements' {
  interface HTMLInputAttributes {
    /** Safari 17.4+ native switch control */
    switch?: boolean | '' | null;
  }
}

export {};
