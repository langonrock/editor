import { afterEach, describe, expect, test } from 'bun:test'

import { installOkfFetch } from '../../src/connection/fetch.ts'

let restore: (() => void) | undefined

afterEach(() => {
  restore?.()
  restore = undefined
})

function href(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  return input instanceof URL ? input.href : input.url
}

function recorder() {
  const seen: string[] = []
  const backend = ((input: RequestInfo | URL) => {
    seen.push(href(input))

    return Promise.resolve(new Response('from backend'))
  }) as typeof globalThis.fetch

  return { seen, backend }
}

describe('installOkfFetch', () => {
  test('sends absolute http and https through the backend', async () => {
    const { seen, backend } = recorder()

    restore = installOkfFetch(backend)

    await fetch('http://127.0.0.1:7777/v1/snapshot')
    await fetch('https://kb.example.com/v1/snapshot')

    expect(seen).toEqual([
      'http://127.0.0.1:7777/v1/snapshot',
      'https://kb.example.com/v1/snapshot'
    ])
  })

  test('leaves relative requests to the native fetch', async () => {
    const { seen, backend } = recorder()
    const native = globalThis.fetch
    let nativeCalls = 0

    globalThis.fetch = ((input: RequestInfo | URL) => {
      nativeCalls += 1

      return Promise.resolve(new Response(String(input)))
    }) as typeof globalThis.fetch

    const undo = installOkfFetch(backend)

    await fetch('/src/main.tsx')

    undo()
    globalThis.fetch = native

    expect(seen).toEqual([])
    expect(nativeCalls).toBe(1)
  })

  test('reads the url out of a URL and a Request too', async () => {
    const { seen, backend } = recorder()

    restore = installOkfFetch(backend)

    await fetch(new URL('https://kb.example.com/v1/manifest'))
    await fetch(
      new Request('https://kb.example.com/v1/get', { method: 'POST' })
    )

    expect(seen).toEqual([
      'https://kb.example.com/v1/manifest',
      'https://kb.example.com/v1/get'
    ])
  })

  test('passes init through untouched, since the write headers ride on it', async () => {
    let received: RequestInit | undefined
    const backend = ((_input: RequestInfo | URL, init?: RequestInit) => {
      received = init

      return Promise.resolve(new Response(null, { status: 204 }))
    }) as typeof globalThis.fetch

    restore = installOkfFetch(backend)

    await fetch('https://kb.example.com/v1/source/sales/a.md', {
      method: 'PUT',
      headers: { 'if-match': '"abc"', authorization: 'Bearer s' },
      body: 'x'
    })

    expect(received?.method).toBe('PUT')
    expect(received?.headers).toEqual({
      'if-match': '"abc"',
      authorization: 'Bearer s'
    })
  })

  test('restores the previous fetch exactly', () => {
    const before = globalThis.fetch
    const undo = installOkfFetch(recorder().backend)

    expect(globalThis.fetch).not.toBe(before)
    undo()
    expect(globalThis.fetch).toBe(before)
  })
})
