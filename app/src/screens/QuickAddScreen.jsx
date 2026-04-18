import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Text, UnstyledButton } from '@mantine/core'
import { api } from '../lib/api'

const PAD_KEYS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', '⌫'],
]

export default function QuickAddScreen() {
  const navigate = useNavigate()

  const [type, setType] = useState('expense')
  const [display, setDisplay] = useState('')
  const [categoryId, setCategoryId] = useState(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [categories, setCategories] = useState([])

  useEffect(() => {
    api.listCategories().then(setCategories).catch(console.error)
  }, [])

  const handleKey = (key) => {
    if (key === '⌫') { setDisplay((d) => d.slice(0, -1)); return }
    if (key === '.' && display.includes('.')) return
    const dotIdx = display.indexOf('.')
    if (dotIdx !== -1 && display.length - dotIdx > 2) return
    if (display === '0' && key !== '.') { setDisplay(key); return }
    if (dotIdx === -1 && display.replace('.', '').length >= 7) return
    setDisplay((d) => d + key)
  }

  const amount = parseFloat(display || '0')
  const displayStr = display === '' ? '0' : display
  const canSave = display !== '' && amount > 0 && categoryId !== null

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    setError('')
    try {
      await api.createTransaction({
        type,
        categoryId,
        qty: 1,
        price: amount,
        currency: 'USD',
        tagIds: [],
      })
      navigate('/home')
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const selectedCat = categories.find((c) => c.id === categoryId)

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0d18', height: '100%' }}>
      {/* Header */}
      <Box style={{ padding: '20px 24px 12px', flexShrink: 0, borderBottom: '1px solid #1e1e30' }}>
        <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <UnstyledButton onClick={() => navigate('/home')} style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}>
            ← Back
          </UnstyledButton>

          {/* Expense / Income toggle */}
          <Box style={{ display: 'flex', background: '#111122', borderRadius: 20, padding: 3, gap: 3 }}>
            {['expense', 'income'].map((t) => (
              <Box
                key={t}
                onClick={() => setType(t)}
                style={{
                  padding: '6px 16px',
                  borderRadius: 17,
                  cursor: 'pointer',
                  background: type === t ? (t === 'expense' ? '#2d0f0f' : '#0d2420') : 'transparent',
                  border: type === t
                    ? `1px solid ${t === 'expense' ? '#7f1d1d' : '#1a4a40'}`
                    : '1px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <Text
                  fw={700}
                  style={{ fontSize: 12, color: type === t ? (t === 'expense' ? '#f87171' : '#4db6ac') : '#475569' }}
                >
                  {t === 'expense' ? '↑ Expense' : '↓ Income'}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Amount display */}
      <Box style={{ padding: '24px 24px 16px', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <Box style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          <Text style={{ fontSize: 28, color: '#475569', fontWeight: 700, marginTop: 8 }}>$</Text>
          <Text
            style={{
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: -2,
              color: display ? (type === 'expense' ? '#f87171' : '#4db6ac') : '#1e2540',
              transition: 'color 0.2s',
              lineHeight: 1,
            }}
          >
            {displayStr}
          </Text>
        </Box>

        {selectedCat ? (
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: (selectedCat.color || '#009688') + '22',
              border: `1px solid ${selectedCat.color || '#009688'}88`,
              borderRadius: 20,
              padding: '4px 12px',
            }}
          >
            {selectedCat.icon && <Text style={{ fontSize: 14 }}>{selectedCat.icon}</Text>}
            <Text style={{ fontSize: 13, fontWeight: 600, color: selectedCat.color || '#009688' }}>
              {selectedCat.name}
            </Text>
          </Box>
        ) : (
          <Text style={{ fontSize: 13, color: '#334155' }}>tap a category below</Text>
        )}
      </Box>

      {/* Category chips */}
      <Box style={{ padding: '0 16px 12px', flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {categories.map((cat) => {
          const active = categoryId === cat.id
          return (
            <Box
              key={cat.id}
              onClick={() => setCategoryId(active ? null : cat.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 13px',
                borderRadius: 20,
                cursor: 'pointer',
                background: active ? (cat.color || '#009688') + '22' : '#111122',
                border: `1.5px solid ${active ? (cat.color || '#009688') : '#1e1e30'}`,
                transition: 'all 0.15s',
                userSelect: 'none',
              }}
            >
              {cat.icon && <Text style={{ fontSize: 15, lineHeight: 1 }}>{cat.icon}</Text>}
              <Text style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? (cat.color || '#009688') : '#475569' }}>
                {cat.name}
              </Text>
            </Box>
          )
        })}
      </Box>

      {/* Note */}
      <Box style={{ padding: '0 24px 12px', flexShrink: 0 }}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          maxLength={80}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: '#111122',
            border: '1px solid #1e1e30',
            borderRadius: 12,
            color: '#94a3b8',
            fontSize: 13,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </Box>

      {error && (
        <Text style={{ fontSize: 12, color: '#f87171', padding: '0 24px 8px' }}>{error}</Text>
      )}

      {/* Numpad */}
      <Box style={{ flex: 1, padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
        {PAD_KEYS.map((row, ri) => (
          <Box key={ri} style={{ display: 'flex', gap: 8, flex: 1 }}>
            {row.map((key) => {
              const isBackspace = key === '⌫'
              const isDot = key === '.'
              return (
                <Box
                  key={key}
                  onClick={() => handleKey(key)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 14,
                    cursor: 'pointer',
                    background: isBackspace ? '#1a0f0f' : isDot ? '#111122' : '#141826',
                    border: `1px solid ${isBackspace ? '#3d1515' : '#1e1e30'}`,
                    transition: 'opacity 0.1s',
                    userSelect: 'none',
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <Text fw={isBackspace ? 400 : 600} style={{ fontSize: isBackspace ? 22 : 24, color: isBackspace ? '#f87171' : '#e2e8f0' }}>
                    {key}
                  </Text>
                </Box>
              )
            })}
          </Box>
        ))}

        {/* Save button */}
        <Box
          onClick={canSave && !saving ? handleSave : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 14,
            padding: '16px',
            cursor: canSave && !saving ? 'pointer' : 'not-allowed',
            background: canSave ? 'linear-gradient(135deg, #009688, #4CAF50)' : '#141826',
            border: `1px solid ${canSave ? 'transparent' : '#1e1e30'}`,
            transition: 'all 0.2s',
          }}
        >
          <Text fw={800} style={{ fontSize: 16, color: canSave ? 'white' : '#334155' }}>
            {saving ? 'Saving…' : '✓  Save'}
          </Text>
        </Box>
      </Box>
    </Box>
  )
}
