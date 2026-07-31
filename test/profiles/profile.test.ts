import { describe, expect, test } from 'bun:test'

import {
  defaultName,
  dropProfile,
  parseProfiles,
  profileId,
  saveProfile
} from '../../src/profiles/profile.ts'

import type { Profile } from '../../src/profiles/profile.ts'

const remote = (name: string, target = 'kb.example.com'): Profile => ({
  kind: 'remote',
  target,
  name
})

const local = (name: string, target = '/kb'): Profile => ({
  kind: 'local',
  target,
  name
})

describe('profileId', () => {
  test('separates a local and a remote sharing a name', () => {
    expect(profileId(local('work'))).not.toBe(profileId(remote('work')))
  })

  test('ignores a remote target, so one host can hold two tokens', () => {
    expect(profileId(remote('reader'))).not.toBe(profileId(remote('writer')))
  })

  test('ignores a local name, so two folders named alike stay apart', () => {
    expect(profileId(local('kb', '/a/kb'))).not.toBe(
      profileId(local('kb', '/b/kb'))
    )
  })

  test('takes a renamed folder as the same connection', () => {
    expect(profileId(local('mine', '/a/kb'))).toBe(
      profileId(local('kb', '/a/kb'))
    )
  })
})

describe('defaultName', () => {
  test('names a remote after its host', () => {
    expect(defaultName('remote', 'kb.example.com')).toBe('kb.example.com')
  })

  test('names a folder after its last segment', () => {
    expect(defaultName('local', '/Users/me/knowledge')).toBe('knowledge')
  })

  test('handles a windows path', () => {
    expect(defaultName('local', 'C:\\Users\\me\\knowledge')).toBe('knowledge')
  })

  test('ignores a trailing separator', () => {
    expect(defaultName('local', '/Users/me/knowledge/')).toBe('knowledge')
  })
})

describe('saveProfile', () => {
  test('puts the newest first', () => {
    const list = saveProfile(saveProfile([], remote('a')), remote('b'))

    expect(list.map(item => item.name)).toEqual(['b', 'a'])
  })

  test('replaces rather than duplicates a repeated name', () => {
    const first = saveProfile([], remote('work', 'old.example.com'))
    const list = saveProfile(first, remote('work', 'new.example.com'))

    expect(list).toHaveLength(1)
    expect(list[0]?.target).toBe('new.example.com')
  })

  test('moves an existing entry back to the front', () => {
    const list = [remote('a'), remote('b'), remote('c')]

    expect(saveProfile(list, remote('c')).map(item => item.name)).toEqual([
      'c',
      'a',
      'b'
    ])
  })

  test('keeps a local entry with the same name as a remote one', () => {
    const list = saveProfile([remote('work')], local('work'))

    expect(list).toHaveLength(2)
  })

  test('keeps two folders that share a name', () => {
    const list = saveProfile([local('kb', '/a/kb')], local('kb', '/b/kb'))

    expect(list).toHaveLength(2)
  })
})

describe('dropProfile', () => {
  test('removes only the named entry', () => {
    const list = [remote('a'), remote('b')]

    expect(dropProfile(list, profileId(remote('a')))).toEqual([remote('b')])
  })

  test('leaves the list alone when nothing matches', () => {
    const list = [remote('a')]

    expect(dropProfile(list, 'remote:missing')).toEqual(list)
  })

  test('does not take the local entry with a remote id', () => {
    const list = [local('work'), remote('work')]

    expect(dropProfile(list, profileId(remote('work')))).toEqual([
      local('work')
    ])
  })
})

describe('parseProfiles', () => {
  test('reads back what was written', () => {
    const list = [remote('a'), local('b')]

    expect(parseProfiles(JSON.stringify(list))).toEqual(list)
  })

  test('returns nothing for an empty store', () => {
    expect(parseProfiles(null)).toEqual([])
  })

  test('survives a value that is not json', () => {
    expect(parseProfiles('{half-written')).toEqual([])
  })

  test('survives json that is not a list', () => {
    expect(parseProfiles('{"kind":"remote"}')).toEqual([])
  })

  test('drops entries with an unknown kind', () => {
    const stored = JSON.stringify([
      { kind: 'ssh', target: 'x', name: 'x' },
      remote('good')
    ])

    expect(parseProfiles(stored)).toEqual([remote('good')])
  })

  test('drops entries missing a field', () => {
    const stored = JSON.stringify([
      { kind: 'remote', name: 'no target' },
      { kind: 'remote', target: 'x', name: '' },
      remote('good')
    ])

    expect(parseProfiles(stored)).toEqual([remote('good')])
  })

  test('drops a null entry without throwing', () => {
    expect(parseProfiles(JSON.stringify([null, remote('good')]))).toEqual([
      remote('good')
    ])
  })
})
