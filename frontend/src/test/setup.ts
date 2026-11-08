import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom does not implement scrolling; every real browser does.
Element.prototype.scrollIntoView = vi.fn()

// jsdom may lack the modal API of <dialog>; real browsers have it.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false
  }
}

afterEach(() => {
  cleanup()
  vi.mocked(Element.prototype.scrollIntoView).mockClear()
})
