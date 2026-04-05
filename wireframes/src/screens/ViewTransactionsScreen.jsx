import { useState } from 'react'
import { Box, Text, Group, UnstyledButton } from '@mantine/core'

const TRANSACTIONS = [
  { id: 1,  date: '2026-04-04', type: 'expense', item: 'Grocery Shopping',  tags: ['food', 'weekly'],        amount: 45.50  },
  { id: 2,  date: '2026-04-03', type: 'income',  item: 'Freelance Payment', tags: ['work', 'freelance'],     amount: 500.00 },
  { id: 3,  date: '2026-04-03', type: 'expense', item: 'Coffee',            tags: ['food', 'daily'],         amount: 9.00   },
  { id: 4,  date: '2026-04-02', type: 'expense', item: 'Electricity Bill',  tags: ['utilities'],             amount: 89.99  },
  { id: 5,  date: '2026-04-01', type: 'expense', item: 'Netflix',           tags: ['subscription'],          amount: 15.99  },
  { id: 6,  date: '2026-03-28', type: 'income',  item: 'Salary',            tags: ['work'],                  amount: 3500.00 },
  { id: 7,  date: '2026-03-25', type: 'expense', item: 'Gas Station',       tags: ['transport'],             amount: 60.00  },
  { id: 8,  date: '2026-03-20', type: 'expense', item: 'Restaurant Dinner', tags: ['food', 'entertainment'], amount: 78.50  },
  { id: 9,  date: '2026-01-15', type: 'income',  item: 'Bonus',             tags: ['work'],                  amount: 1000.00 },
  { id: 10, date: '2026-01-05', type: 'expense', item: 'Gym Membership',    tags: ['health'],                amount: 45.00  },
]

const TODAY = '2026-04-04'

function weekStart() {
  const d = new Date(TODAY)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().split('T')[0]
}

function filterByPeriod(txns, period, from, to) {
  if (period === 'custom') {
    return txns.filter(t => (!from || t.date >= from) && (!to || t.date <= to))
  }
  const starts = {
    date:  TODAY,
    week:  weekStart(),
    month: TODAY.slice(0, 7) + '-01',
    year:  TODAY.slice(0, 4) + '-01-01',
  }
  return txns.filter(t => t.date >= starts[period] && t.date <= TODAY)
}

function groupByDate(txns) {
  const map = {}
  txns.forEach(t => { (map[t.date] ??= []).push(t) })
  return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
}

