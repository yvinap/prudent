import { Box, Text, Button, Group, Badge } from '@mantine/core'

const RECENT = [
  { id: 1, date: '2026-04-04', type: 'expense', item: 'Grocery Shopping', amount: 45.50 },
  { id: 2, date: '2026-04-03', type: 'income',  item: 'Freelance Payment', amount: 500.00 },
  { id: 3, date: '2026-04-03', type: 'expense', item: 'Coffee',            amount: 9.00 },
]

export default function HomeScreen({ onSignOut, onAddTransaction, onScanReceipt, onUploadReceipt, onViewTransactions }) {
  const ACTIONS = [
    { icon: '＋', label: 'Add Transaction', sub: 'Income or expense', onClick: onAddTransaction, accent: '#009688' },
    { icon: '📷', label: 'Scan Receipt',    sub: 'Use your camera',   onClick: onScanReceipt,    accent: '#7c3aed' },
    { icon: '📤', label: 'Upload Receipt',  sub: 'From your files',   onClick: onUploadReceipt,  accent: '#0284c7' },
    { icon: '📋', label: 'Transactions',    sub: 'View history',      onClick: onViewTransactions, accent: '#d97706' },
  ]

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
      <Box style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {/* Quick actions */}
        <Text fw={600} style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.08em', marginBottom: 12 }}>QUICK ACTIONS</Text>
        <Box style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {ACTIONS.map((a) => (
            <Box
              key={a.label}
              onClick={a.onClick}
              style={{
                padding: '16px 14px',
                background: '#1a1a28',
                borderRadius: '14px',
                border: '1px solid #2d2d4a',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = a.accent}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#2d2d4a'}
            >
              <Text style={{ fontSize: 22, marginBottom: 8 }}>{a.icon}</Text>
              <Text fw={600} style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 2 }}>{a.label}</Text>
              <Text style={{ fontSize: 11, color: '#64748b' }}>{a.sub}</Text>
            </Box>
          ))}
        </Box>

        {/* Recent transactions */}
        <Group justify="space-between" align="center" mb={12}>
          <Text fw={600} style={{ fontSize: 11, color: '#64748b', letterSpacing: '0.08em' }}>RECENT</Text>
          <Text
            style={{ fontSize: 12, color: '#009688', fontWeight: 600, cursor: 'pointer' }}
            onClick={onViewTransactions}
          >
            See all →
          </Text>
        </Group>
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
