import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseEmail from '~/components/base/BaseEmail.vue'

describe('BaseEmail', () => {
  it('renders with email type and label', () => {
    const wrapper = mount(BaseEmail, {
      props: {
        modelValue: 'test@example.com',
        label: 'Email Address',
        name: 'email',
        placeholder: 'you@example.com'
      }
    })
    expect(wrapper.text()).toContain('Email Address')
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('type')).toBe('email')
  })
})
