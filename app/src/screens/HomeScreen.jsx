import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Text, Group, Badge } from '@mantine/core'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

function BudgetBar({ budget, realized }) {
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
        padding: '12px 14px',
        background: '#111122',
        border: `1px solid ${over && isSpending ? '#3d1515' : '#1e1e30'}`,
        borderRadius: 12,
      }}
    >
      <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Text style={{ fontSize: 14 }}>{budget.icon || '📌'}</Text>
          <Text fw={600} style={{ fontSize: 13, color: '#cbd5e1' }}>{budget.name}</Text>
          <Box
            style={{
              padding: '1px 7px',
              borderRadius: 8,
              background: isSpending ? '#1a1a2e' : '#0d2018',
              border: `1px solid ${isSpending ? '#2d2d4a' : '#166534'}`,
            }}
          >
            <Text style={{ fontSize: 10, color: isSpending ? '#64748b' : '#4ade80', fontWeight: 600 }}>
              {isSpending ? 'SPEND' : 'SAVE'}
            </Text>
          </Box>
        </Box>
        <Box style={{ textAlign: 'right' }}>
          <Text fw={700} style={{ fontSize: 13, color: barColor }}>
            ${realized.toFixed(0)}
            <Text component="span" fw={400} style={{ fontSize: 11, color: '#475569' }}>
              {' '}/ ${budget.amount}
            </Text>
          </Text>
        </Box>
      </Box>

      <Box style={{ height: 6, background: '#1e1e30', borderRadius: 4, overflow: 'hidden', marginBottom: 5 }}>
        <Box
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 4,
            background: barColor,
            transition: 'width 0.4s ease',
            boxShadow: `0 0 6px ${barColor}66`,
          }}
        />
      </Box>

      <Text style={{ fontSize: 11, color: '#475569' }}>
        {isSpending
          ? over
            ? `$${Math.abs(remaining).toFixed(0)} over budget`
            : `$${remaining.toFixed(0)} left this ${budget.period}`
          : pct >= 100
            ? 'Goal reached! 🎉'
            : `$${remaining.toFixed(0)} to go this ${budget.period}`}
      </Text>
    </Box>
  )
}

