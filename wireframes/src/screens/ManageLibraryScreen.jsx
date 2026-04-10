import { useState, useRef, useEffect } from 'react'
import { Box, Text, UnstyledButton } from '@mantine/core'

// ─── Seed data ──────────────────────────────────────────────────────────────
const SEED_THINGS = [
  { name: 'Whole Milk',       defaultCategory: 'Groceries' },
  { name: 'Coffee',           defaultCategory: 'Coffee' },
  { name: 'Electricity Bill', defaultCategory: 'Bills' },
  { name: 'Netflix',          defaultCategory: 'Entertainment' },
  { name: 'Petrol',           defaultCategory: 'Transport' },
  { name: 'Groceries Run',    defaultCategory: null },
]
const SEED_TAGS  = ['reimbursable', 'recurring', 'work trip', 'daily', 'one-time']

const SEED_CATEGORIES = [
  { name: 'Food',          icon: '🍔', color: '#f97316' },
  { name: 'Coffee',        icon: '☕', color: '#d97706' },
  { name: 'Transport',     icon: '🚌', color: '#60a5fa' },
  { name: 'Groceries',     icon: '🛒', color: '#4ade80' },
  { name: 'Bills',         icon: '⚡', color: '#facc15' },
  { name: 'Entertainment', icon: '🎬', color: '#c084fc' },
  { name: 'Health',        icon: '💊', color: '#f472b6' },
  { name: 'Shopping',      icon: '🛍️', color: '#38bdf8' },
]

const ICON_OPTIONS = [
  '🍔','🍕','🍜','🍣','🥗','☕','🍺','🛒','🚌','🚗','✈️','🏠','⚡','💧','📱',
  '🎬','🎮','🎵','📚','💊','🏋️','👕','🛍️','💼','✈️','🏨','💰','📌','🎁','🐾',
]

const COLOR_OPTIONS = [
  '#f97316','#d97706','#eab308','#84cc16','#4ade80','#34d399',
  '#2dd4bf','#38bdf8','#60a5fa','#818cf8','#a78bfa','#c084fc',
  '#f472b6','#fb7185','#94a3b8','#cbd5e1',
]

// ─── Shared styles ───────────────────────────────────────────────────────────
const INPUT_STYLE = {
  width: '100%', padding: '10px 14px',
  background: '#111122', border: '1px solid #1e1e30',
  borderRadius: 10, color: '#f1f5f9', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
}

// ─── Sub-tabs ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'things',     label: 'Things',     accent: '#009688' },
  { id: 'categories', label: 'Categories', accent: '#a78bfa' },
  { id: 'tags',       label: 'Tags',       accent: '#38bdf8' },
]