function fmtDate(d) {
  const diff = Math.round((new Date(TODAY) - new Date(d)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const BASE_DATE_INPUT = {
  flex: 1, padding: '8px 10px',
  background: '#1a1a2e', border: '1px solid #2d2d4a', borderRadius: 8,
  color: '#f1f5f9', fontSize: 12, outline: 'none', colorScheme: 'dark', boxSizing: 'border-box',
  width: '100%',
}

export default function ViewTransactionsScreen({ onBack, onAdd }) {
  const PERIODS = ['date', 'week', 'month', 'year', 'custom']
  const LABELS  = { date: 'Today', week: 'Week', month: 'Month', year: 'Year', custom: 'Custom' }

  const [period,     setPeriod]     = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')

  const filtered = filterByPeriod(TRANSACTIONS, period, customFrom, customTo)
  const grouped  = groupByDate(filtered)

  const totalIncome  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const net          = totalIncome - totalExpense

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <Box style={{ padding: '24px 24px 0', flexShrink: 0 }}>
        <UnstyledButton onClick={onBack} style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}>
          ← Back
        </UnstyledButton>
        <Group justify="space-between" align="center" mt={12} mb={16}>
          <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9' }}>Transactions</Text>
          <Box
            onClick={onAdd}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'linear-gradient(135deg, #009688, #4CAF50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 22, color: 'white', lineHeight: 1,
            }}
          >
            +
          </Box>
        </Group>

        {/* Period filter pills */}
        <Box style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {PERIODS.map(p => (
            <Box
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 16px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
                background: period === p ? 'linear-gradient(135deg, #009688, #4CAF50)' : '#1a1a28',
                border: `1px solid ${period === p ? 'transparent' : '#2d2d4a'}`,
                transition: 'all 0.2s',
              }}
            >
              <Text fw={600} style={{ fontSize: 12, color: period === p ? 'white' : '#64748b' }}>
                {LABELS[p]}
              </Text>
            </Box>
          ))}
        </Box>

        {/* Custom date range */}
        {period === 'custom' && (
          <Group gap={10} mt={12}>
            <Box style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>From</Text>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={BASE_DATE_INPUT} />
            </Box>
            <Box style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>To</Text>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={BASE_DATE_INPUT} />
            </Box>
          </Group>
        )}

        {/* Summary cards */}
        <Group gap={8} mt={12} mb={4}>
          <Box style={{ flex: 1, padding: '10px 12px', background: '#0d2420', borderRadius: 10, border: '1px solid #1a4a40' }}>
            <Text style={{ fontSize: 10, color: '#4db6ac', marginBottom: 2 }}>INCOME</Text>
            <Text fw={700} style={{ fontSize: 14, color: '#4db6ac' }}>+${totalIncome.toFixed(2)}</Text>
          </Box>
          <Box style={{ flex: 1, padding: '10px 12px', background: '#1f0d0d', borderRadius: 10, border: '1px solid #4a1a1a' }}>
            <Text style={{ fontSize: 10, color: '#f87171', marginBottom: 2 }}>EXPENSES</Text>
            <Text fw={700} style={{ fontSize: 14, color: '#f87171' }}>-${totalExpense.toFixed(2)}</Text>
          </Box>
          <Box style={{ flex: 1, padding: '10px 12px', background: '#1a1a28', borderRadius: 10, border: '1px solid #2d2d4a' }}>
            <Text style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>NET</Text>
            <Text fw={700} style={{ fontSize: 14, color: net >= 0 ? '#4db6ac' : '#f87171' }}>
              {net >= 0 ? '+' : ''}{net.toFixed(2)}
            </Text>
          </Box>
        </Group>
      </Box>

      {/* Scrollable list */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
        {grouped.length === 0 ? (
          <Box style={{ textAlign: 'center', paddingTop: 48 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
            <Text style={{ color: '#475569', fontSize: 14 }}>No transactions in this period</Text>
          </Box>
        ) : (
          grouped.map(([date, txns]) => (
            <Box key={date} mb={20}>
              {/* Date group header */}
              <Text fw={600} style={{ fontSize: 10, color: '#475569', letterSpacing: '0.1em', marginBottom: 8 }}>
                {fmtDate(date).toUpperCase()}
              </Text>

              <Box style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {txns.map(t => (
                  <Box
                    key={t.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', background: '#1a1a28',
                      borderRadius: 12, border: '1px solid #2d2d4a',
                    }}
                  >
                    <Group gap={12} style={{ flex: 1, minWidth: 0 }}>
                      <Box style={{
                        width: 36, height: 36, borderRadius: '10px', flexShrink: 0,
                        background: t.type === 'income' ? '#0d2420' : '#1f0d0d',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                        color: t.type === 'income' ? '#4db6ac' : '#f87171',
                      }}>
                        {t.type === 'income' ? '↓' : '↑'}
                      </Box>
                      <Box style={{ minWidth: 0 }}>
                        <Text fw={600} style={{ fontSize: 13, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.item}
                        </Text>
                        <Box style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {t.tags.slice(0, 2).map(tag => (
                            <Text key={tag} style={{
                              fontSize: 10, color: '#4db6ac',
                              background: '#0d2420', padding: '1px 6px', borderRadius: 4,
                            }}>
                              #{tag}
                            </Text>
                          ))}
                        </Box>
                      </Box>
                    </Group>
                    <Text fw={700} style={{
                      fontSize: 14, flexShrink: 0, marginLeft: 8,
                      color: t.type === 'income' ? '#4db6ac' : '#f87171',
                    }}>
                      {t.type === 'income' ? '+' : '-'}${t.amount.toFixed(2)}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  )
}
