import { describe, it, expect, vi, afterEach } from 'vitest'

vi.stubGlobal('defineNitroPlugin', (fn: any) => fn)

describe('error-handler nitro plugin', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('silences 404 errors', async () => {
    const spy = vi.spyOn(console, 'error')
    let errorHandler: any
    const mockNitroApp = {
      hooks: {
        hook: vi.fn((hookName, handler) => {
          if (hookName === 'error') {
            errorHandler = handler
          }
        })
      }
    }

    const { default: plugin } = await import('@@/server/plugins/error-handler')
    plugin(mockNitroApp as any)

    expect(errorHandler).toBeDefined()

    const err404 = Object.assign(new Error('Not found'), { statusCode: 404 })
    await errorHandler(err404, { event: { path: '/api/some/missing' } })

    expect(spy).not.toHaveBeenCalled()
  })

  it('silences /_nuxt/ static asset errors regardless of status', async () => {
    const spy = vi.spyOn(console, 'error')
    let errorHandler: any
    const mockNitroApp = {
      hooks: {
        hook: vi.fn((hookName, handler) => {
          if (hookName === 'error') {
            errorHandler = handler
          }
        })
      }
    }

    const { default: plugin } = await import('@@/server/plugins/error-handler')
    plugin(mockNitroApp as any)

    const chunkErr = new Error('Chunk load error')
    await errorHandler(chunkErr, { event: { path: '/_nuxt/B5j-CAkF.js' } })

    expect(spy).not.toHaveBeenCalled()
  })

  it('logs other unexpected errors with full details', async () => {
    const spy = vi.spyOn(console, 'error')
    let errorHandler: any
    const mockNitroApp = {
      hooks: {
        hook: vi.fn((hookName, handler) => {
          if (hookName === 'error') {
            errorHandler = handler
          }
        })
      }
    }

    const { default: plugin } = await import('@@/server/plugins/error-handler')
    plugin(mockNitroApp as any)

    const serverErr = Object.assign(new Error('Database exploded'), { statusCode: 500 })
    await errorHandler(serverErr, { event: { path: '/api/important' } })

    expect(spy).toHaveBeenCalledWith('--- NITRO GLOBAL ERROR CATCH ---')
    expect(spy).toHaveBeenCalledWith('Path:', '/api/important')
    expect(spy).toHaveBeenCalledWith('Error Message:', 'Database exploded')
  })
})
