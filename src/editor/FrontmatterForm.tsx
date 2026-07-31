import { parseFrontmatter, updateFrontmatter } from '../okf/frontmatter.ts'

/** The four the compiler keeps, plus the one every OKF bundle carries. */
const FIELDS = [
  { key: 'type', label: 'Type', hint: 'required by OKF' },
  { key: 'title', label: 'Title', hint: '' },
  { key: 'description', label: 'Description', hint: 'becomes the summary' },
  { key: 'grain', label: 'Grain', hint: '' },
  { key: 'status', label: 'Status', hint: 'shown only when not current' }
] as const

interface Props {
  source: string
  readOnly: boolean
  onChange: (source: string) => void
}

function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Edits go through `updateFrontmatter`, which touches one key and leaves the
 * rest of the document exactly as written. Anything this form does not show,
 * including `tags` and nested `sources`, therefore survives untouched with its
 * comments and ordering intact.
 */
export function FrontmatterForm({ source, readOnly, onChange }: Props) {
  const { data, error } = parseFrontmatter(source)

  if (error !== undefined) {
    return <p className="warn">{error}</p>
  }

  return (
    <div className="frontmatter">
      {FIELDS.map(field => (
        <label key={field.key}>
          <span>
            {field.label}
            {field.hint === '' ? null : <em>{field.hint}</em>}
          </span>
          <input
            value={textOf(data[field.key])}
            disabled={readOnly}
            onChange={event =>
              onChange(
                updateFrontmatter(source, {
                  [field.key]:
                    event.target.value === '' ? undefined : event.target.value
                })
              )
            }
          />
        </label>
      ))}
    </div>
  )
}
