import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CourseSwitchButton from '~/components/features/course/CourseSwitchButton.vue'

const mockClearCourseContext = vi.fn()

vi.mock('~/composables/features/useCourseContext', () => ({
  useCourseContext: () => ({
    clearCourseContext: mockClearCourseContext
  })
}))

describe('CourseSwitchButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders BaseButton with changeCourse title and icon', () => {
    const wrapper = mount(CourseSwitchButton, {
      global: {
        stubs: {
          BaseButton: {
            props: ['variant', 'color', 'icon', 'title', 'loading'],
            template:
              '<button :title="title" :disabled="loading" class="base-btn"><slot /></button>'
          }
        }
      }
    })

    const btn = wrapper.find('.base-btn')
    expect(btn.exists()).toBe(true)
    expect(btn.attributes('title')).toBe('global.actions.changeCourse')
  })

  it('triggers clearCourseContext when clicked', async () => {
    mockClearCourseContext.mockResolvedValue(undefined)

    const wrapper = mount(CourseSwitchButton, {
      global: {
        stubs: {
          BaseButton: {
            props: ['variant', 'color', 'icon', 'title', 'loading'],
            template: '<button :title="title" class="base-btn"><slot /></button>'
          }
        }
      }
    })

    const btn = wrapper.find('.base-btn')
    await btn.trigger('click')

    expect(mockClearCourseContext).toHaveBeenCalledTimes(1)
  })

  it('manages loading state while clearCourseContext is pending', async () => {
    let resolveContext: () => void = () => {}
    const pendingPromise = new Promise<void>((resolve) => {
      resolveContext = resolve
    })
    mockClearCourseContext.mockReturnValue(pendingPromise)

    const wrapper = mount(CourseSwitchButton, {
      global: {
        stubs: {
          BaseButton: {
            props: ['variant', 'color', 'icon', 'title', 'loading'],
            template:
              '<button :data-loading="loading ? \'true\' : \'false\'" class="base-btn"></button>'
          }
        }
      }
    })

    const btn = wrapper.find('.base-btn')
    expect(btn.attributes('data-loading')).toBe('false')

    await btn.trigger('click')
    expect(btn.attributes('data-loading')).toBe('true')

    resolveContext()
    await wrapper.vm.$nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(btn.attributes('data-loading')).toBe('false')
  })
})
