import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseFormInput from '~/components/base/BaseFormInput.vue'

describe('BaseFormInput', () => {
  it('renders label and input', () => {
    const wrapper = mount(BaseFormInput, {
      props: {
        modelValue: 'John',
        label: 'First Name',
        name: 'firstName',
        placeholder: 'Enter first name'
      }
    })
    expect(wrapper.text()).toContain('First Name')
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
    expect(input.attributes('placeholder')).toBe('Enter first name')
  })

  it('emits update:modelValue on input change', async () => {
    const wrapper = mount(BaseFormInput, {
      props: {
        modelValue: '',
        label: 'Username',
        name: 'username'
      }
    })
    const input = wrapper.find('input')
    await input.setValue('newuser')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  })
})
