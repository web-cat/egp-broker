import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from '~/components/base/BaseButton.vue'

describe('BaseButton', () => {
  it('renders default slot content', () => {
    const wrapper = mount(BaseButton, {
      slots: {
        default: 'Click Me'
      }
    })
    expect(wrapper.text()).toContain('Click Me')
  })

  it('renders leading and trailing slot content', () => {
    const wrapper = mount(BaseButton, {
      slots: {
        leading: '<span class="lead-icon">Icon</span>',
        default: 'Submit',
        trailing: '<span class="trail-icon">Arrow</span>'
      }
    })
    expect(wrapper.html()).toContain('lead-icon')
    expect(wrapper.html()).toContain('trail-icon')
    expect(wrapper.text()).toContain('Submit')
  })
})
