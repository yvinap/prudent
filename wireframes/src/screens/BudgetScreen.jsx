import { useState } from 'react'
import { Box, Text, UnstyledButton } from '@mantine/core'

// ─── Seed data ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { name: 'Food',          icon: '🍔', color: '#f97316' },
  { name: 'Coffee',        icon: '☕', color: '#d97706' },
  { name: 'Transport',     icon: '🚌', color: '#60a5fa' },
  { name: 'Groceries',     icon: '🛒', color: '#4ade80' },
  { name: 'Bills',         icon: '⚡', color: '#facc15' },
  { name: 'Entertainment', icon: '🎬', color: '#c084fc' },
  { name: 'Health',        icon: '💊', color: '#f472b6' },
  { name: 'Shopping',      icon: '🛍️', color: '#38bdf8' },
]

const TAGS = ['reimbursable', 'recurring', 'work trip', 'daily', 'one-time']

const SEED_BUDGETS = [
  { id: 1, name: 'Food',          icon: '🍔', color: '#f97316', type: 'spending', period: 'month', amount: 300,  realized: 198.50, scope: 'category' },
  { id: 2, name: 'Entertainment', icon: '🎬', color: '#c084fc', type: 'spending', period: 'month', amount: 100,  realized: 95.00,  scope: 'category' },
  { id: 3, name: 'Transport',     icon: '🚌', color: '#60a5fa', type: 'spending', period: 'month', amount: 150,  realized: 60.00,  scope: 'category' },
  { id: 4, name: 'Savings Goal',  icon: '💰', color: '#4ade80', type: 'saving',   period: 'month', amount: 500,  realized: 320.00, scope: 'tag',      tag: 'recurring' },
  { id: 5, name: 'Work Trips',    icon: '✈️', color: '#38bdf8', type: 'spending', period: 'year',  amount: 2000, realized: 480.00, scope: 'tag',      tag: 'work trip' },
]

const INPUT_STYLE = {
  width: '100%', padding: '10px 14px',
  background: '#111122', border: '1px solid #1e1e30',
  borderRadius: 10, color: '#f1f5f9', fontSize: 14,
  outline: 'none', boxSizing: 'border-box',
}

