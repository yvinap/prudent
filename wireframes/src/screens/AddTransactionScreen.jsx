import { useState, useRef, useEffect } from 'react'
import { Box, Text, Button, Group, UnstyledButton } from '@mantine/core'

const ITEM_SUGGESTIONS = [
  'Grocery Shopping', 'Coffee', 'Electricity Bill', 'Netflix', 'Spotify',
  'Rent', 'Internet Bill', 'Gas Station', 'Restaurant Dinner', 'Gym Membership',
  'Salary', 'Freelance Payment', 'Bonus', 'Investment Returns', 'Side Income',
  'Phone Bill', 'Water Bill', 'Insurance Premium', 'Medical Checkup', 'Books',
  'Clothing', 'Transport', 'Hotel', 'Flight Ticket', 'Online Shopping',
]

const TAG_SUGGESTIONS = [
  'food', 'utilities', 'entertainment', 'work', 'freelance', 'subscription',
  'transport', 'health', 'education', 'daily', 'weekly', 'monthly',
  'essential', 'recurring', 'one-time', 'personal', 'business', 'travel',
]

const BASE_INPUT = {
  width: '100%',
  padding: '10px 14px',
  background: '#1a1a2e',
  border: '1px solid #2d2d4a',
  borderRadius: 10,
  color: '#f1f5f9',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

function AutocompleteInput({ label, placeholder, value, onChange, suggestions }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const filtered = value.length > 0
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value).slice(0, 5)
    : []

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <Box ref={ref} style={{ position: 'relative' }}>
      <Text style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>{label}</Text>
      <input
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={BASE_INPUT}
      />
      {open && filtered.length > 0 && (
        <Box style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: '#1e1e30', border: '1px solid #2d2d4a', borderRadius: 10, overflow: 'hidden',
        }}>
          {filtered.map(s => (
            <Box
              key={s}
              onMouseDown={() => { onChange(s); setOpen(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#cbd5e1' }}
              onMouseEnter={e => e.currentTarget.style.background = '#2d2d4a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {s}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

function TagInput({ tags, onChange }) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const filtered = input.length > 0
    ? TAG_SUGGESTIONS.filter(s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)).slice(0, 5)
    : []

  const addTag = (tag) => {
    const t = tag.trim().toLowerCase()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
    setOpen(false)
  }

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  return (
    <Box ref={ref}>
      <Text style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Tags</Text>
      <Box style={{
        minHeight: 44, padding: '6px 10px',
        background: '#1a1a2e', border: '1px solid #2d2d4a', borderRadius: 10,
        display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', position: 'relative',
      }}>
        {tags.map(tag => (
          <Box key={tag} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: '#0d2420', border: '1px solid #1a4a40', borderRadius: 6, padding: '3px 8px',
          }}>
            <Text style={{ fontSize: 12, color: '#4db6ac' }}>#{tag}</Text>
            <UnstyledButton
              onClick={() => onChange(tags.filter(t => t !== tag))}
              style={{ color: '#4db6ac', lineHeight: 1, fontSize: 15, marginLeft: 2 }}
            >
              ×
            </UnstyledButton>
          </Box>
        ))}
        <Box style={{ position: 'relative', flex: 1, minWidth: 100 }}>
          <input
            value={input}
            onChange={e => { setInput(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (input.trim()) addTag(input) } }}
            placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : ''}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: 13, width: '100%', padding: '2px 4px' }}
          />
          {open && filtered.length > 0 && (
            <Box style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, minWidth: 180,
              background: '#1e1e30', border: '1px solid #2d2d4a', borderRadius: 10, overflow: 'hidden',
            }}>
              {filtered.map(s => (
                <Box
                  key={s}
                  onMouseDown={() => addTag(s)}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#cbd5e1' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#2d2d4a'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  #{s}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}

export default function AddTransactionScreen({ onBack, onSave }) {
  const [type, setType] = useState('expense')
  const [date, setDate] = useState('2026-04-04')
  const [item, setItem] = useState('')
  const [tags, setTags] = useState([])
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [saved, setSaved] = useState(false)

  const amount = price && quantity
    ? (parseFloat(price || 0) * parseFloat(quantity || 1)).toFixed(2)
    : ''

  const handleSave = () => {
    if (!item.trim() || !price) return
    setSaved(true)
    setTimeout(() => { setSaved(false); onSave() }, 900)
  }

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box style={{ padding: '24px 24px 16px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
        <UnstyledButton onClick={onBack} style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}>
          ← Back
        </UnstyledButton>
        <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9', marginTop: 12, marginBottom: 16 }}>
          Add Transaction
        </Text>

        {/* Expense / Income toggle */}
        <Box style={{ display: 'flex', background: '#0d0d18', borderRadius: 12, padding: 4, gap: 4 }}>
          {['expense', 'income'].map(t => (
            <Box
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1, padding: '9px', borderRadius: 9, cursor: 'pointer', textAlign: 'center',
                background: type === t ? (t === 'expense' ? '#2d0f0f' : '#0d2420') : 'transparent',
                border: type === t ? `1px solid ${t === 'expense' ? '#7f1d1d' : '#1a4a40'}` : '1px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <Text fw={700} style={{
                fontSize: 13,
                color: type === t ? (t === 'expense' ? '#f87171' : '#4db6ac') : '#475569',
              }}>
                {t === 'expense' ? '↑  Expense' : '↓  Income'}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Scrollable form */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Date */}
          <Box>
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Date</Text>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{ ...BASE_INPUT, colorScheme: 'dark' }}
            />
          </Box>

          {/* Item with intellisense */}
          <AutocompleteInput
            label="Item"
            placeholder="e.g. Grocery Shopping"
            value={item}
            onChange={setItem}
            suggestions={ITEM_SUGGESTIONS}
          />

          {/* Tags with intellisense */}
          <TagInput tags={tags} onChange={setTags} />

          {/* Price & Quantity side by side */}
          <Group grow gap={12}>
            <Box>
              <Text style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Price ($)</Text>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="0.00"
                style={BASE_INPUT}
              />
            </Box>
            <Box>
              <Text style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Quantity</Text>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder="1"
                style={BASE_INPUT}
              />
            </Box>
          </Group>

          {/* Amount (auto-calculated) */}
          <Box>
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
              Amount ($) <Text component="span" style={{ fontSize: 11, color: '#475569', fontWeight: 400 }}>— auto-calculated</Text>
            </Text>
            <Box style={{
              padding: '12px 14px',
              background: '#0d1020',
              border: `1px solid ${amount ? '#1a4a40' : '#2d2d4a'}`,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <Text fw={700} style={{ fontSize: 18, color: amount ? '#4db6ac' : '#334155' }}>
                {amount ? `$${amount}` : '—'}
              </Text>
              {amount && (
                <Text style={{ fontSize: 12, color: '#475569' }}>
                  ${parseFloat(price).toFixed(2)} × {quantity}
                </Text>
              )}
            </Box>
          </Box>

        </Box>
      </Box>

      {/* Save button */}
      <Box style={{ padding: '16px 24px 28px', borderTop: '1px solid #1e1e30', flexShrink: 0 }}>
        <Button
          fullWidth
          size="lg"
          radius="xl"
          disabled={!item.trim() || !price}
          onClick={handleSave}
          style={{
            background: saved
              ? '#0d2420'
              : (!item.trim() || !price)
                ? undefined
                : 'linear-gradient(135deg, #009688, #4CAF50)',
            height: 52,
            border: saved ? '1px solid #1a4a40' : 'none',
            color: saved ? '#4db6ac' : 'white',
            transition: 'all 0.3s',
          }}
        >
          {saved ? '✓  Saved!' : 'Save Transaction'}
        </Button>
      </Box>
    </Box>
  )
}
