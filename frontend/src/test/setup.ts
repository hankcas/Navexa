import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom does not implement scrolling; every real browser does.
Element.prototype.scrollIntoView = vi.fn()

afterEach(() => {
  cleanup()
  vi.mocked(Element.prototype.scrollIntoView).mockClear()
})
