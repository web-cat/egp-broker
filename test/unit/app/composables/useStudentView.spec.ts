import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

import { useStudentView } from '../../../../app/composables/features/useStudentView'

const stateMap = new Map<string, any>()
vi.stubGlobal('useState', (key: string, init: () => any) => {
  if (!stateMap.has(key)) {
    stateMap.set(key, ref(init()))
  }
  return stateMap.get(key)
})

describe('useStudentView', () => {
  beforeEach(() => {
    stateMap.clear()
  })

  it('initializes with isStudentView false', () => {
    const { isStudentView } = useStudentView()
    expect(isStudentView.value).toBe(false)
  })

  it('enters, exits, and toggles student view', () => {
    const { isStudentView, enterStudentView, exitStudentView, toggleStudentView } = useStudentView()

    expect(isStudentView.value).toBe(false)

    enterStudentView()
    expect(isStudentView.value).toBe(true)

    exitStudentView()
    expect(isStudentView.value).toBe(false)

    toggleStudentView()
    expect(isStudentView.value).toBe(true)

    toggleStudentView()
    expect(isStudentView.value).toBe(false)
  })
})
