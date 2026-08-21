import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseInput from '~/components/base/BaseInput.vue'

describe('BaseInput', () => {
  it('renders input element with bound attributes', () => {
    const wrapper = mount(BaseInput, {
      attrs: {
        placeholder: 'Enter your name',
        type: 'text'
      }
    })
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toBe('Enter your name')
  })

  it('renders leading and trailing slot content', () => {
    const wrapper = mount(BaseInput, {
      slots: {
        leading: '<span class="lead">Prefix</span>',
        trailing: '<span class="trail">Suffix</span>'
      }
    })
    expect(wrapper.html()).toContain('lead')
    expect(wrapper.html()).toContain('trail')
  })
})
