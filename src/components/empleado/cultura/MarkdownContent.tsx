// ─────────────────────────────────────────────
// Renderer simple de Markdown
// ─────────────────────────────────────────────

export function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n')

  const renderInline = (raw: string): React.ReactNode => {
    const parts = raw.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i} className="text-gray-800 font-semibold">{part.slice(2, -2)}</strong>
        : part
    )
  }

  const elements: React.ReactNode[] = []
  let listItems: React.ReactNode[] = []
  let key = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="space-y-1.5 my-3">
          {listItems}
        </ul>
      )
      listItems = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      continue
    }
    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={key++} className="text-sm font-bold text-gray-900 mt-4 mb-1.5">
          {renderInline(trimmed.slice(4))}
        </h3>
      )
    } else if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h2 key={key++} className="text-base font-bold text-gray-900 mt-5 mb-2">
          {renderInline(trimmed.slice(3))}
        </h2>
      )
    } else if (trimmed.startsWith('# ')) {
      flushList()
      elements.push(
        <h1 key={key++} className="text-base font-bold text-gray-900 mt-5 mb-2">
          {renderInline(trimmed.slice(2))}
        </h1>
      )
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(
        <li key={key++} className="flex items-start gap-2 text-gray-600">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
          <span>{renderInline(trimmed.slice(2))}</span>
        </li>
      )
    } else {
      flushList()
      elements.push(
        <p key={key++} className="text-gray-600 leading-relaxed">
          {renderInline(trimmed)}
        </p>
      )
    }
  }
  flushList()

  return <div className="text-sm space-y-1">{elements}</div>
}
