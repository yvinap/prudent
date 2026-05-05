import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Text, Button, Group, UnstyledButton } from '@mantine/core'
import { api } from '../lib/api'

function toLocalDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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

function AutocompleteInput({ label, placeholder, value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const filtered = value.length > 0
    ? options.filter((o) => o.toLowerCase().includes(value.toLowerCase()) && o !== value).slice(0, 5)
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
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        style={BASE_INPUT}
      />
      {open && filtered.length > 0 && (
        <Box
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 200,
            background: '#1e1e30',
            border: '1px solid #2d2d4a',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {filtered.map((s) => (
            <Box
              key={s}
              onMouseDown={() => { onChange(s); setOpen(false) }}
              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#cbd5e1' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2d2d4a')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {s}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

function TagInput({ tags, allTags, onChange }) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const tagNames = allTags.map((t) => t.name)
  const filtered = input.length > 0
    ? tagNames.filter((s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)).slice(0, 5)
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
      <Box
        style={{
          minHeight: 44,
          padding: '6px 10px',
          background: '#1a1a2e',
          border: '1px solid #2d2d4a',
          borderRadius: 10,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
          position: 'relative',
        }}
      >
        {tags.map((tag) => (
          <Box
            key={tag}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: '#0d2420',
              border: '1px solid #1a4a40',
              borderRadius: 6,
              padding: '3px 8px',
            }}
          >
            <Text style={{ fontSize: 12, color: '#4db6ac' }}>#{tag}</Text>
            <UnstyledButton
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              style={{ color: '#4db6ac', lineHeight: 1, fontSize: 15, marginLeft: 2 }}
            >
              ×
            </UnstyledButton>
          </Box>
        ))}
        <Box style={{ position: 'relative', flex: 1, minWidth: 100 }}>
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); if (input.trim()) addTag(input) }
            }}
            placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : ''}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f1f5f9',
              fontSize: 13,
              width: '100%',
              padding: '2px 4px',
            }}
          />
          {open && filtered.length > 0 && (
            <Box
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                zIndex: 200,
                minWidth: 180,
                background: '#1e1e30',
                border: '1px solid #2d2d4a',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {filtered.map((s) => (
                <Box
                  key={s}
                  onMouseDown={() => addTag(s)}
                  style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: '#cbd5e1' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#2d2d4a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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

export default function AddTransactionScreen() {
  const navigate = useNavigate()

  const [type, setType] = useState('expense')
  const [date, setDate] = useState(toLocalDateStr(new Date()))
  const [thingName, setThingName] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [things, setThings] = useState([])
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])

  useEffect(() => {
    Promise.all([api.listThings(), api.listCategories(), api.listTags()])
      .then(([th, cats, tgs]) => { setThings(th); setCategories(cats); setTags(tgs) })
      .catch(console.error)
  }, [])

  const thingNames = things.map((t) => t.name)
  const selectedThing = things.find((t) => t.name.toLowerCase() === thingName.toLowerCase())

  // Auto-fill category from thing's default
  useEffect(() => {
    if (selectedThing?.defaultCategoryId && !selectedCategoryId) {
      setSelectedCategoryId(selectedThing.defaultCategoryId)
    }
  }, [selectedThing])

  const tagIds = selectedTags.map((name) => tags.find((t) => t.name === name)?.id).filter(Boolean)

  const handleSave = async () => {
    if (!price || parseFloat(price) <= 0) { setError('Enter a valid price'); return }
    if (!selectedCategoryId && !selectedThing) { setError('Select a category or item'); return }
    setSaving(true)
    setError('')
    try {
      await api.createTransaction({
        type,
        transactionDate: date,
        thingId: selectedThing?.id ?? null,
        categoryId: selectedCategoryId || selectedThing?.defaultCategoryId || null,
        qty: parseFloat(quantity) || 1,
        price: parseFloat(price),
        currency: 'USD',
        tagIds,
      })
      navigate('/home')
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const total = price && quantity
    ? (parseFloat(price || 0) * parseFloat(quantity || 1)).toFixed(2)
    : ''

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box style={{ padding: '24px 24px 16px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
        <UnstyledButton onClick={() => navigate('/home')} style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}>
          ← Back
        </UnstyledButton>
        <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9', marginTop: 12, marginBottom: 16 }}>
          Add Transaction
        </Text>

        {/* Expense / Income toggle */}
        <Box style={{ display: 'flex', background: '#0d0d18', borderRadius: 12, padding: 4, gap: 4 }}>
          {['expense', 'income'].map((t) => (
            <Box
              key={t}
              onClick={() => setType(t)}
              style={{
                flex: 1,
                padding: '9px',
                borderRadius: 9,
                cursor: 'pointer',
                textAlign: 'center',
                background: type === t ? (t === 'expense' ? '#2d0f0f' : '#0d2420') : 'transparent',
                border: type === t ? `1px solid ${t === 'expense' ? '#7f1d1d' : '#1a4a40'}` : '1px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <Text
                fw={700}
                style={{ fontSize: 13, color: type === t ? (t === 'expense' ? '#f87171' : '#4db6ac') : '#475569' }}
              >
                {t === 'expense' ? '↑  Expense' : '↓  Income'}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Form */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Date */}
          <Box>
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Date</Text>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ ...BASE_INPUT, colorScheme: 'dark' }}
            />
          </Box>

          {/* Item / Thing */}
          <AutocompleteInput
            label="Item"
            placeholder="e.g. Grocery Shopping"
            value={thingName}
            onChange={setThingName}
            options={thingNames}
          />

          {/* Category */}
          <Box>
            <Text style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Category</Text>
            <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categories.map((cat) => (
                <Box
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(selectedCategoryId === cat.id ? '' : cat.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 12px',
                    borderRadius: 20,
                    cursor: 'pointer',
                    background: selectedCategoryId === cat.id ? (cat.color || '#009688') + '22' : '#111122',
                    border: `1.5px solid ${selectedCategoryId === cat.id ? (cat.color || '#009688') : '#1e1e30'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {cat.icon && <Text style={{ fontSize: 14 }}>{cat.icon}</Text>}
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: selectedCategoryId === cat.id ? 700 : 400,
                      color: selectedCategoryId === cat.id ? (cat.color || '#009688') : '#475569',
                    }}
                  >
                    {cat.name}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Tags */}
          <TagInput tags={selectedTags} allTags={tags} onChange={setSelectedTags} />

          {/* Price + Quantity */}
          <Group gap={12}>
            <Box style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Price ($)</Text>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                style={BASE_INPUT}
              />
            </Box>
            <Box style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>Qty</Text>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                style={BASE_INPUT}
              />
            </Box>
          </Group>

          {total && (
            <Box style={{ padding: '12px 14px', background: '#0d2420', borderRadius: 10, border: '1px solid #1a4a40' }}>
              <Text style={{ fontSize: 13, color: '#4db6ac' }}>
                Total: <Text component="span" fw={700}>${total}</Text>
              </Text>
            </Box>
          )}

          {error && (
            <Text style={{ fontSize: 13, color: '#f87171' }}>{error}</Text>
          )}
        </Box>
      </Box>

      {/* Save */}
      <Box style={{ padding: '16px 24px 28px', borderTop: '1px solid #1e1e30', flexShrink: 0 }}>
        <Button
          fullWidth
          size="lg"
          radius="xl"
          loading={saving}
          onClick={handleSave}
          style={{ background: 'linear-gradient(135deg, #009688, #4CAF50)', height: 52, border: 'none' }}
        >
          Save Transaction
        </Button>
      </Box>
    </Box>
  )
}
