import { describe, expect, it } from 'vitest'

import tokens from './tokens.css?raw'

const AA_TEXT = 4.5
const AA_LARGE_TEXT = 3

function color(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))
  if (!match) throw new Error(`Token --${name} not found`)
  return match[1]
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

describe('palette contrast (WCAG AA)', () => {
  it.each([
    ['ink', 'white'],
    ['ink', 'lilac-100'],
    ['gray-500', 'white'],
    ['gray-700', 'lilac-100'],
    ['white', 'red-700'],
    ['white', 'red-800'],
    ['red-700', 'lilac-100'],
    ['teal-700', 'white'],
    ['teal-700', 'lilac-100'],
    ['lilac-100', 'red-950'],
    ['lilac-200', 'red-950'],
    ['white', 'teal-700'],
    ['teal-300', 'red-950'],
  ])('%s on %s reaches 4.5:1 for normal text', (text, background) => {
    expect(contrast(color(text), color(background))).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('white on the brand red only reaches the large text threshold', () => {
    const ratio = contrast(color('white'), color('red-500'))
    expect(ratio).toBeGreaterThanOrEqual(AA_LARGE_TEXT)
    expect(ratio).toBeLessThan(AA_TEXT)
  })
})
