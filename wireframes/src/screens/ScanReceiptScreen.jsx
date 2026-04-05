import { useState } from 'react'
import { Box, Text, Button, UnstyledButton } from '@mantine/core'

const DETECTED_ITEMS = [
  { item: 'Coffee ×2',    amount: '$9.00' },
  { item: 'Sandwich',     amount: '$8.50' },
  { item: 'Orange Juice', amount: '$4.00' },
]

export default function ScanReceiptScreen({ onBack, onDone }) {
  const [state, setState] = useState('idle') // idle | scanning | success

  const handleScan = () => {
    setState('scanning')
    setTimeout(() => setState('success'), 2000)
  }

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box style={{ padding: '24px 24px 16px', flexShrink: 0 }}>
        <UnstyledButton onClick={onBack} style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}>
          ← Back
        </UnstyledButton>
        <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9', marginTop: 12 }}>Scan Receipt</Text>
        <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
          Point your camera at a receipt to extract items automatically
        </Text>
      </Box>

      {/* Main content */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        {state === 'success' ? (
          /* ── Success state ── */
          <Box style={{ paddingBottom: 16 }}>
            <Box style={{
              textAlign: 'center', marginBottom: 20, padding: '24px 0',
            }}>
              <Box style={{
                width: 80, height: 80, borderRadius: '50%',
                background: '#0d2420', border: '2px solid #009688',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, margin: '0 auto 16px',
              }}>
                ✓
              </Box>
              <Text fw={700} style={{ fontSize: 20, color: '#f1f5f9', marginBottom: 4 }}>
                Receipt Scanned!
              </Text>
              <Text style={{ color: '#64748b', fontSize: 13 }}>
                {DETECTED_ITEMS.length} items detected
              </Text>
            </Box>

            <Box style={{
              background: '#1a1a28', border: '1px solid #2d2d4a',
              borderRadius: 14, padding: '4px 0',
            }}>
              {DETECTED_ITEMS.map((r, i) => (
                <Box key={r.item} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px',
                  borderBottom: i < DETECTED_ITEMS.length - 1 ? '1px solid #2d2d4a' : 'none',
                }}>
                  <Box style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Box style={{
                      width: 32, height: 32, borderRadius: '8px', background: '#1f0d0d',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
                    }}>
                      🛒
                    </Box>
                    <Text style={{ fontSize: 13, color: '#cbd5e1' }}>{r.item}</Text>
                  </Box>
                  <Text fw={600} style={{ fontSize: 13, color: '#f87171' }}>{r.amount}</Text>
                </Box>
              ))}
              <Box style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 16px',
                borderTop: '1px solid #2d2d4a',
                background: '#0d1020', borderRadius: '0 0 14px 14px',
              }}>
                <Text fw={700} style={{ fontSize: 14, color: '#f1f5f9' }}>Total</Text>
                <Text fw={700} style={{ fontSize: 14, color: '#4db6ac' }}>$21.50</Text>
              </Box>
            </Box>
          </Box>
        ) : (
          /* ── Viewfinder ── */
          <Box style={{ paddingBottom: 16 }}>
            <Box style={{
              width: '100%',
              aspectRatio: '3/4',
              maxHeight: 340,
              background: '#0a0a14',
              border: `2px solid ${state === 'scanning' ? '#009688' : '#2d2d4a'}`,
              borderRadius: 16,
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'border-color 0.3s',
            }}>
              {/* Corner brackets */}
              {[
                { top: 14, left: 14,  borderTop: '3px solid #009688', borderLeft:  '3px solid #009688', borderRadius: '5px 0 0 0' },
                { top: 14, right: 14, borderTop: '3px solid #009688', borderRight: '3px solid #009688', borderRadius: '0 5px 0 0' },
                { bottom: 14, left: 14,  borderBottom: '3px solid #009688', borderLeft:  '3px solid #009688', borderRadius: '0 0 0 5px' },
                { bottom: 14, right: 14, borderBottom: '3px solid #009688', borderRight: '3px solid #009688', borderRadius: '0 0 5px 0' },
              ].map((s, i) => (
                <Box key={i} style={{ position: 'absolute', width: 30, height: 30, ...s }} />
              ))}

              {state === 'scanning' ? (
                <Box style={{ textAlign: 'center', width: '80%' }}>
                  <Box style={{
                    height: 2,
                    background: 'linear-gradient(90deg, transparent, #009688, transparent)',
                    boxShadow: '0 0 12px #009688',
                    marginBottom: 20,
                  }} />
                  <Text style={{ color: '#4db6ac', fontSize: 13 }}>Scanning receipt…</Text>
                </Box>
              ) : (
                <Box style={{ textAlign: 'center' }}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>📄</Text>
                  <Text style={{ color: '#475569', fontSize: 13 }}>Position receipt in frame</Text>
                </Box>
              )}
            </Box>

            {/* Tips */}
            <Box style={{
              marginTop: 16, padding: '14px 16px',
              background: '#0d1020', borderRadius: 12, border: '1px solid #1e1e30',
            }}>
              <Text style={{ fontSize: 12, color: '#64748b' }}>
                💡 Ensure good lighting and the full receipt is visible for best results.
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      {/* Action button */}
      <Box style={{ padding: '16px 24px 28px', borderTop: '1px solid #1e1e30', flexShrink: 0 }}>
        {state === 'success' ? (
          <Button
            fullWidth size="lg" radius="xl" onClick={onDone}
            style={{ background: 'linear-gradient(135deg, #009688, #4CAF50)', height: 52, border: 'none' }}
          >
            Save to Transactions
          </Button>
        ) : (
          <Button
            fullWidth size="lg" radius="xl"
            loading={state === 'scanning'}
            onClick={handleScan}
            style={{ background: 'linear-gradient(135deg, #009688, #4CAF50)', height: 52, border: 'none' }}
          >
            {state === 'idle' ? '📷  Scan Receipt' : 'Scanning…'}
          </Button>
        )}
      </Box>
    </Box>
  )
}
