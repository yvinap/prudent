import { useState } from 'react'
import { Box, Text, UnstyledButton } from '@mantine/core'

// ─── Category definitions ──────────────────────────────────────────────
const CATEGORIES = [
  { id: 'food',          label: 'Food',         icon: '🍔', color: '#f97316', bg: '#2d1a0e', border: '#7c2d12' },
  { id: 'coffee',        label: 'Coffee',        icon: '☕', color: '#d97706', bg: '#291d0c', border: '#78350f' },
  { id: 'transport',     label: 'Transport',     icon: '🚌', color: '#60a5fa', bg: '#0e1e2d', border: '#1e3a5f' },
  { id: 'groceries',     label: 'Groceries',     icon: '🛒', color: '#4ade80', bg: '#0d2018', border: '#166534' },
  { id: 'bills',         label: 'Bills',         icon: '⚡', color: '#facc15', bg: '#201c0a', border: '#713f12' },
  { id: 'entertainment', label: 'Fun',           icon: '🎬', color: '#c084fc', bg: '#1b0d2e', border: '#4a1d96' },
  { id: 'health',        label: 'Health',        icon: '💊', color: '#f472b6', bg: '#2d0b1e', border: '#831843' },
  { id: 'shopping',      label: 'Shopping',      icon: '🛍️', color: '#38bdf8', bg: '#0b1f2d', border: '#0c4a6e' },
  { id: 'other',         label: 'Other',         icon: '📌', color: '#94a3b8', bg: '#141826', border: '#2d2d4a' },
]

// ─── Numpad layout ──────────────────────────────────────────────────────
const PAD_KEYS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', '⌫'],
]

