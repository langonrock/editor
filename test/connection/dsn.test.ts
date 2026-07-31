import { describe, expect, test } from 'bun:test'

import {
  assertConnectable,
  buildLocalDsn,
  buildRemoteDsn,
  isLoopback
} from '../../src/connection/dsn.ts'

describe('isLoopback', () => {
  test.each(['127.0.0.1', 'localhost', '::1', '[::1]'])('accepts %p', host => {
    expect(isLoopback(host)).toBe(true)
  })

  test.each(['kb.example.com', '10.0.0.1', '127.0.0.1.evil.com', ''])(
    'rejects %p',
    host => {
      expect(isLoopback(host)).toBe(false)
    }
  )
})

describe('assertConnectable', () => {
  test('allows https anywhere', () => {
    expect(() =>
      assertConnectable('okf+https://kb.example.com?token=s')
    ).not.toThrow()
  })

  test('allows plain http only on loopback, where the token cannot leave', () => {
    expect(() =>
      assertConnectable('okf+http://127.0.0.1:7777?token=s')
    ).not.toThrow()
    expect(() =>
      assertConnectable('okf+http://localhost:7777?token=s')
    ).not.toThrow()
  })

  test('refuses a token in clear text to a remote host', () => {
    expect(() =>
      assertConnectable('okf+http://kb.example.com?token=s')
    ).toThrow('refusing to send a token in clear text')
  })

  test('refuses a store directory, which only the server can open', () => {
    expect(() => assertConnectable('okf:///var/data?tenant=acme')).toThrow(
      'only the server can open'
    )
  })

  test('refuses a unix socket, which the app window cannot reach', () => {
    expect(() =>
      assertConnectable('okf+unix:///tmp/okf.sock?tenant=a')
    ).toThrow('cannot be reached from the app window')
  })

  test('refuses a named pipe', () => {
    expect(() => assertConnectable('okf+npipe://./pipe/okf')).toThrow(
      'named pipes are not supported'
    )
  })
})

describe('buildRemoteDsn', () => {
  test('defaults a bare host to https', () => {
    expect(buildRemoteDsn('kb.example.com', 'secret')).toBe(
      'okf+https://kb.example.com?token=secret'
    )
  })

  test('keeps an explicit http, so loopback stays reachable', () => {
    expect(buildRemoteDsn('http://127.0.0.1:7777', 's')).toBe(
      'okf+http://127.0.0.1:7777?token=s'
    )
  })

  test('upgrades an explicit https and trims trailing slashes and spaces', () => {
    expect(buildRemoteDsn('  https://kb.example.com//  ', 's')).toBe(
      'okf+https://kb.example.com?token=s'
    )
  })

  test('encodes a token that would otherwise break the query', () => {
    expect(buildRemoteDsn('kb.example.com', 'a&b=c d')).toBe(
      'okf+https://kb.example.com?token=a%26b%3Dc%20d'
    )
  })

  test('produces something assertConnectable accepts', () => {
    expect(() =>
      assertConnectable(buildRemoteDsn('kb.example.com', 's'))
    ).not.toThrow()
  })
})

describe('buildLocalDsn', () => {
  test('is always loopback, and therefore always allowed', () => {
    const dsn = buildLocalDsn(54321, 'generated')

    expect(dsn).toBe('okf+http://127.0.0.1:54321?token=generated')
    expect(() => assertConnectable(dsn)).not.toThrow()
  })
})
