import { useState } from 'react'
import { Box, Text, Button, Group, Badge } from '@mantine/core'

const RECENT = [
  { id: 1, date: '2026-04-04', type: 'expense', item: 'Grocery Shopping', amount: 45.50 },
  { id: 2, date: '2026-04-03', type: 'income',  item: 'Freelance Payment', amount: 500.00 },
  { id: 3, date: '2026-04-03', type: 'expense', item: 'Coffee',            amount: 9.00 },
]

// Seed budgets with realized amounts computed from transactions
const BUDGETS = [
  { id: 1, name: 'Food',          icon: '🍔', type: 'spending', period: 'month', amount: 300, realized: 198.50, color: '#f97316' },
  { id: 2, name: 'Entertainment', icon: '🎬', type: 'spending', period: 'month', amount: 100, realized: 95.00,  color: '#c084fc' },
  { id: 3, name: 'Transport',     icon: '🚌', type: 'spending', period: 'month', amount: 150, realized: 60.00,  color: '#60a5fa' },
  { id: 4, name: 'Savings Goal',  icon: '💰', type: 'saving',   period: 'month', amount: 500, realized: 320.00, color: '#4ade80' },
]

function BudgetBar({ budget }) {
  const pct = Math.min((budget.realized / budget.amount) * 100, 100)
  const over = budget.realized > budget.amount
  const isSpending = budget.type === 'spending'

  // spending: green → amber → red as you approach/exceed limit
  // saving: red → green as you approach goal
  let barColor
  if (isSpending) {
    barColor = over ? '#ef4444' : pct > 80 ? '#f59e0b' : budget.color
  } else {
    barColor = pct >= 100 ? '#4ade80' : pct > 60 ? '#f59e0b' : '#ef4444'
  }

  const remaining = budget.amount - budget.realized

  return (
    <Box style={{ padding: '12px 14px', background: '#111122', border: `1px solid ${over && isSpending ? '#3d1515' : '#1e1e30'}`, borderRadius: 12 }}>
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Text style={{ fontSize: 14 }}>{budget.icon}</Text>
          <Text fw={600} style={{ fontSize: 13, color: '#cbd5e1' }}>{budget.name}</Text>
          <Box style={{
            padding: '1px 7px', borderRadius: 8,
            background: isSpending ? '#1a1a2e' : '#0d2018',
            border: `1px solid ${isSpending ? '#2d2d4a' : '#166534'}`,
          }}>
            <Text style={{ fontSize: 10, color: isSpending ? '#64748b' : '#4ade80', fontWeight: 600 }}>
              {isSpending ? 'SPEND' : 'SAVE'}
            </Text>
          </Box>
        </Box>
        <Box style={{ textAlign: 'right' }}>
          <Text fw={700} style={{ fontSize: 13, color: barColor }}>
            ${budget.realized.toFixed(0)}
            <Text component="span" fw={400} style={{ fontSize: 11, color: '#475569' }}> / ${budget.amount}</Text>
          </Text>
        </Box>
      </Box>

      {/* Progress track */}
      <Box style={{ height: 6, background: '#1e1e30', borderRadius: 4, overflow: 'hidden', marginBottom: 5 }}>
        <Box style={{
          height: '100%', width: `${pct}%`, borderRadius: 4,
          background: barColor,
          transition: 'width 0.4s ease',
          boxShadow: `0 0 6px ${barColor}66`,
        }} />
      </Box>

      <Text style={{ fontSize: 11, color: '#475569' }}>
        {isSpending
          ? over
            ? `$${Math.abs(remaining).toFixed(0)} over budget`
            : `$${remaining.toFixed(0)} left this ${budget.period}`
          : pct >= 100
            ? `Goal reached! 🎉`
            : `$${remaining.toFixed(0)} to go this ${budget.period}`
        }
      </Text>
    </Box>
  )
}

