// Copyright (C) 2026 V.P.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Text, UnstyledButton } from '@mantine/core'
import { api } from '../lib/api'

const INPUT_STYLE = {
  width: '100%',
  padding: '10px 14px',
  background: '#111122',
  border: '1px solid #1e1e30',
  borderRadius: 10,
  color: '#f1f5f9',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const ICON_OPTIONS = [
  '🍔','🍕','🍜','🍣','🥗','☕','🍺','🛒','🚌','🚗','✈️','🏠','⚡','💧','📱',
  '🎬','🎮','🎵','📚','💊','🏋️','👕','🛍️','💼','🏨','💰','📌','🎁',
]

const COLOR_OPTIONS = [
  '#f97316','#d97706','#eab308','#84cc16','#4ade80','#34d399',
  '#2dd4bf','#38bdf8','#60a5fa','#818cf8','#a78bfa','#c084fc',
  '#f472b6','#fb7185','#94a3b8','#cbd5e1',
]

const TABS = [
  { id: 'things', label: 'Things', accent: '#009688' },
  { id: 'categories', label: 'Categories', accent: '#a78bfa' },
  { id: 'tags', label: 'Tags', accent: '#38bdf8' },
]

// ── Things Panel ─────────────────────────────────────────────────────────────
function ThingsPanel({ categories }) {
  const [things, setThings] = useState([])
  const [loading, setLoading] = useState(true)
  const [value, setValue] = useState('')
  const [defaultCatId, setDefaultCatId] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.listThings().then(setThings).catch(console.error).finally(() => setLoading(false))
  }, [])

  const add = async () => {
    const v = value.trim()
    if (!v) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const created = await api.createThing({ name: v, defaultCategoryId: defaultCatId || null })
      setThings((prev) => [created, ...prev])
      setValue('')
      setDefaultCatId(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          New Thing
        </Text>
        <Box style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="e.g. Whole Milk"
            style={{ ...INPUT_STYLE, flex: 1 }}
          />
          <Box
            onClick={saving ? undefined : add}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              cursor: saving ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              background: value.trim() && !saving ? 'linear-gradient(135deg, #009688, #4CAF50)' : '#1a1a2e',
              border: value.trim() ? 'none' : '1px solid #2d2d4a',
            }}
          >
            <Text fw={700} style={{ fontSize: 14, color: value.trim() ? 'white' : '#334155' }}>
              {saving ? '…' : 'Add'}
            </Text>
          </Box>
        </Box>
        <Text style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 7 }}>
          Default category <Text component="span" style={{ fontWeight: 400, color: '#334155' }}>(optional)</Text>
        </Text>
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {categories.map((cat) => {
            const active = defaultCatId === cat.id
            return (
              <Box
                key={cat.id}
                onClick={() => setDefaultCatId(active ? null : cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '5px 10px',
                  borderRadius: 16,
                  cursor: 'pointer',
                  background: active ? (cat.color || '#009688') + '22' : '#111122',
                  border: `1.5px solid ${active ? (cat.color || '#009688') : '#1e1e30'}`,
                  transition: 'all 0.15s',
                }}
              >
                {cat.icon && <Text style={{ fontSize: 13 }}>{cat.icon}</Text>}
                <Text style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? (cat.color || '#009688') : '#475569' }}>
                  {cat.name}
                </Text>
              </Box>
            )
          })}
        </Box>
        {error && <Text style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{error}</Text>}
      </Box>

      <Box style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading ? (
          <Text style={{ fontSize: 13, color: '#334155', textAlign: 'center', marginTop: 24 }}>Loading…</Text>
        ) : things.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#334155', textAlign: 'center', marginTop: 32 }}>No things yet</Text>
        ) : (
          things.map((thing) => {
            const cat = categories.find((c) => c.id === thing.defaultCategoryId)
            return (
              <Box
                key={thing.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#111122',
                  border: '1px solid #1e1e30',
                  borderRadius: 10,
                }}
              >
                <Box style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Text style={{ fontSize: 14, color: '#cbd5e1' }}>{thing.name}</Text>
                  {cat ? (
                    <Box
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 10,
                        flexShrink: 0,
                        background: (cat.color || '#009688') + '18',
                        border: `1px solid ${(cat.color || '#009688')}44`,
                      }}
                    >
                      {cat.icon && <Text style={{ fontSize: 11 }}>{cat.icon}</Text>}
                      <Text style={{ fontSize: 11, color: cat.color || '#009688', fontWeight: 600 }}>{cat.name}</Text>
                    </Box>
                  ) : (
                    <Text style={{ fontSize: 11, color: '#334155' }}>no default</Text>
                  )}
                </Box>
              </Box>
            )
          })
        )}
      </Box>
    </Box>
  )
}

