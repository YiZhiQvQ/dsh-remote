/**
 * Ambient declarations for the browser shell this plugin plugs into. Only the
 * members this plugin actually touches are declared, so the checker keeps its
 * value instead of being satisfied by a permissive `any`.
 */

declare module '*.css' {
  const content: string
  export default content
}

interface DshModuleLoader {
  load(options: { id: string, factory: (require: (specifier: string) => any) => unknown }): void
}

interface Window {
  /** Injected by the DSH client-modules bootstrap before any plugin runs. */
  __ModuleLoader__: DshModuleLoader
  visualViewport?: {
    height: number
    addEventListener(type: string, listener: () => void): void
    removeEventListener(type: string, listener: () => void): void
  }
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  cancelAnimationFrame?: (handle: number) => void
}

/** Host path bridge injected by the Electron preload; absent in a real browser. */
declare var __DSH_HOST_PATHS__: unknown
