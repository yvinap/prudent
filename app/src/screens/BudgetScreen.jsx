import { useEffect, useState } from 'react'
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

function BudgetRow({ budget, realized, onRemove }) {
  const pct = budget.amount > 0 ? Math.min((realized / budget.amount) * 100, 100) : 0
  const over = realized > budget.amount
  const isSpending = budget.type === 'spending'
  const remaining = budget.amount - realized

  let barColor
  if (isSpending) {
    barColor = over ? '#ef4444' : pct > 80 ? '#f59e0b' : (budget.color || '#009688')
  } else {
    barColor = pct >= 100 ? '#4ade80' : pct > 60 ? '#f59e0b' : '#ef4444'
  }

  return (
    <Box
      style={{
        padding: '14px',
        background: '#111122',
        border: `1px solid ${over && isSpending ? '#3d1515' : '#1e1e30'}`,
        borderRadius: 12,
      }}
    >
      <Box style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <Box
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              flexShrink: 0,
              background: (budget.color || '#009688') + '22',
              border: `1px solid ${(budget.color || '#009688')}55`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            {budget.icon || '📌'}
          </Box>
          <Box style={{ minWidth: 0 }}>
            <Text fw={600} style={{ fontSize: 13, color: '#cbd5e1' }}>{budget.name}</Text>
            <Box style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
              <Box
                style={{
                  padding: '1px 7px',
                  borderRadius: 8,
                  background: isSpending ? '#1a1a2e' : '#0d2018',
                  border: `1px solid ${isSpending ? '#2d2d4a' : '#166534'}`,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: 700, color: isSpending ? '#64748b' : '#4ade80' }}>
                  {isSpending ? 'SPEND' : 'SAVE'}
                </Text>
              </Box>
              <Box style={{ padding: '1px 7px', borderRadius: 8, background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>
                  {budget.period === 'month' ? 'MONTHLY' : 'YEARLY'}
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
        <Box style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
          <Text fw={700} style={{ fontSize: 14, color: barColor }}>
            ${realized.toFixed(0)}
            <Text component="span" fw={400} style={{ fontSize: 11, color: '#475569' }}>
              {' '}/ ${budget.amount}
            </Text>
          </Text>
          <UnstyledButton
            onClick={() => onRemove(budget.id)}
            style={{ fontSize: 12, color: '#334155', marginTop: 4 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#334155')}
          >
            Remove
          </UnstyledButton>
        </Box>
      </Box>

      <Box style={{ height: 7, background: '#1e1e30', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
        <Box
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 4,
            background: barColor,
            boxShadow: `0 0 8px ${barColor}55`,
            transition: 'width 0.4s ease',
          }}
        />
      </Box>

      <Text style={{ fontSize: 11, color: '#475569' }}>
        {isSpending
          ? over
            ? `⚠ $${Math.abs(remaining).toFixed(0)} over budget this ${budget.period}`
            : `$${remaining.toFixed(0)} remaining · ${Math.round(pct)}% used`
          : pct >= 100
            ? '🎉 Saving goal reached!'
            : `$${remaining.toFixed(0)} to reach goal · ${Math.round(pct)}% saved`}
      </Text>
    </Box>
  )
}

function AddBudgetForm({ categories, tags, onAdd }) {
  const [scope, setScope] = useState('category')
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [selectedTagId, setSelectedTagId] = useState(null)
  const [btype, setBtype] = useState('spending')
  const [period, setPeriod] = useState('month')
  const [amount, setAmount] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const v = parseFloat(amount)
    if (!amount || isNaN(v) || v <= 0) { setError('Enter a valid amount'); return }
    if (scope === 'category' && !selectedCategoryId) { setError('Select a category'); return }
    if (scope === 'tag' && !selectedTagId) { setError('Select a tag'); return }

    const cat = categories.find((c) => c.id === selectedCategoryId)
    const tag = tags.find((t) => t.id === selectedTagId)
    const budgetName = name.trim() || (scope === 'category' ? cat?.name : tag?.name) || 'Budget'

    setSaving(true)
    setError('')
    try {
      const created = await api.createBudget({
        name: budgetName,
        type: btype,
        period,
        amount: v,
        currency: 'USD',
        categoryId: scope === 'category' ? selectedCategoryId : null,
        tagId: scope === 'tag' ? selectedTagId : null,
      })
      onAdd({ ...created, icon: scope === 'category' ? (cat?.icon || '📌') : '🏷️', color: cat?.color || '#38bdf8' })
      setAmount('')
      setName('')
      setSelectedCategoryId(null)
      setSelectedTagId(null)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
      <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
        New Budget
      </Text>

      {/* Spend / Save toggle */}
      <Box style={{ display: 'flex', background: '#0d0d18', borderRadius: 10, padding: 3, gap: 3, marginBottom: 12 }}>
        {['spending', 'saving'].map((t) => (
          <Box
            key={t}
            onClick={() => setBtype(t)}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 8,
              cursor: 'pointer',
              textAlign: 'center',
              background: btype === t ? (t === 'spending' ? '#2d0f0f' : '#0d2420') : 'transparent',
              border: btype === t ? `1px solid ${t === 'spending' ? '#7f1d1d' : '#1a4a40'}` : '1px solid transparent',
            }}
          >
            <Text fw={700} style={{ fontSize: 12, color: btype === t ? (t === 'spending' ? '#f87171' : '#4db6ac') : '#475569' }}>
              {t === 'spending' ? '↑ Spending limit' : '↓ Saving goal'}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Monthly / Yearly */}
      <Box style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['month', 'year'].map((p) => (
          <Box
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 10,
              cursor: 'pointer',
              textAlign: 'center',
              background: period === p ? '#111122' : 'transparent',
              border: `1px solid ${period === p ? '#2d2d4a' : '#1e1e30'}`,
            }}
          >
            <Text fw={period === p ? 700 : 400} style={{ fontSize: 12, color: period === p ? '#94a3b8' : '#334155' }}>
              {p === 'month' ? 'Monthly' : 'Yearly'}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Scope toggle */}
      <Box style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {['category', 'tag'].map((s) => (
          <Box
            key={s}
            onClick={() => { setScope(s); setSelectedCategoryId(null); setSelectedTagId(null) }}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: 10,
              cursor: 'pointer',
              textAlign: 'center',
              background: scope === s ? '#111122' : 'transparent',
              border: `1px solid ${scope === s ? '#2d2d4a' : '#1e1e30'}`,
            }}
          >
            <Text fw={scope === s ? 700 : 400} style={{ fontSize: 12, color: scope === s ? '#94a3b8' : '#334155' }}>
              {s === 'category' ? 'By category' : 'By tag'}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Category / Tag selector */}
      {scope === 'category' ? (
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {categories.map((cat) => {
            const active = selectedCategoryId === cat.id
            return (
              <Box
                key={cat.id}
                onClick={() => setSelectedCategoryId(active ? null : cat.id)}
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
      ) : (
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {tags.map((tag) => {
            const active = selectedTagId === tag.id
            return (
              <Box
                key={tag.id}
                onClick={() => setSelectedTagId(active ? null : tag.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 16,
                  cursor: 'pointer',
                  background: active ? '#0d2420' : '#111122',
                  border: `1.5px solid ${active ? '#1a4a40' : '#1e1e30'}`,
                  transition: 'all 0.15s',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#4db6ac' : '#475569' }}>
                  #{tag.name}
                </Text>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Name + Amount */}
      <Box style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Budget name (optional)"
          style={{ ...INPUT_STYLE, flex: 1 }}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setError('') }}
          placeholder="Amount"
          style={{ ...INPUT_STYLE, flex: 1 }}
        />
      </Box>

      {error && <Text style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{error}</Text>}

      <Box
        onClick={saving ? undefined : save}
        style={{
          padding: '10px',
          borderRadius: 10,
          cursor: saving ? 'not-allowed' : 'pointer',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #009688, #4CAF50)',
        }}
      >
        <Text fw={700} style={{ fontSize: 14, color: 'white' }}>
          {saving ? 'Adding…' : 'Add Budget'}
        </Text>
      </Box>
    </Box>
  )
}

export default function BudgetScreen() {
  const navigate = useNavigate()
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')

  useEffect(() => {
    Promise.all([
      api.listBudgets(),
      api.listCategories(),
      api.listTags(),
      api.listTransactions({ year, month }),
    ])
      .then(([b, c, t, txns]) => { setBudgets(b); setCategories(c); setTags(t); setTransactions(txns) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [year, month])

  const expenses = transactions.filter((t) => t.type !== 'income')

  const getRealizedForBudget = (b) => {
    const match = expenses.filter((t) =>
      b.categoryId ? t.categoryId === b.categoryId : t.tagIds?.includes(b.tagId)
    )
    return match.reduce((s, t) => s + (t.qty ?? 1) * (t.price ?? 0), 0)
  }

  const handleRemove = (id) => setBudgets((prev) => prev.filter((b) => b.id !== id))

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box style={{ padding: '24px 24px 16px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
        <UnstyledButton onClick={() => navigate('/home')} style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}>
          ← Back
        </UnstyledButton>
        <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9', marginTop: 12 }}>Budgets</Text>
        <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
          {now.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
      </Box>

      {/* Add form */}
      {!loading && (
        <AddBudgetForm
          categories={categories}
          tags={tags}
          onAdd={(b) => setBudgets((prev) => [...prev, b])}
        />
      )}

      {/* Budget list */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 32 }}>Loading…</Text>
        ) : budgets.length === 0 ? (
          <Box style={{ textAlign: 'center', marginTop: 40 }}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🎯</Text>
            <Text style={{ color: '#475569', fontSize: 14 }}>No budgets yet</Text>
            <Text style={{ color: '#334155', fontSize: 12, marginTop: 8 }}>Add one above to start tracking</Text>
          </Box>
        ) : (
          budgets.map((b) => (
            <BudgetRow key={b.id} budget={b} realized={getRealizedForBudget(b)} onRemove={handleRemove} />
          ))
        )}
      </Box>
    </Box>
  )
}