// ── Categories Panel ──────────────────────────────────────────────────────────
function CategoriesPanel({ categories, onCategoriesChange }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📌')
  const [color, setColor] = useState('#94a3b8')
  const [error, setError] = useState('')
  const [showIcons, setShowIcons] = useState(false)
  const [saving, setSaving] = useState(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    const close = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowIcons(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const add = async () => {
    const v = name.trim()
    if (!v) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const created = await api.createCategory({ name: v, icon, color })
      onCategoriesChange([created, ...categories])
      setName('')
      setIcon('📌')
      setColor('#94a3b8')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          New Category
        </Text>

        {/* Icon + Color + Name row */}
        <Box style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <Box ref={pickerRef} style={{ position: 'relative' }}>
            <Box
              onClick={() => setShowIcons(!showIcons)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                border: `1.5px solid ${color}`,
                background: color + '22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
            {showIcons && (
              <Box
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  zIndex: 200,
                  background: '#1e1e30',
                  border: '1px solid #2d2d4a',
                  borderRadius: 10,
                  padding: 10,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 4,
                  width: 220,
                }}
              >
                {ICON_OPTIONS.map((ic) => (
                  <Box
                    key={ic}
                    onClick={() => { setIcon(ic); setShowIcons(false) }}
                    style={{
                      width: 36,
                      height: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      borderRadius: 8,
                      cursor: 'pointer',
                      background: icon === ic ? '#2d2d4a' : 'transparent',
                    }}
                  >
                    {ic}
                  </Box>
                ))}
              </Box>
            )}
          </Box>

          <input
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Category name"
            style={{ ...INPUT_STYLE, flex: 1 }}
          />

          <Box
            onClick={saving ? undefined : add}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              cursor: saving ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              background: name.trim() && !saving ? 'linear-gradient(135deg, #009688, #4CAF50)' : '#1a1a2e',
              border: name.trim() ? 'none' : '1px solid #2d2d4a',
            }}
          >
            <Text fw={700} style={{ fontSize: 14, color: name.trim() ? 'white' : '#334155' }}>
              {saving ? '…' : 'Add'}
            </Text>
          </Box>
        </Box>

        {/* Color palette */}
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {COLOR_OPTIONS.map((c) => (
            <Box
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: c,
                cursor: 'pointer',
                border: color === c ? '2px solid white' : '2px solid transparent',
                boxShadow: color === c ? `0 0 8px ${c}` : 'none',
                transition: 'all 0.15s',
              }}
            />
          ))}
        </Box>

        {error && <Text style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{error}</Text>}
      </Box>

      <Box style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {categories.map((cat) => (
          <Box
            key={cat.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              background: '#111122',
              border: '1px solid #1e1e30',
              borderRadius: 10,
            }}
          >
            <Box
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: (cat.color || '#009688') + '22',
                border: `1px solid ${cat.color || '#009688'}55`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              {cat.icon || '📌'}
            </Box>
            <Text fw={500} style={{ fontSize: 14, color: '#cbd5e1', flex: 1 }}>{cat.name}</Text>
            <Box
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: cat.color || '#009688',
                flexShrink: 0,
              }}
            />
          </Box>
        ))}
      </Box>
    </Box>
  )
}

// ── Tags Panel ────────────────────────────────────────────────────────────────
function TagsPanel() {
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.listTags().then(setTags).catch(console.error).finally(() => setLoading(false))
  }, [])

  const add = async () => {
    const v = value.trim().toLowerCase()
    if (!v) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const created = await api.createTag({ name: v })
      setTags((prev) => [created, ...prev])
      setValue('')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
          New Tag
        </Text>
        <Box style={{ display: 'flex', gap: 8 }}>
          <input
            value={value}
            onChange={(e) => { setValue(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="e.g. reimbursable"
            style={{ ...INPUT_STYLE, flex: 1 }}
          />
          <Box
            onClick={saving ? undefined : add}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              cursor: saving ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              background: value.trim() && !saving ? 'linear-gradient(135deg, #009688, #4CAF50)' : '#1a1a2e',
              border: value.trim() ? 'none' : '1px solid #2d2d4a',
            }}
          >
            <Text fw={700} style={{ fontSize: 14, color: value.trim() ? 'white' : '#334155' }}>
              {saving ? '…' : 'Add'}
            </Text>
          </Box>
        </Box>
        {error && <Text style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{error}</Text>}
      </Box>

      <Box style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexWrap: 'wrap', gap: 8, alignContent: 'flex-start' }}>
        {loading ? (
          <Text style={{ fontSize: 13, color: '#334155', width: '100%', textAlign: 'center', marginTop: 24 }}>Loading…</Text>
        ) : tags.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#334155', width: '100%', textAlign: 'center', marginTop: 32 }}>No tags yet</Text>
        ) : (
          tags.map((tag) => (
            <Box
              key={tag.id}
              style={{
                padding: '6px 12px',
                borderRadius: 20,
                background: '#0d2420',
                border: '1px solid #1a4a40',
              }}
            >
              <Text style={{ fontSize: 13, color: '#4db6ac', fontWeight: 600 }}>#{tag.name}</Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ManageLibraryScreen() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('things')
  const [categories, setCategories] = useState([])
  const [loadingCats, setLoadingCats] = useState(true)

  useEffect(() => {
    api.listCategories().then(setCategories).catch(console.error).finally(() => setLoadingCats(false))
  }, [])

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box style={{ padding: '24px 24px 0', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
        <UnstyledButton onClick={() => navigate('/home')} style={{ color: '#009688', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
          ← Back
        </UnstyledButton>
        <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9', marginBottom: 16 }}>Manage Library</Text>

        {/* Tabs */}
        <Box style={{ display: 'flex', gap: 0 }}>
          {TABS.map((tab) => (
            <Box
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '10px 0',
                textAlign: 'center',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? `2px solid ${tab.accent}` : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              <Text
                fw={activeTab === tab.id ? 700 : 400}
                style={{ fontSize: 13, color: activeTab === tab.id ? tab.accent : '#475569' }}
              >
                {tab.label}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Panel content */}
      <Box style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'things' && !loadingCats && (
          <ThingsPanel categories={categories} />
        )}
        {activeTab === 'categories' && !loadingCats && (
          <CategoriesPanel categories={categories} onCategoriesChange={setCategories} />
        )}
        {activeTab === 'tags' && <TagsPanel />}
      </Box>
    </Box>
  )
}