// ─── Things Panel ─────────────────────────────────────────────────────────────
function ThingsPanel() {
  const [things, setThings]         = useState(SEED_THINGS)
  const [value, setValue]           = useState('')
  const [defaultCat, setDefaultCat] = useState(null)  // category name string | null
  const [error, setError]           = useState('')

  const add = () => {
    const v = value.trim()
    if (!v) { setError('Name is required'); return }
    if (things.some(t => t.name.toLowerCase() === v.toLowerCase())) { setError('Already exists'); return }
    setThings(prev => [{ name: v, defaultCategory: defaultCat }, ...prev])
    setValue('')
    setDefaultCat(null)
    setError('')
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Quick-add form */}
      <Box style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          New Thing
        </Text>

        {/* Name row */}
        <Box style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={value}
            onChange={e => { setValue(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="e.g. Whole Milk"
            style={{ ...INPUT_STYLE, flex: 1 }}
          />
          <Box
            onClick={add}
            style={{
              padding: '10px 18px', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
              background: value.trim() ? 'linear-gradient(135deg, #009688, #4CAF50)' : '#1a1a2e',
              border: value.trim() ? 'none' : '1px solid #2d2d4a',
            }}
          >
            <Text fw={700} style={{ fontSize: 14, color: value.trim() ? 'white' : '#334155' }}>Add</Text>
          </Box>
        </Box>

        {/* Default category label */}
        <Text style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 7 }}>
          Default category <Text component="span" style={{ fontWeight: 400, color: '#334155' }}>(optional — pre-fills when this thing is selected)</Text>
        </Text>

        {/* Category chip selector */}
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SEED_CATEGORIES.map(cat => {
            const active = defaultCat === cat.name
            return (
              <Box
                key={cat.name}
                onClick={() => setDefaultCat(active ? null : cat.name)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 16, cursor: 'pointer',
                  background: active ? cat.color + '22' : '#111122',
                  border: `1.5px solid ${active ? cat.color + '88' : '#1e1e30'}`,
                  transition: 'all 0.15s',
                  userSelect: 'none',
                }}
              >
                <Text style={{ fontSize: 13, lineHeight: 1 }}>{cat.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? cat.color : '#475569' }}>
                  {cat.name}
                </Text>
              </Box>
            )
          })}
        </Box>

        {error && <Text style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{error}</Text>}
      </Box>

      {/* List */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {things.length === 0 && (
          <Text style={{ fontSize: 13, color: '#334155', textAlign: 'center', marginTop: 32 }}>No things yet</Text>
        )}
        {things.map((thing, i) => {
          const cat = SEED_CATEGORIES.find(c => c.name === thing.defaultCategory)
          return (
            <Box key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', background: '#111122', border: '1px solid #1e1e30',
              borderRadius: 10,
            }}>
              <Box style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Text style={{ fontSize: 14, color: '#cbd5e1' }}>{thing.name}</Text>
                {cat ? (
                  <Box style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 10, flexShrink: 0,
                    background: cat.color + '18', border: `1px solid ${cat.color}44`,
                  }}>
                    <Text style={{ fontSize: 11 }}>{cat.icon}</Text>
                    <Text style={{ fontSize: 11, color: cat.color, fontWeight: 600 }}>{cat.name}</Text>
                  </Box>
                ) : (
                  <Text style={{ fontSize: 11, color: '#334155' }}>no default</Text>
                )}
              </Box>
              <UnstyledButton
                onClick={() => setThings(prev => prev.filter((_, j) => j !== i))}
                style={{ color: '#334155', fontSize: 18, lineHeight: 1, padding: '0 4px', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
                onMouseLeave={e => e.currentTarget.style.color = '#334155'}
              >×</UnstyledButton>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ─── Categories Panel ────────────────────────────────────────────────────────
function CategoriesPanel() {
  const [cats, setCats]     = useState(SEED_CATEGORIES)
  const [name, setName]     = useState('')
  const [icon, setIcon]     = useState('📌')
  const [color, setColor]   = useState('#94a3b8')
  const [error, setError]   = useState('')
  const [showIcons, setShowIcons] = useState(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    const close = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowIcons(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const add = () => {
    const v = name.trim()
    if (!v) { setError('Name is required'); return }
    if (cats.some(c => c.name.toLowerCase() === v.toLowerCase())) { setError('Already exists'); return }
    setCats(prev => [{ name: v, icon, color }, ...prev])
    setName(''); setIcon('📌'); setColor('#94a3b8'); setError('')
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Quick-add form */}
      <Box style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          New Category
        </Text>

        {/* Row 1: icon button + name input */}
        <Box style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {/* Icon picker trigger */}
          <Box ref={pickerRef} style={{ position: 'relative', flexShrink: 0 }}>
            <Box
              onClick={() => setShowIcons(v => !v)}
              style={{
                width: 44, height: 44, borderRadius: 10, cursor: 'pointer',
                background: '#1a1a2e', border: '1px solid #2d2d4a',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
              }}
            >
              {icon}
            </Box>
            {showIcons && (
              <Box style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 300,
                background: '#1a1a2e', border: '1px solid #2d2d4a', borderRadius: 12,
                padding: 10, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, width: 200,
              }}>
                {ICON_OPTIONS.map(ic => (
                  <Box
                    key={ic} onClick={() => { setIcon(ic); setShowIcons(false) }}
                    style={{
                      fontSize: 20, padding: 6, borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                      background: icon === ic ? '#2d2d4a' : 'transparent',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#2d2d4a'}
                    onMouseLeave={e => e.currentTarget.style.background = icon === ic ? '#2d2d4a' : 'transparent'}
                  >{ic}</Box>
                ))}
              </Box>
            )}
          </Box>

          <input
            value={name}
            onChange={e => { setName(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Category name"
            style={{ ...INPUT_STYLE, flex: 1 }}
          />
        </Box>

        {/* Row 2: colour swatches */}
        <Box style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {COLOR_OPTIONS.map(c => (
            <Box
              key={c} onClick={() => setColor(c)}
              style={{
                width: 22, height: 22, borderRadius: 6, cursor: 'pointer',
                background: c,
                outline: color === c ? `3px solid white` : '2px solid transparent',
                outlineOffset: 1,
                transition: 'outline 0.1s',
              }}
            />
          ))}
        </Box>

        {/* Preview + Add */}
        <Box style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Live preview */}
          <Box style={{
            display: 'flex', alignItems: 'center', gap: 6, flex: 1,
            padding: '8px 12px', borderRadius: 10,
            background: color + '18', border: `1px solid ${color}44`,
          }}>
            <Text style={{ fontSize: 16 }}>{icon}</Text>
            <Text fw={600} style={{ fontSize: 13, color }}>
              {name.trim() || 'Preview'}
            </Text>
          </Box>
          <Box
            onClick={add}
            style={{
              padding: '10px 18px', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
              background: name.trim() ? 'linear-gradient(135deg, #7c3aed, #a78bfa)' : '#1a1a2e',
              border: name.trim() ? 'none' : '1px solid #2d2d4a',
            }}
          >
            <Text fw={700} style={{ fontSize: 14, color: name.trim() ? 'white' : '#334155' }}>Add</Text>
          </Box>
        </Box>
        {error && <Text style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{error}</Text>}
      </Box>

      {/* List */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {cats.map((cat, i) => (
          <Box key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: '#111122', border: '1px solid #1e1e30', borderRadius: 10,
          }}>
            <Box style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Box style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: cat.color + '22', border: `1px solid ${cat.color}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>{cat.icon}</Box>
              <Text style={{ fontSize: 14, color: '#cbd5e1' }}>{cat.name}</Text>
              <Box style={{
                width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0,
              }} />
            </Box>
            <UnstyledButton
              onClick={() => setCats(prev => prev.filter((_, j) => j !== i))}
              style={{ color: '#334155', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = '#334155'}
            >×</UnstyledButton>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ─── Tags Panel ───────────────────────────────────────────────────────────────
function TagsPanel() {
  const [tags, setTags] = useState(SEED_TAGS)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  const add = () => {
    const v = value.trim().toLowerCase().replace(/\s+/g, '-')
    if (!v) { setError('Name is required'); return }
    if (tags.includes(v)) { setError('Already exists'); return }
    setTags(prev => [v, ...prev])
    setValue('')
    setError('')
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Quick-add form */}
      <Box style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          New Tag
        </Text>
        <Box style={{ display: 'flex', gap: 8 }}>
          <Box style={{ position: 'relative', flex: 1 }}>
            <Text style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: '#475569', pointerEvents: 'none',
            }}>#</Text>
            <input
              value={value}
              onChange={e => { setValue(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && add()}
              placeholder="e.g. reimbursable"
              style={{ ...INPUT_STYLE, paddingLeft: 26 }}
            />
          </Box>
          <Box
            onClick={add}
            style={{
              padding: '10px 18px', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
              background: value.trim() ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : '#1a1a2e',
              border: value.trim() ? 'none' : '1px solid #2d2d4a',
            }}
          >
            <Text fw={700} style={{ fontSize: 14, color: value.trim() ? 'white' : '#334155' }}>Add</Text>
          </Box>
        </Box>
        {error && <Text style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{error}</Text>}
        <Text style={{ fontSize: 11, color: '#334155', marginTop: 8 }}>
          Spaces are converted to hyphens. Tags are lowercase.
        </Text>
      </Box>

      {/* Chip list */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {tags.length === 0 && (
            <Text style={{ fontSize: 13, color: '#334155' }}>No tags yet</Text>
          )}
          {tags.map((tag, i) => (
            <Box key={i} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', borderRadius: 20,
              background: '#0e1e2d', border: '1px solid #1e4a6e',
            }}>
              <Text style={{ fontSize: 13, color: '#38bdf8' }}>#{tag}</Text>
              <UnstyledButton
                onClick={() => setTags(prev => prev.filter((_, j) => j !== i))}
                style={{ color: '#38bdf8', fontSize: 15, lineHeight: 1, opacity: 0.5 }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
              >×</UnstyledButton>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ManageLibraryScreen({ onBack }) {
  const [activeTab, setActiveTab] = useState('things')
  const tab = TABS.find(t => t.id === activeTab)

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0d18' }}>

      {/* Header */}
      <Box style={{ padding: '20px 20px 0', flexShrink: 0, borderBottom: '1px solid #1e1e30' }}>
        <UnstyledButton onClick={onBack} style={{ color: '#009688', fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
          ← Back
        </UnstyledButton>
        <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9', marginBottom: 16 }}>Manage Library</Text>

        {/* Tab bar */}
        <Box style={{ display: 'flex', gap: 0 }}>
          {TABS.map(t => {
            const active = t.id === activeTab
            return (
              <Box
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  flex: 1, padding: '10px 0', textAlign: 'center', cursor: 'pointer',
                  borderBottom: active ? `2.5px solid ${t.accent}` : '2.5px solid transparent',
                  transition: 'border-color 0.2s',
                }}
              >
                <Text fw={active ? 700 : 500} style={{
                  fontSize: 14,
                  color: active ? t.accent : '#475569',
                  transition: 'color 0.2s',
                }}>
                  {t.label}
                </Text>
              </Box>
            )
          })}
        </Box>
      </Box>

      {/* Panel content */}
      <Box style={{ flex: 1, minHeight: 0 }}>
        {activeTab === 'things'     && <ThingsPanel />}
        {activeTab === 'categories' && <CategoriesPanel />}
        {activeTab === 'tags'       && <TagsPanel />}
      </Box>

    </Box>
  )
}