export default function HomeScreen({ onSignOut, onAddTransaction, onQuickAdd, onScanReceipt, onUploadReceipt, onViewTransactions, onManageLibrary, onManageBudgets }) {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box style={{ padding: '28px 24px 24px', background: 'linear-gradient(135deg, #009688, #4CAF50)', flexShrink: 0 }}>
        <Group justify="space-between" align="center" mb={20}>
          <Group gap={8}>
            <Box style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text fw={800} c="white" size="sm">P</Text>
            </Box>
            <Text fw={700} c="white" size="md">Prudent</Text>
          </Group>
          <Badge radius="xl" size="sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }}>
            ✓ Signed in
          </Badge>
        </Group>
        <Text c="white" style={{ opacity: 0.85, fontSize: 13 }}>April 2026</Text>
        <Text c="white" fw={800} style={{ fontSize: 30, marginTop: 2 }}>$3,954.50</Text>
        <Group gap={20} mt={8}>
          <Box>
            <Text c="white" style={{ opacity: 0.7, fontSize: 11 }}>INCOME</Text>
            <Text c="white" fw={600} style={{ fontSize: 14 }}>+$4,500.00</Text>
          </Box>
          <Box style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.3)' }} />
          <Box>
            <Text c="white" style={{ opacity: 0.7, fontSize: 11 }}>EXPENSES</Text>
            <Text c="white" fw={600} style={{ fontSize: 14 }}>-$545.50</Text>
          </Box>
        </Group>
      </Box>

      {/* Scrollable content */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '20px 20px' }}>

        {/* ── Primary: Quick Add hero button ── */}
        <Box
          onClick={onQuickAdd}
          style={{
            padding: '18px 20px', marginBottom: 12,
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            borderRadius: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(249,115,22,0.35)',
          }}
        >
          <Box>
            <Text fw={800} style={{ fontSize: 16, color: 'white', marginBottom: 2 }}>⚡ Quick Add</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Tap amount & category — done</Text>
          </Box>
          <Text style={{ fontSize: 28, opacity: 0.9 }}>→</Text>
        </Box>

        {/* ── Primary: Scan Receipt + Transactions 2-col ── */}
        <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          <Box
            onClick={onScanReceipt}
            style={{
              padding: '18px 14px', borderRadius: 16, cursor: 'pointer',
              background: '#160d2e', border: '1px solid #3b1f6e',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#3b1f6e'}
          >
            <Text style={{ fontSize: 28 }}>📷</Text>
            <Box>
              <Text fw={700} style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 3 }}>Scan Receipt</Text>
              <Text style={{ fontSize: 11, color: '#64748b' }}>Use your camera</Text>
            </Box>
          </Box>

          <Box
            onClick={onViewTransactions}
            style={{
              padding: '18px 14px', borderRadius: 16, cursor: 'pointer',
              background: '#1a150a', border: '1px solid #5a3e10',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = '#d97706'}
            onMouseLeave={e => e.currentTarget.style.borderColor = '#5a3e10'}
          >
            <Text style={{ fontSize: 28 }}>📋</Text>
            <Box>
              <Text fw={700} style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 3 }}>Transactions</Text>
              <Text style={{ fontSize: 11, color: '#64748b' }}>View history</Text>
            </Box>
          </Box>
        </Box>

        {/* ── Budget snapshot ── */}
        <Group justify="space-between" align="center" mb={12}>
          <Text fw={600} style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.08em' }}>BUDGETS — APRIL</Text>
          <Text
            style={{ fontSize: 12, color: '#009688', fontWeight: 600, cursor: 'pointer' }}
            onClick={onManageBudgets}
          >
            Manage →
          </Text>
        </Group>
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {BUDGETS.map(b => <BudgetBar key={b.id} budget={b} />)}
        </Box>

        {/* ── Recent transactions ── */}
        <Group justify="space-between" align="center" mb={12}>
          <Text fw={600} style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.08em' }}>RECENT</Text>
          <Text
            style={{ fontSize: 12, color: '#009688', fontWeight: 600, cursor: 'pointer' }}
            onClick={onViewTransactions}
          >
            See all →
          </Text>
        </Group>
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {RECENT.map(t => (
            <Box key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#1a1a28', borderRadius: '12px', border: '1px solid #2d2d4a' }}>
              <Group gap={12}>
                <Box style={{ width: 36, height: 36, borderRadius: '10px', background: t.type === 'income' ? '#0d2420' : '#1f0d0d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                  {t.type === 'income' ? '↓' : '↑'}
                </Box>
                <Box>
                  <Text fw={600} style={{ fontSize: 13, color: '#e2e8f0' }}>{t.item}</Text>
                  <Text style={{ fontSize: 11, color: '#475569' }}>{t.date}</Text>
                </Box>
              </Group>
              <Text fw={700} style={{ fontSize: 13, color: t.type === 'income' ? '#4db6ac' : '#f87171' }}>
                {t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
              </Text>
            </Box>
          ))}
        </Box>

        {/* ── Secondary: collapsible "More" row ── */}
        <Box
          onClick={() => setMoreOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
            background: '#111122', border: '1px solid #1e1e30',
            marginBottom: moreOpen ? 10 : 0,
          }}
        >
          <Text style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>More options</Text>
          <Text style={{ fontSize: 13, color: '#334155', display: 'inline-block', transform: moreOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            ⌄
          </Text>
        </Box>

        {moreOpen && (
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { icon: '＋', label: 'Add Transaction', sub: 'Manual entry with full detail',      onClick: onAddTransaction },
              { icon: '📤', label: 'Upload Receipt',  sub: 'From your files',                    onClick: onUploadReceipt },
              { icon: '🗂️', label: 'Library',         sub: 'Manage things, categories, tags',    onClick: onManageLibrary },
              { icon: '🎯', label: 'Budgets',         sub: 'Set spend & saving targets',         onClick: onManageBudgets },
            ].map(a => (
              <Box
                key={a.label}
                onClick={a.onClick}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                  background: '#111122', border: '1px solid #1e1e30',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#161628'}
                onMouseLeave={e => e.currentTarget.style.background = '#111122'}
              >
                <Text style={{ fontSize: 20, flexShrink: 0 }}>{a.icon}</Text>
                <Box>
                  <Text fw={600} style={{ fontSize: 13, color: '#94a3b8' }}>{a.label}</Text>
                  <Text style={{ fontSize: 11, color: '#334155' }}>{a.sub}</Text>
                </Box>
              </Box>
            ))}
          </Box>
        )}

      </Box>

      {/* Sign out */}
      <Box style={{ padding: '12px 24px 24px', flexShrink: 0, borderTop: '1px solid #1e1e30' }}>
        <Button fullWidth variant="subtle" color="gray" radius="xl" size="sm" onClick={onSignOut}>
          Sign out
        </Button>
      </Box>
    </Box>
  )
}

