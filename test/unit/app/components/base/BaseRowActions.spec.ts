import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseRowActions from '~/components/base/BaseRowActions.vue'

describe('BaseRowActions', () => {
  it('renders dropdown action trigger button', () => {
    const wrapper = mount(BaseRowActions, {
      props: {
        items: [
          [
            { label: 'Edit', icon: 'i-lucide-pencil' },
            { label: 'Delete', icon: 'i-lucide-trash' }
          ]
        ]
      }
    })
    const button = wrapper.find('button')
    expect(button.exists()).toBe(true)
    expect(button.attributes('aria-label')).toBe('Row actions')
  })
})
