/**
 * The slice of DSH's filesystem service this plugin calls.
 *
 * The service is sandbox-policy aware: `resolve` maps a requested path onto a
 * permitted physical path and `stat` reports the type and size. Declaring the
 * contract here is what lets the download route stay testable with a small fake.
 */
interface DshFsTarget {
  displayPath?: string
}

interface DshFsStat {
  type: 'file' | 'directory' | 'other'
  size?: number
  mtimeMs?: number
}

interface DshFs {
  resolve(path: string, options?: { signal?: AbortSignal }): Promise<DshFsTarget>
  stat(target: DshFsTarget, signal?: AbortSignal): Promise<DshFsStat | undefined>
}
