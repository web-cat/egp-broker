import { describe, it, expect, vi } from 'vitest'
import { logger } from '@@/server/utils/logger.helpers'

describe('Logger', () => {
  it('logs info, warn, and error messages without crashing', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    logger.info('Test info message', { key: 'val' })
    logger.warn('Test warn message')
    logger.error('Test error message')
    logger.debug('Test debug message')

    expect(
      logSpy.mock.calls.length + warnSpy.mock.calls.length + errorSpy.mock.calls.length
    ).toBeGreaterThan(0)

    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
