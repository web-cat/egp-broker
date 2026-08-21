import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseCard from '~/components/base/BaseCard.vue'

describe('BaseCard', () => {
  it('renders default body slot', () => {
    const wrapper = mount(BaseCard, {
      slots: {
        default: '<p>Card Body Content</p>'
      }
    })
    expect(wrapper.text()).toContain('Card Body Content')
  })

  it('renders header and footer slots when provided', () => {
    const wrapper = mount(BaseCard, {
      slots: {
        header: '<h2>Card Header</h2>',
        default: '<p>Body</p>',
        footer: '<button>Card Footer Action</button>'
      }
    })
    expect(wrapper.text()).toContain('Card Header')
    expect(wrapper.text()).toContain('Body')
    expect(wrapper.text()).toContain('Card Footer Action')
  })

  it('applies interactive styling classes when interactive prop is true', () => {
    const wrapper = mount(BaseCard, {
      props: {
        interactive: true
      }
    })
    expect(wrapper.classes()).toContain('cursor-pointer')
  })
})