// ─── Progress bar row ─────────────────────────────────────────────────────────
function BudgetRow({ budget, onDelete }) {
  const pct = Math.min((budget.realized / budget.amount) * 100, 100)
  const over = budget.realized > budget.amount
  const isSpending = budget.type === 'spending'
  const remaining = budget.amount - budget.realized

  let barColor
  if (isSpending) {
    barColor = over ? '#ef4444' : pct > 80 ? '#f59e0b' : budget.color
  } else {
    barColor = pct >= 100 ? '#4ade80' : pct > 60 ? '#f59e0b' : '#ef4444'
  }

  return (
    <Box style={{
      padding: '14px', background: '#111122',
      border: `1px solid ${over && isSpending ? '#3d1515' : '#1e1e30'}`,
      borderRadius: 12,
    }}>
      {/* Top row */}
      <Box style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <Box style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: budget.color + '22', border: `1px solid ${budget.color}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>{budget.icon}</Box>
          <Box style={{ minWidth: 0 }}>
            <Text fw={600} style={{ fontSize: 13, color: '#cbd5e1' }}>{budget.name}</Text>
            <Box style={{ display: 'flex', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
              <Box style={{
                padding: '1px 7px', borderRadius: 8,
                background: isSpending ? '#1a1a2e' : '#0d2018',
                border: `1px solid ${isSpending ? '#2d2d4a' : '#166534'}`,
              }}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: isSpending ? '#64748b' : '#4ade80' }}>
                  {isSpending ? 'SPEND' : 'SAVE'}
                </Text>
              </Box>
              <Box style={{ padding: '1px 7px', borderRadius: 8, background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>
                  {budget.period === 'month' ? 'MONTHLY' : 'YEARLY'}
                </Text>
              </Box>
              <Box style={{ padding: '1px 7px', borderRadius: 8, background: '#1a1a2e', border: '1px solid #2d2d4a' }}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: '#475569' }}>
                  {budget.scope === 'tag' ? `#${budget.tag}` : 'category'}
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
        <Box style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
          <Text fw={700} style={{ fontSize: 14, color: barColor }}>
            ${budget.realized.toFixed(0)}
            <Text component="span" fw={400} style={{ fontSize: 11, color: '#475569' }}>
              {' '}/ ${budget.amount}
            </Text>
          </Text>
          <UnstyledButton
            onClick={() => onDelete(budget.id)}
            style={{ fontSize: 12, color: '#334155', marginTop: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
            onMouseLeave={e => e.currentTarget.style.color = '#334155'}
          >
            Remove
          </UnstyledButton>
        </Box>
      </Box>

      {/* Progress bar */}
      <Box style={{ height: 7, background: '#1e1e30', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
        <Box style={{
          height: '100%', width: `${pct}%`, borderRadius: 4,
          background: barColor, boxShadow: `0 0 8px ${barColor}55`,
          transition: 'width 0.4s ease',
        }} />
      </Box>

      <Text style={{ fontSize: 11, color: '#475569' }}>
        {isSpending
          ? over
            ? `⚠ $${Math.abs(remaining).toFixed(0)} over budget this ${budget.period}`
            : `$${remaining.toFixed(0)} remaining · ${Math.round(pct)}% used`
          : pct >= 100
            ? `🎉 Saving goal reached!`
            : `$${remaining.toFixed(0)} to reach goal · ${Math.round(pct)}% saved`
        }
      </Text>
    </Box>
  )
}

// ─── Add budget form ──────────────────────────────────────────────────────────
function AddBudgetForm({ onAdd }) {
  const [scope, setScope]   = useState('category')   // 'category' | 'tag'
  const [cat, setCat]       = useState(null)
  const [tag, setTag]       = useState(null)
  const [btype, setBtype]   = useState('spending')   // 'spending' | 'saving'
  const [period, setPeriod] = useState('month')
  const [amount, setAmount] = useState('')
  const [error, setError]   = useState('')

  const selectedCat = CATEGORIES.find(c => c.name === cat)

  const save = () => {
    const v = parseFloat(amount)
    if (!amount || isNaN(v) || v <= 0) { setError('Enter a valid amount'); return }
    if (scope === 'category' && !cat) { setError('Select a category'); return }
    if (scope === 'tag' && !tag) { setError('Select a tag'); return }

    const label = scope === 'category' ? cat : tag
    const icon  = scope === 'category' ? (selectedCat?.icon ?? '📌') : '🏷️'
    const color = scope === 'category' ? (selectedCat?.color ?? '#94a3b8') : '#38bdf8'

    onAdd({ name: label, icon, color, type: btype, period, amount: v, realized: 0, scope, tag: scope === 'tag' ? tag : undefined })
    setAmount(''); setCat(null); setTag(null); setError('')
  }

  return (
    <Box style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
      <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
        New Budget
      </Text>

      {/* Spend / Save toggle */}
      <Box style={{ display: 'flex', background: '#0d0d18', borderRadius: 10, padding: 3, gap: 3, marginBottom: 12 }}>
        {['spending', 'saving'].map(t => (
          <Box key={t} onClick={() => setBtype(t)} style={{
            flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
            background: btype === t ? (t === 'spending' ? '#2d0f0f' : '#0d2420') : 'transparent',
            border: btype === t ? `1px solid ${t === 'spending' ? '#7f1d1d' : '#1a4a40'}` : '1px solid transparent',
          }}>
            <Text fw={700} style={{ fontSize: 12, color: btype === t ? (t === 'spending' ? '#f87171' : '#4db6ac') : '#475569' }}>
              {t === 'spending' ? '↑ Spending limit' : '↓ Saving goal'}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Monthly / Yearly toggle */}
      <Box style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['month', 'year'].map(p => (
          <Box key={p} onClick={() => setPeriod(p)} style={{
            flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
            background: period === p ? '#111122' : 'transparent',
            border: `1px solid ${period === p ? '#2d2d4a' : '#1e1e30'}`,
          }}>
            <Text fw={period === p ? 700 : 400} style={{ fontSize: 12, color: period === p ? '#94a3b8' : '#334155' }}>
              {p === 'month' ? 'Monthly' : 'Yearly'}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Scope toggle: category vs tag */}
      <Box style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {['category', 'tag'].map(s => (
          <Box key={s} onClick={() => { setScope(s); setCat(null); setTag(null) }} style={{
            flex: 1, padding: '8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
            background: scope === s ? '#111122' : 'transparent',
            border: `1px solid ${scope === s ? '#2d2d4a' : '#1e1e30'}`,
          }}>
            <Text fw={scope === s ? 700 : 400} style={{ fontSize: 12, color: scope === s ? '#94a3b8' : '#334155' }}>
              {s === 'category' ? 'By category' : 'By tag'}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Category chips */}
      {scope === 'category' && (
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {CATEGORIES.map(c => {
            const active = cat === c.name
            return (
              <Box key={c.name} onClick={() => setCat(active ? null : c.name)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 16, cursor: 'pointer',
                background: active ? c.color + '22' : '#111122',
                border: `1.5px solid ${active ? c.color + '88' : '#1e1e30'}`,
                userSelect: 'none',
              }}>
                <Text style={{ fontSize: 13 }}>{c.icon}</Text>
                <Text style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? c.color : '#475569' }}>{c.name}</Text>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Tag chips */}
      {scope === 'tag' && (
        <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {TAGS.map(t => {
            const active = tag === t
            return (
              <Box key={t} onClick={() => setTag(active ? null : t)} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 16, cursor: 'pointer',
                background: active ? '#0e1e2d' : '#111122',
                border: `1.5px solid ${active ? '#1e4a6e' : '#1e1e30'}`,
                userSelect: 'none',
              }}>
                <Text style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? '#38bdf8' : '#475569' }}>#{t}</Text>
              </Box>
            )
          })}
        </Box>
      )}

      {/* Amount row */}
      <Box style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Box style={{ position: 'relative', flex: 1 }}>
          <Text style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, color: '#475569', pointerEvents: 'none',
          }}>$</Text>
          <input
            type="number" min="1" step="1"
            value={amount}
            onChange={e => { setAmount(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="Amount"
            style={{ ...INPUT_STYLE, paddingLeft: 26 }}
          />
        </Box>
        <Box
          onClick={save}
          style={{
            padding: '10px 18px', borderRadius: 10, cursor: 'pointer', flexShrink: 0,
            background: amount && (cat || tag) ? 'linear-gradient(135deg, #009688, #4CAF50)' : '#1a1a2e',
            border: amount && (cat || tag) ? 'none' : '1px solid #2d2d4a',
          }}
        >
          <Text fw={700} style={{ fontSize: 14, color: amount && (cat || tag) ? 'white' : '#334155' }}>Add</Text>
        </Box>
      </Box>
      {error && <Text style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>{error}</Text>}
    </Box>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function BudgetScreen({ onBack }) {
  const [budgets, setBudgets] = useState(SEED_BUDGETS)

  const addBudget = (b) => setBudgets(prev => [{ ...b, id: Date.now(), realized: 0 }, ...prev])
  const deleteBudget = (id) => setBudgets(prev => prev.filter(b => b.id !== id))

  const spending = budgets.filter(b => b.type === 'spending')
  const saving   = budgets.filter(b => b.type === 'saving')

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0d0d18' }}>

      {/* Header */}
      <Box style={{ padding: '20px 20px 16px', flexShrink: 0, borderBottom: '1px solid #1e1e30' }}>
        <UnstyledButton onClick={onBack} style={{ color: '#009688', fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
          ← Back
        </UnstyledButton>
        <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9' }}>Budgets</Text>
        <Text style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>April 2026</Text>
      </Box>

      {/* Add form */}
      <AddBudgetForm onAdd={addBudget} />

      {/* Budget list */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {spending.length > 0 && (
          <>
            <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Spending Limits
            </Text>
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {spending.map(b => <BudgetRow key={b.id} budget={b} onDelete={deleteBudget} />)}
            </Box>
          </>
        )}

        {saving.length > 0 && (
          <>
            <Text style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
              Saving Goals
            </Text>
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {saving.map(b => <BudgetRow key={b.id} budget={b} onDelete={deleteBudget} />)}
            </Box>
          </>
        )}

        {budgets.length === 0 && (
          <Text style={{ fontSize: 13, color: '#334155', textAlign: 'center', marginTop: 40 }}>
            No budgets yet — add one above
          </Text>
        )}
      </Box>

    </Box>
  )
}