export default function QuickAddScreen({ onBack, onSave }) {
  const [type, setType]         = useState('expense')   // 'expense' | 'income'
  const [display, setDisplay]   = useState('')           // raw number string
  const [category, setCategory] = useState(null)
  const [note, setNote]         = useState('')
  const [saved, setSaved]       = useState(false)

  // ── Numpad logic ────────────────────────────────────────────────────
  const handleKey = (key) => {
    if (key === '⌫') {
      setDisplay(d => d.slice(0, -1))
      return
    }
    // Prevent multiple dots
    if (key === '.' && display.includes('.')) return
    // Limit to 2 decimal places
    const dotIdx = display.indexOf('.')
    if (dotIdx !== -1 && display.length - dotIdx > 2) return
    // Leading-zero guard
    if (display === '0' && key !== '.') { setDisplay(key); return }
    // Max 7 digits before decimal
    if (dotIdx === -1 && display.replace(/\./g, '').length >= 7) return
    setDisplay(d => d + key)
  }

  const amount = parseFloat(display || '0')
  const displayStr = display === '' ? '0' : display

  const canSave = display !== '' && amount > 0 && category !== null

  const handleSave = () => {
    if (!canSave) return
    setSaved(true)
    setTimeout(() => { setSaved(false); onSave?.() }, 900)
  }

  const selectedCat = CATEGORIES.find(c => c.id === category)

  return (
    <Box style={{
      flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: '#0d0d18', height: '100%',
    }}>

      {/* ── Header ── */}
      <Box style={{ padding: '20px 24px 12px', flexShrink: 0, borderBottom: '1px solid #1e1e30' }}>
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <UnstyledButton onClick={onBack} style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}>
            ← Back
          </UnstyledButton>

          {/* Expense / Income pill toggle */}
          <Box style={{ display: 'flex', background: '#111122', borderRadius: 20, padding: 3, gap: 3 }}>
            {['expense', 'income'].map(t => (
              <Box
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '6px 16px', borderRadius: 17, cursor: 'pointer',
                  background: type === t ? (t === 'expense' ? '#2d0f0f' : '#0d2420') : 'transparent',
                  border: type === t
                    ? `1px solid ${t === 'expense' ? '#7f1d1d' : '#1a4a40'}`
                    : '1px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <Text fw={700} style={{
                  fontSize: 12,
                  color: type === t ? (t === 'expense' ? '#f87171' : '#4db6ac') : '#475569',
                }}>
                  {t === 'expense' ? '↑ Expense' : '↓ Income'}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Amount display ── */}
      <Box style={{
        padding: '24px 24px 16px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        {/* Currency + big number */}
        <Box style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          <Text style={{ fontSize: 28, color: '#475569', fontWeight: 700, marginTop: 8 }}>$</Text>
          <Text style={{
            fontSize: 64, fontWeight: 800, letterSpacing: -2,
            color: display
              ? (type === 'expense' ? '#f87171' : '#4db6ac')
              : '#1e2540',
            transition: 'color 0.2s',
            lineHeight: 1,
          }}>
            {displayStr}
          </Text>
        </Box>

        {/* Selected category pill */}
        {selectedCat ? (
          <Box style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: selectedCat.bg, border: `1px solid ${selectedCat.border}`,
            borderRadius: 20, padding: '4px 12px',
          }}>
            <Text style={{ fontSize: 14 }}>{selectedCat.icon}</Text>
            <Text style={{ fontSize: 13, fontWeight: 600, color: selectedCat.color }}>{selectedCat.label}</Text>
          </Box>
        ) : (
          <Text style={{ fontSize: 13, color: '#334155' }}>tap a category below</Text>
        )}
      </Box>

      {/* ── Category chips ── */}
      <Box style={{
        padding: '0 16px 12px', flexShrink: 0,
        display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
      }}>
        {CATEGORIES.map(cat => {
          const active = category === cat.id
          return (
            <Box
              key={cat.id}
              onClick={() => setCategory(active ? null : cat.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 13px', borderRadius: 20, cursor: 'pointer',
                background: active ? cat.bg : '#111122',
                border: `1.5px solid ${active ? cat.border : '#1e1e30'}`,
                transition: 'all 0.15s',
                userSelect: 'none',
              }}
            >
              <Text style={{ fontSize: 15, lineHeight: 1 }}>{cat.icon}</Text>
              <Text style={{
                fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? cat.color : '#475569',
              }}>
                {cat.label}
              </Text>
            </Box>
          )
        })}
      </Box>

      {/* ── Note (optional) ── */}
      <Box style={{ padding: '0 24px 12px', flexShrink: 0 }}>
        <input
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          maxLength={80}
          style={{
            width: '100%', padding: '10px 14px',
            background: '#111122', border: '1px solid #1e1e30',
            borderRadius: 12, color: '#94a3b8', fontSize: 13,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </Box>

      {/* ── Numpad ── */}
      <Box style={{ flex: 1, padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {PAD_KEYS.map((row, ri) => (
          <Box key={ri} style={{ display: 'flex', gap: 8, flex: 1 }}>
            {row.map(key => {
              const isBackspace = key === '⌫'
              const isDot       = key === '.'
              return (
                <Box
                  key={key}
                  onClick={() => handleKey(key)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 14, cursor: 'pointer',
                    background: isBackspace ? '#1a0f0f' : isDot ? '#111122' : '#141826',
                    border: `1px solid ${isBackspace ? '#3d1515' : '#1e1e30'}`,
                    minHeight: 52,
                    transition: 'background 0.1s',
                    userSelect: 'none',
                  }}
                  onMouseDown={e => e.currentTarget.style.background = isBackspace ? '#2d1515' : '#1e2540'}
                  onMouseUp={e => e.currentTarget.style.background = isBackspace ? '#1a0f0f' : isDot ? '#111122' : '#141826'}
                  onMouseLeave={e => e.currentTarget.style.background = isBackspace ? '#1a0f0f' : isDot ? '#111122' : '#141826'}
                >
                  <Text fw={600} style={{
                    fontSize: isBackspace ? 18 : 22,
                    color: isBackspace ? '#f87171' : '#cbd5e1',
                  }}>
                    {key}
                  </Text>
                </Box>
              )
            })}
          </Box>
        ))}
      </Box>

      {/* ── Add button ── */}
      <Box style={{ padding: '10px 16px 28px', flexShrink: 0 }}>
        <Box
          onClick={handleSave}
          style={{
            height: 54, borderRadius: 16, cursor: canSave ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: saved
              ? '#0d2420'
              : canSave
                ? (type === 'expense'
                    ? 'linear-gradient(135deg, #dc2626, #f97316)'
                    : 'linear-gradient(135deg, #009688, #4CAF50)')
                : '#111122',
            border: saved ? '1px solid #1a4a40' : canSave ? 'none' : '1px solid #1e1e30',
            transition: 'all 0.25s',
            opacity: canSave ? 1 : 0.5,
          }}
        >
          <Text fw={700} style={{
            fontSize: 16,
            color: saved ? '#4db6ac' : canSave ? 'white' : '#334155',
          }}>
            {saved
              ? '✓  Added!'
              : canSave
                ? `Add ${type === 'expense' ? 'Expense' : 'Income'} · $${display}`
                : 'Enter amount & category'}
          </Text>
        </Box>
      </Box>

    </Box>
  )
}
