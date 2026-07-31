interface Props {
  writable: boolean
  stale: boolean
  notice?: string | undefined
  onReload: () => void
  onDismiss: () => void
}

export function Banners({
  writable,
  stale,
  notice,
  onReload,
  onDismiss
}: Props) {
  return (
    <>
      {writable ? null : (
        <p className="banner">
          This connection is read only, so nothing here can be saved.
        </p>
      )}
      {stale ? (
        <p className="banner">
          The store changed on disk.{' '}
          <button type="button" onClick={onReload}>
            Reload
          </button>
        </p>
      ) : null}
      {notice === undefined ? null : (
        <p className="banner notice" onClick={onDismiss}>
          {notice}
        </p>
      )}
    </>
  )
}
