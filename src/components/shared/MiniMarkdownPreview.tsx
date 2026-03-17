// Componente compartido de preview markdown sin librerías externas

import React from 'react'

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          return <strong key={i} className="text-white/90 font-semibold">{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <em key={i} className="text-white/70">{part.slice(1, -1)}</em>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function MiniMarkdownPreview({ text }: { text: string }) {
  if (!text.trim()) {
    return <p className="text-white/25 text-sm italic">El preview aparecerá aquí...</p>
  }

  const lines = text.split('\n')
  const elementos: React.ReactNode[] = []
  let listBuffer: React.ReactNode[] = []

  const flushList = (key: string) => {
    if (listBuffer.length > 0) {
      elementos.push(
        <ul key={key} className="list-disc ml-4 space-y-0.5 text-sm text-white/65">
          {listBuffer}
        </ul>
      )
      listBuffer = []
    }
  }

  lines.forEach((line, i) => {
    if (line.startsWith('# ')) {
      flushList(`list-${i}`)
      elementos.push(<h2 key={i} className="text-base font-bold text-white/90 mt-3 mb-1 first:mt-0">{formatInline(line.slice(2))}</h2>)
    } else if (line.startsWith('## ')) {
      flushList(`list-${i}`)
      elementos.push(<h3 key={i} className="text-sm font-semibold text-white/80 mt-3 mb-1 first:mt-0">{formatInline(line.slice(3))}</h3>)
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuffer.push(<li key={i}>{formatInline(line.slice(2))}</li>)
    } else if (line.trim() === '') {
      flushList(`list-${i}`)
      elementos.push(<br key={i} />)
    } else {
      flushList(`list-${i}`)
      elementos.push(<p key={i} className="text-sm text-white/65 leading-relaxed">{formatInline(line)}</p>)
    }
  })

  flushList('final')
  return <div className="space-y-1">{elementos}</div>
}
