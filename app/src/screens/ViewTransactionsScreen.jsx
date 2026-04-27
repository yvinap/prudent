import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Text, Group, UnstyledButton } from '@mantine/core'
import { api } from '../lib/api'

const PERIODS = ['today', 'week', 'month', 'year', 'custom']
const PERIOD_LABELS = { today: 'Today', week: 'Week', month: 'Month', year: 'Year', custom: 'Custom' }

const DATE_INPUT = {
  flex: 1,
  padding: '8px 10px',
  background: '#1a1a2e',
  border: '1px solid #2d2d4a',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 12,
  outline: 'none',
  colorScheme: 'dark',
  boxSizing: 'border-box',
  width: '100%',
}

function fmtDate(d) {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (d === today) return 'Today'
  if (d === yesterday) return 'Yesterday'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function weekStartDate() {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().split('T')[0]
}

function filterByPeriod(txns, period, customFrom, customTo) {
  const today = new Date().toISOString().split('T')[0]
  if (period === 'custom') {
    return txns.filter((t) => {
      const d = (t.createdAt || '').split('T')[0]
      return (!customFrom || d >= customFrom) && (!customTo || d <= customTo)
    })
  }
  const starts = {
    today,
    week: weekStartDate(),
    month: today.slice(0, 7) + '-01',
    year: today.slice(0, 4) + '-01-01',
  }
  return txns.filter((t) => {
    const d = (t.createdAt || '').split('T')[0]
    return d >= starts[period] && d <= today
  })
}

function groupByDate(txns) {
  const map = {}
  txns.forEach((t) => {
    const d = (t.createdAt || '').split('T')[0]
    ;(map[d] = map[d] || []).push(t)
  })
  return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
}

export default function ViewTransactionsScreen() {
  const navigate = useNavigate()
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [things, setThings] = useState([])
  const [tags, setTags] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const now = new Date()
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')

  useEffect(() => {
    Promise.all([
      api.listTransactions({ year, month }),
      api.listCategories(),
      api.listThings(),
      api.listTags(),
    ])
      .then(([txns, cats, thingsList, tagsList]) => {
        console.log('[ViewTransactions] things:', thingsList)
        console.log('[ViewTransactions] tags:', tagsList)
        console.log('[ViewTransactions] sample txn:', txns[0])
        setTransactions(txns.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)))
        setCategories(cats)
        setThings(thingsList)
        setTags(tagsList)
      })
      .catch((err) => console.error('[ViewTransactions] load error:', err))
      .finally(() => setLoading(false))
  }, [year, month])

  const filtered = filterByPeriod(transactions, period, customFrom, customTo)
  const grouped = groupByDate(filtered)

  const totalIncome = filtered
    .filter((t) => t.type === 'income')
    .reduce((s, t) => s + (t.qty ?? 1) * (t.price ?? 0), 0)
  const totalExpense = filtered
    .filter((t) => t.type !== 'income')
    .reduce((s, t) => s + (t.qty ?? 1) * (t.price ?? 0), 0)
  const net = totalIncome - totalExpense

  const getCategoryName = (id) => categories.find((c) => c.id === id)?.name ?? ''
  const getCategoryIcon = (id) => categories.find((c) => c.id === id)?.icon ?? '💳'
  const getThingName = (id) => things.find((th) => th.id === id)?.name ?? null
  const getTagName = (id) => tags.find((tg) => tg.id === id)?.name ?? id.slice(0, 8)

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box style={{ padding: '24px 24px 0', flexShrink: 0 }}>
        <UnstyledButton onClick={() => navigate('/home')} style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}>
          ← Back
        </UnstyledButton>
        <Group justify="space-between" align="center" mt={12} mb={16}>
          <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9' }}>Transactions</Text>
          <Box
            onClick={() => navigate('/add-transaction')}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #009688, #4CAF50)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 22,
              color: 'white',
              lineHeight: 1,
            }}
          >
            +
          </Box>
        </Group>

        {/* Period filter */}
        <Box style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {PERIODS.map((p) => (
            <Box
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: '6px 16px',
                borderRadius: 20,
                cursor: 'pointer',
                flexShrink: 0,
                background: period === p ? 'linear-gradient(135deg, #009688, #4CAF50)' : '#1a1a28',
                border: `1px solid ${period === p ? 'transparent' : '#2d2d4a'}`,
                transition: 'all 0.2s',
              }}
            >
              <Text fw={600} style={{ fontSize: 12, color: period === p ? 'white' : '#64748b' }}>
                {PERIOD_LABELS[p]}
              </Text>
            </Box>
          ))}
        </Box>

        {/* Custom date range */}
        {period === 'custom' && (
          <Group gap={10} mt={12}>
            <Box style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>From</Text>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={DATE_INPUT} />
            </Box>
            <Box style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>To</Text>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={DATE_INPUT} />
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

      {/* Transaction list */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
        {loading ? (
          <Box style={{ textAlign: 'center', paddingTop: 48 }}>
            <Text style={{ color: '#475569', fontSize: 14 }}>Loading…</Text>
          </Box>
        ) : grouped.length === 0 ? (
          <Box style={{ textAlign: 'center', paddingTop: 48 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
            <Text style={{ color: '#475569', fontSize: 14 }}>No transactions in this period</Text>
          </Box>
        ) : (
          grouped.map(([date, txns]) => (
            <Box key={date} mb={20}>
              <Text fw={600} style={{ fontSize: 10, color: '#475569', letterSpacing: '0.1em', marginBottom: 8 }}>
                {fmtDate(date).toUpperCase()}
              </Text>
              <Box style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {txns.map((t) => {
                  const isExpanded = expandedId === t.id
                  const amount = (t.qty ?? 1) * (t.price ?? 0)
                  return (
                    <Box
                      key={t.id}
                      style={{
                        background: '#1a1a28',
                        borderRadius: 12,
                        border: `1px solid ${isExpanded ? '#2d3d5a' : '#2d2d4a'}`,
                        overflow: 'hidden',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      {/* Collapsed row */}
                      <Box
                        onClick={() => setExpandedId((prev) => (prev === t.id ? null : t.id))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          cursor: 'pointer',
                        }}
                      >
                        <Group gap={10}>
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
                              flexShrink: 0,
                            }}
                          >
                            {t.categoryId ? getCategoryIcon(t.categoryId) : '💳'}
                          </Box>
                          <Box>
                            <Text fw={600} style={{ fontSize: 13, color: '#e2e8f0' }}>
                              {t.thingId ? getThingName(t.thingId) || getCategoryName(t.categoryId) : getCategoryName(t.categoryId) || 'Transaction'}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#475569' }}>
                              {t.qty && t.qty > 1 ? `×${t.qty} · ` : ''}
                              ${(t.price ?? 0).toFixed(2)} each
                            </Text>
                          </Box>
                        </Group>
                        <Box style={{ textAlign: 'right' }}>
                          <Text fw={700} style={{ fontSize: 14, color: t.type === 'income' ? '#4db6ac' : '#f87171' }}>
                            {t.type === 'income' ? '+' : '-'}${amount.toFixed(2)}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>
                            {isExpanded ? '▲' : '▼'}
                          </Text>
                        </Box>
                      </Box>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <Box
                          style={{
                            padding: '0 14px 14px',
                            borderTop: '1px solid #1e1e30',
                          }}
                        >
                          <Box style={{ paddingTop: 10 }}>
                            {t.categoryId && (
                              <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                                Category: <Text component="span" style={{ color: '#94a3b8' }}>{getCategoryName(t.categoryId)}</Text>
                              </Text>
                            )}
                            <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                              Currency: <Text component="span" style={{ color: '#94a3b8' }}>{t.currency || 'USD'}</Text>
                            </Text>
                            {t.thingId && getThingName(t.thingId) && (
                              <Text style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>
                                Item: <Text component="span" style={{ color: '#94a3b8' }}>{getThingName(t.thingId)}</Text>
                              </Text>
                            )}
                            {t.tagIds?.length > 0 && (
                              <Box style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                                {t.tagIds.map((tagId) => (
                                  <Box
                                    key={tagId}
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 10,
                                      background: '#0d2420',
                                      border: '1px solid #1a4a40',
                                    }}
                                  >
                                    <Text style={{ fontSize: 11, color: '#4db6ac' }}>#{getTagName(tagId)}</Text>
                                  </Box>
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )
                })}
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  )
}
