import { vi } from 'vitest'
import { ref, reactive, computed, watch, watchEffect, onMounted, onUnmounted, nextTick } from 'vue'
import { config } from '@vue/test-utils'

import BaseInput from '~/components/base/BaseInput.vue'
import BaseButton from '~/components/base/BaseButton.vue'
import BaseFormInput from '~/components/base/BaseFormInput.vue'
import BaseCard from '~/components/base/BaseCard.vue'
import BaseTextarea from '~/components/base/BaseTextarea.vue'
import BaseEmail from '~/components/base/BaseEmail.vue'
import BasePassword from '~/components/base/BasePassword.vue'
import BaseConfirmationModal from '~/components/base/BaseConfirmationModal.vue'
import BaseRowActions from '~/components/base/BaseRowActions.vue'
import BaseDataTable from '~/components/base/BaseDataTable.vue'

Object.assign(global, {
  ref,
  reactive,
  computed,
  watch,
  watchEffect,
  onMounted,
  onUnmounted,
  nextTick
})

// Mock console.warn to suppress Vue warnings during tests
const originalWarn = console.warn

console.warn = (message: string, ...args: any[]) => {
  if (
    typeof message === 'string' &&
    (message.includes('injection "Symbol(nuxt-ui.') ||
      message.includes('Symbol(nuxt-ui.') ||
      message.includes('Missing required prop:') ||
      message.includes('Failed to resolve component: U'))
  ) {
    return
  }
  originalWarn(message, ...args)
}

// Global stubs for Nuxt UI presenter components in unit tests
config.global.stubs = {
  UButton: {
    template: '<button><slot name="leading" /><slot /><slot name="trailing" /></button>'
  },
  UCard: {
    template: '<div><slot name="header" /><slot /><slot name="footer" /></div>'
  },
  UInput: {
    template:
      '<div><slot name="leading" /><input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" v-bind="$attrs" /><slot name="trailing" /></div>',
    props: ['modelValue'],
    emits: ['update:modelValue']
  },
  UFormField: {
    template: '<div><label>{{ label }}</label><slot /><slot name="error" :error="error" /></div>',
    props: ['label', 'error', 'name', 'required']
  },
  UTextarea: {
    template:
      '<textarea :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" v-bind="$attrs" />',
    props: ['modelValue'],
    emits: ['update:modelValue']
  },
  UModal: {
    template:
      '<div v-if="open"><div class="modal-body"><slot name="body"><slot /></slot></div><div class="modal-footer"><slot name="footer" /></div></div>',
    props: ['open', 'title', 'description']
  },
  UDropdownMenu: {
    template: '<div><slot /></div>',
    props: ['items']
  },
  UIcon: {
    template: '<span class="icon" :data-icon="name" />',
    props: ['name']
  },
  UTable: {
    template: '<table><slot /></table>',
    props: ['data', 'columns', 'loading', 'meta']
  },
  UPagination: {
    template: '<nav><slot /></nav>',
    props: ['page', 'itemsPerPage', 'total']
  },
  NuxtLink: {
    template: '<a><slot /></a>',
    props: ['to']
  }
}

config.global.components = {
  BaseInput,
  BaseButton,
  BaseFormInput,
  BaseCard,
  BaseTextarea,
  BaseEmail,
  BasePassword,
  BaseConfirmationModal,
  BaseRowActions,
  BaseDataTable
}

// Global mocks for all tests using standard vi.mock
vi.mock('#app', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref('fr'),
    locales: ref([
      { code: 'fr', name: 'Français' },
      { code: 'en', name: 'English' }
    ]),
    setLocale: vi.fn(),
    switchLocalePath: vi.fn((path: string) => path)
  }),
  useColorMode: () => ({
    value: 'light',
    preference: 'light',
    system: 'light',
    unknown: false
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    beforeEach: vi.fn(),
    afterEach: vi.fn(),
    beforeResolve: vi.fn(),
    onError: vi.fn(),
    isReady: vi.fn(() => Promise.resolve()),
    currentRoute: ref({
      path: '/',
      name: 'index',
      params: {},
      query: {},
      meta: {}
    })
  }),
  useRoute: () =>
    reactive({
      path: '/',
      name: 'index',
      params: {},
      query: {},
      meta: {}
    })
}))

// Mock Nuxt auto-imports as globals
global.useI18n = () => ({
  t: (key: string) => key,
  locale: ref('fr'),
  locales: ref([
    { code: 'fr', name: 'Français' },
    { code: 'en', name: 'English' }
  ]),
  setLocale: vi.fn(),
  switchLocalePath: vi.fn((path: string) => path)
})

global.useColorMode = () => ({
  value: 'light',
  preference: 'light',
  system: 'light',
  unknown: false
})

global.useRouter = () => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  beforeEach: vi.fn(),
  afterEach: vi.fn(),
  beforeResolve: vi.fn(),
  onError: vi.fn(),
  isReady: vi.fn(() => Promise.resolve()),
  currentRoute: ref({
    path: '/',
    name: 'index',
    params: {},
    query: {},
    meta: {}
  })
})

global.useRoute = () =>
  reactive({
    path: '/',
    name: 'index',
    params: {},
    query: {},
    meta: {}
  })
