import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseTextarea from '~/components/base/BaseTextarea.vue'

describe('BaseTextarea', () => {
  it('renders textarea with label and placeholder', () => {
    const wrapper = mount(BaseTextarea, {
      props: {
        modelValue: 'Some notes',
        label: 'Notes',
        name: 'notes',
        placeholder: 'Write notes here...'
      }
    })
    expect(wrapper.text()).toContain('Notes')
    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect(textarea.attributes('placeholder')).toBe('Write notes here...')
  })

  it('emits update:modelValue on text input', async () => {
    const wrapper = mount(BaseTextarea, {
      props: {
        modelValue: '',
        label: 'Description',
        name: 'description'
      }
    })
    const textarea = wrapper.find('textarea')
    await textarea.setValue('Updated description')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
  })
})