function fmtDate(d) {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (d === today) return 'Today'
  if (d === yesterday) return 'Yesterday'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function HomeScreen() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [transactions, setTransactions] = useState([])
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  useEffect(() => {
    Promise.all([
      api.listTransactions({ year, month }),
      api.listBudgets(),
      api.listCategories(),
    ])
      .then(([txns, bdgs, cats]) => {
        setTransactions(txns)
        setBudgets(bdgs)
        setCategories(cats)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [year, month])

  const expenses = transactions.filter((t) => t.type !== 'income')
  const income = transactions.filter((t) => t.type === 'income')
  const totalExpenses = expenses.reduce((s, t) => s + (t.qty ?? 1) * (t.price ?? 0), 0)
  const totalIncome = income.reduce((s, t) => s + (t.qty ?? 1) * (t.price ?? 0), 0)
  const net = totalIncome - totalExpenses

  // Compute realized amounts for budgets
  const budgetsWithRealized = budgets.map((b) => {
    const match = expenses.filter((t) =>
      b.categoryId ? t.categoryId === b.categoryId : t.tagIds?.includes(b.tagId)
    )
    const realized = match.reduce((s, t) => s + (t.qty ?? 1) * (t.price ?? 0), 0)
    return { ...b, realized }
  })

  // Recent: last 5 transactions sorted newest first
  const recent = [...transactions]
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    .slice(0, 5)

  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name ?? 'Uncategorised'
  const getCategoryIcon = (id) => categories.find((c) => c.id === id)?.icon ?? '📌'

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box
        style={{
          padding: '28px 24px 24px',
          background: 'linear-gradient(135deg, #009688, #4CAF50)',
          flexShrink: 0,
        }}
      >
        <Group justify="space-between" align="center" mb={20}>
          <Group gap={8}>
            <Box
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text fw={800} c="white" size="sm">P</Text>
            </Box>
            <Text fw={700} c="white" size="md">Prudent</Text>
          </Group>
          <Badge
            radius="xl"
            size="sm"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', cursor: 'pointer' }}
            onClick={signOut}
          >
            Sign out
          </Badge>
        </Group>
        <Text c="white" style={{ opacity: 0.85, fontSize: 13 }}>
          {user?.firstName ? `Hi, ${user.firstName} · ` : ''}{monthLabel}
        </Text>
        <Text c="white" fw={800} style={{ fontSize: 30, marginTop: 2 }}>
          ${net.toFixed(2)}
        </Text>
        <Group gap={20} mt={8}>
          <Box>
            <Text c="white" style={{ opacity: 0.7, fontSize: 11 }}>INCOME</Text>
            <Text c="white" fw={600} style={{ fontSize: 14 }}>+${totalIncome.toFixed(2)}</Text>
          </Box>
          <Box style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.3)' }} />
          <Box>
            <Text c="white" style={{ opacity: 0.7, fontSize: 11 }}>EXPENSES</Text>
            <Text c="white" fw={600} style={{ fontSize: 14 }}>-${totalExpenses.toFixed(2)}</Text>
          </Box>
        </Group>
      </Box>

      {/* Scrollable content */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {/* Quick Add hero */}
        <Box
          onClick={() => navigate('/quick-add')}
          style={{
            padding: '18px 20px',
            marginBottom: 12,
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            borderRadius: 16,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(249,115,22,0.35)',
          }}
        >
          <Box>
            <Text fw={800} style={{ fontSize: 16, color: 'white', marginBottom: 2 }}>⚡ Quick Add</Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)' }}>Tap amount & category — done</Text>
          </Box>
          <Text style={{ fontSize: 28, opacity: 0.9 }}>→</Text>
        </Box>

        {/* Scan Receipt + Transactions grid */}
        <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          <Box
            onClick={() => navigate('/scan-receipt')}
            style={{
              padding: '18px 14px',
              borderRadius: 16,
              cursor: 'pointer',
              background: '#160d2e',
              border: '1px solid #3b1f6e',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 28 }}>📷</Text>
            <Box>
              <Text fw={700} style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 3 }}>Scan Receipt</Text>
              <Text style={{ fontSize: 11, color: '#64748b' }}>Use your camera</Text>
            </Box>
          </Box>

          <Box
            onClick={() => navigate('/transactions')}
            style={{
              padding: '18px 14px',
              borderRadius: 16,
              cursor: 'pointer',
              background: '#1a150a',
              border: '1px solid #5a3e10',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 28 }}>📋</Text>
            <Box>
              <Text fw={700} style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 3 }}>Transactions</Text>
              <Text style={{ fontSize: 11, color: '#64748b' }}>View history</Text>
            </Box>
          </Box>
        </Box>

        {/* More actions grid */}
        <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          <Box
            onClick={() => navigate('/add-transaction')}
            style={{
              padding: '14px',
              borderRadius: 16,
              cursor: 'pointer',
              background: '#0d1a1a',
              border: '1px solid #1a3a3a',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 22 }}>➕</Text>
            <Text fw={600} style={{ fontSize: 13, color: '#4db6ac' }}>Add Transaction</Text>
          </Box>
          <Box
            onClick={() => navigate('/upload-receipt')}
            style={{
              padding: '14px',
              borderRadius: 16,
              cursor: 'pointer',
              background: '#0d1a1a',
              border: '1px solid #1a3a3a',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 22 }}>📤</Text>
            <Text fw={600} style={{ fontSize: 13, color: '#4db6ac' }}>Upload Receipt</Text>
          </Box>
          <Box
            onClick={() => navigate('/library')}
            style={{
              padding: '14px',
              borderRadius: 16,
              cursor: 'pointer',
              background: '#0d1a1a',
              border: '1px solid #1a3a3a',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 22 }}>📚</Text>
            <Text fw={600} style={{ fontSize: 13, color: '#4db6ac' }}>Manage Library</Text>
          </Box>
          <Box
            onClick={() => navigate('/budgets')}
            style={{
              padding: '14px',
              borderRadius: 16,
              cursor: 'pointer',
              background: '#0d1a1a',
              border: '1px solid #1a3a3a',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Text style={{ fontSize: 22 }}>🎯</Text>
            <Text fw={600} style={{ fontSize: 13, color: '#4db6ac' }}>Budgets</Text>
          </Box>
        </Box>

        {/* Budget snapshot */}
        {budgetsWithRealized.length > 0 && (
          <>
            <Group justify="space-between" align="center" mb={12}>
              <Text fw={600} style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.08em' }}>
                BUDGETS — {monthLabel.toUpperCase()}
              </Text>
              <Text
                style={{ fontSize: 12, color: '#009688', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => navigate('/budgets')}
              >
                Manage →
              </Text>
            </Group>
            <Box style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {budgetsWithRealized.slice(0, 4).map((b) => (
                <BudgetBar key={b.id} budget={b} realized={b.realized} />
              ))}
            </Box>
          </>
        )}

        {/* Recent transactions */}
        <Group justify="space-between" align="center" mb={12}>
          <Text fw={600} style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.08em' }}>RECENT</Text>
          <Text
            style={{ fontSize: 12, color: '#009688', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => navigate('/transactions')}
          >
            See all →
          </Text>
        </Group>

        {loading ? (
          <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: 20 }}>Loading…</Text>
        ) : recent.length === 0 ? (
          <Box style={{ textAlign: 'center', padding: '24px 0' }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📭</Text>
            <Text style={{ color: '#475569', fontSize: 13 }}>No transactions yet this month</Text>
            <Text
              style={{ color: '#009688', fontSize: 13, marginTop: 8, cursor: 'pointer', fontWeight: 600 }}
              onClick={() => navigate('/quick-add')}
            >
              Add your first →
            </Text>
          </Box>
        ) : (
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {recent.map((t) => (
              <Box
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: '#1a1a28',
                  borderRadius: 12,
                  border: '1px solid #2d2d4a',
                }}
              >
                <Group gap={12}>
                  <Box
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: t.type === 'income' ? '#0d2420' : '#1f0d0d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                    }}
                  >
                    {t.categoryId ? getCategoryIcon(t.categoryId) : '💳'}
                  </Box>
                  <Box>
                    <Text fw={600} style={{ fontSize: 13, color: '#e2e8f0' }}>
                      {t.categoryId ? getCategoryName(t.categoryId) : 'Transaction'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#475569' }}>
                      {t.createdAt ? fmtDate(t.createdAt.split('T')[0]) : ''}
                    </Text>
                  </Box>
                </Group>
                <Text
                  fw={700}
                  style={{ fontSize: 14, color: t.type === 'income' ? '#4db6ac' : '#f87171' }}
                >
                  {t.type === 'income' ? '+' : '-'}${((t.qty ?? 1) * (t.price ?? 0)).toFixed(2)}
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
