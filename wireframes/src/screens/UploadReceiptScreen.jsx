import { useState, useRef } from 'react'
import { Box, Text, Button, UnstyledButton } from '@mantine/core'

const DETECTED_ITEMS = [
  { item: 'Lunch',  amount: '$12.00' },
  { item: 'Coffee', amount: '$4.50'  },
]

export default function UploadReceiptScreen({ onBack, onDone }) {
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [done, setDone] = useState(false)
  const inputRef = useRef(null)

  const handleFile = (f) => {
    if (f) setFile(f)
  }

  const handleProcess = () => {
    setProcessing(true)
    setTimeout(() => { setProcessing(false); setDone(true) }, 1500)
  }

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box style={{ padding: '24px 24px 16px', flexShrink: 0 }}>
        <UnstyledButton onClick={onBack} style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}>
          ← Back
        </UnstyledButton>
        <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9', marginTop: 12 }}>Upload Receipt</Text>
        <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
          Upload an image or PDF of your receipt
        </Text>
      </Box>

      {/* Content */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
        {done ? (
          /* ── Success state ── */
          <Box>
            <Box style={{ textAlign: 'center', padding: '24px 0 20px' }}>
              <Box style={{
                width: 80, height: 80, borderRadius: '50%',
                background: '#0d2420', border: '2px solid #009688',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, margin: '0 auto 16px',
              }}>
                ✓
              </Box>
              <Text fw={700} style={{ fontSize: 20, color: '#f1f5f9', marginBottom: 4 }}>
                Receipt Processed!
              </Text>
              <Text style={{ color: '#64748b', fontSize: 13 }}>
                {file?.name ?? 'receipt.jpg'} — {DETECTED_ITEMS.length} items detected
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
                <Text fw={700} style={{ fontSize: 14, color: '#4db6ac' }}>$16.50</Text>
              </Box>
            </Box>
          </Box>
        ) : (
          /* ── Upload state ── */
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Drop zone */}
            <Box
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#009688' : file ? '#1a4a40' : '#2d2d4a'}`,
                borderRadius: 16, padding: '40px 24px', textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? '#0d2420' : file ? '#0d2420' : '#13131f',
                transition: 'all 0.2s',
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
              {file ? (
                <>
                  <Text style={{ fontSize: 40, marginBottom: 10 }}>🖼️</Text>
                  <Text fw={600} style={{ color: '#4db6ac', fontSize: 14 }}>{file.name}</Text>
                  <Text style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>
                    {(file.size / 1024).toFixed(1)} KB — Tap to change
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 40, marginBottom: 12 }}>📤</Text>
                  <Text fw={600} style={{ color: '#94a3b8', fontSize: 14 }}>Drag & drop or tap to upload</Text>
                  <Text style={{ color: '#475569', fontSize: 12, marginTop: 6 }}>Supports JPG, PNG, PDF</Text>
                </>
              )}
            </Box>

            {/* Divider */}
            <Box style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Box style={{ flex: 1, height: 1, background: '#2d2d4a' }} />
              <Text style={{ color: '#475569', fontSize: 12 }}>or</Text>
              <Box style={{ flex: 1, height: 1, background: '#2d2d4a' }} />
            </Box>

            <Button
              fullWidth variant="outline" color="teal" radius="xl" size="md"
              onClick={() => inputRef.current?.click()}
              style={{ borderColor: '#00796b', color: '#4db6ac' }}
            >
              Browse Files
            </Button>
          </Box>
        )}
      </Box>

      {/* Action button */}
      <Box style={{ padding: '16px 24px 28px', borderTop: '1px solid #1e1e30', flexShrink: 0 }}>
        {done ? (
          <Button
            fullWidth size="lg" radius="xl" onClick={onDone}
            style={{ background: 'linear-gradient(135deg, #009688, #4CAF50)', height: 52, border: 'none' }}
          >
            Save to Transactions
          </Button>
        ) : (
          <Button
            fullWidth size="lg" radius="xl"
            disabled={!file}
            loading={processing}
            onClick={handleProcess}
            style={{
              background: file ? 'linear-gradient(135deg, #009688, #4CAF50)' : undefined,
              height: 52, border: 'none',
            }}
          >
            Process Receipt
          </Button>
        )}
      </Box>
    </Box>
  )
}
