import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BasePassword from '~/components/base/BasePassword.vue'

describe('BasePassword', () => {
  it('renders with password type initially', () => {
    const wrapper = mount(BasePassword, {
      props: {
        modelValue: 'secret123',
        label: 'Password',
        name: 'password'
      }
    })
    expect(wrapper.text()).toContain('Password')
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('type')).toBe('password')
  })

  it('toggles password visibility when toggle button is clicked', async () => {
    const wrapper = mount(BasePassword, {
      props: {
        modelValue: 'secret123',
        label: 'Password',
        name: 'password'
      }
    })
    const toggleButton = wrapper.find('button')
    expect(toggleButton.exists()).toBe(true)

    await toggleButton.trigger('click')
    const input = wrapper.find('input')
    expect(input.attributes('type')).toBe('text')
  })
})
