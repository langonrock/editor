import { describe, expect, test } from 'bun:test'

import { classify, explain, statusOf } from '../../src/connection/errors.ts'

import type { FailureKind } from '../../src/connection/errors.ts'

// The literal shapes langonrock's assertOk produces, message text included.
// These are the contract: the editor recovers a status by parsing this string.
const served = (status: number, body: string) =>
  new Error(`langonrock server returned ${status}: ${body}`)

describe('statusOf', () => {
  test('recovers the status the client embedded in its message', () => {
    expect(statusOf(served(412, 'concept changed since it was read'))).toBe(412)
  })

  test('is undefined for anything that is not a server response', () => {
    expect(statusOf(new Error('fetch failed'))).toBeUndefined()
    expect(statusOf('a string')).toBeUndefined()
    expect(statusOf(undefined)).toBeUndefined()
  })

  test('does not match a status mentioned mid-message', () => {
    expect(statusOf(new Error('failed after 412 attempts'))).toBeUndefined()
  })
})

describe('classify', () => {
  test.each([
    [412, 'concept changed since it was read', 'conflict'],
    [412, 'concept already exists', 'conflict'],
    [412, 'concept does not exist', 'conflict'],
    [
      428,
      'a write needs If-Match: "<hash>" to replace',
      'missing-precondition'
    ],
    [413, 'a concept may not exceed 1000000 bytes', 'too-large'],
    [403, 'this token may read but not write', 'read-only-token'],
    [409, 'tenant "acme" has no source directory', 'read-only-store'],
    [401, 'invalid or missing bearer token', 'unauthorized'],
    [404, 'no such route', 'not-found']
  ])('maps %i to %s', (status, body, kind) => {
    const failure = classify(served(status, body))

    expect(failure.kind).toBe(kind as FailureKind)
    expect(failure.status).toBe(status)
  })

  test('keeps the server text, since some cases are worth showing raw', () => {
    expect(classify(served(428, 'a write needs If-Match')).detail).toContain(
      'a write needs If-Match'
    )
  })

  test('an unmapped status is unknown but keeps its number', () => {
    expect(classify(served(500, 'boom'))).toEqual({
      kind: 'unknown',
      status: 500,
      detail: 'langonrock server returned 500: boom'
    })
  })

  test('a transport failure has no status at all', () => {
    expect(classify(new Error('Unable to connect'))).toEqual({
      kind: 'unknown',
      detail: 'Unable to connect'
    })
  })
})

describe('explain', () => {
  test('names the editor as the culprit for a missing precondition', () => {
    expect(explain(classify(served(428, 'x')))).toContain('bug in the editor')
  })

  test('distinguishes a read-only token from a read-only store', () => {
    expect(explain(classify(served(403, 'x')))).not.toBe(
      explain(classify(served(409, 'x')))
    )
  })
})
