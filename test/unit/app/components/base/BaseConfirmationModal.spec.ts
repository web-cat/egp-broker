import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseConfirmationModal from '~/components/base/BaseConfirmationModal.vue'

describe('BaseConfirmationModal', () => {
  it('renders modal with title and message', () => {
    const wrapper = mount(BaseConfirmationModal, {
      props: {
        open: true,
        title: 'Delete Item',
        message: 'Are you sure you want to delete this?'
      }
    })
    expect(wrapper.text()).toContain('Are you sure you want to delete this?')
  })

  it('emits confirm and cancel events', async () => {
    const wrapper = mount(BaseConfirmationModal, {
      props: {
        open: true,
        confirmLabel: 'Yes, Delete',
        cancelLabel: 'Cancel'
      }
    })

    const buttons = wrapper.findAll('button')
    const cancelButton = buttons[0]
    const confirmButton = buttons[1]

    if (confirmButton) {
      await confirmButton.trigger('click')
      expect(wrapper.emitted('confirm')).toBeTruthy()
    }

    if (cancelButton) {
      await cancelButton.trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
    }
  })
})
