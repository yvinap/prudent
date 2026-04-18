import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Text, Button, UnstyledButton } from '@mantine/core'
import { api, uploadToPresignedUrl } from '../lib/api'

const MIME_MAP = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
  'application/pdf': 'application/pdf',
}

export default function UploadReceiptScreen() {
  const navigate = useNavigate()
  const inputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')

  const handleFile = (f) => {
    if (f) { setFile(f); setError('') }
  }

  const handleUpload = async () => {
    if (!file) return
    const contentType = MIME_MAP[file.type] || 'image/jpeg'
    setUploading(true)
    setError('')
    try {
      const { receipt: r, uploadUrl } = await api.initiateReceiptUpload(contentType)
      await uploadToPresignedUrl(uploadUrl, file)
      setReceipt(r)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box style={{ padding: '24px 24px 16px', flexShrink: 0 }}>
        <UnstyledButton onClick={() => navigate('/home')} style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}>
          ← Back
        </UnstyledButton>
        <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9', marginTop: 12 }}>Upload Receipt</Text>
        <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
          Upload an image or PDF of your receipt
        </Text>
      </Box>

      {/* Content */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
        {receipt ? (
          /* Success */
          <Box>
            <Box style={{ textAlign: 'center', padding: '24px 0 20px' }}>
              <Box
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: '#0d2420',
                  border: '2px solid #009688',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 36,
                  margin: '0 auto 16px',
                }}
              >
                ✓
              </Box>
              <Text fw={700} style={{ fontSize: 20, color: '#f1f5f9', marginBottom: 4 }}>
                Receipt Uploaded!
              </Text>
              <Text style={{ color: '#64748b', fontSize: 13 }}>
                {file?.name} — uploaded successfully
              </Text>
            </Box>

            <Box
              style={{
                padding: '14px 16px',
                background: '#0d2420',
                borderRadius: 12,
                border: '1px solid #1a4a40',
                marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 13, color: '#4db6ac' }}>
                💡 Receipt uploaded. Add transactions manually from the Add Transaction screen.
              </Text>
            </Box>
          </Box>
        ) : (
          /* Upload state */
          <Box style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Box
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }}
              onClick={() => inputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#009688' : file ? '#1a4a40' : '#2d2d4a'}`,
                borderRadius: 16,
                padding: '40px 24px',
                textAlign: 'center',
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
                onChange={(e) => handleFile(e.target.files[0])}
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

            <Box style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Box style={{ flex: 1, height: 1, background: '#2d2d4a' }} />
              <Text style={{ color: '#475569', fontSize: 12 }}>or</Text>
              <Box style={{ flex: 1, height: 1, background: '#2d2d4a' }} />
            </Box>

            <Button
              fullWidth
              variant="outline"
              color="teal"
              radius="xl"
              size="md"
              onClick={() => inputRef.current?.click()}
              style={{ borderColor: '#00796b', color: '#4db6ac' }}
            >
              Browse Files
            </Button>

            {error && <Text style={{ fontSize: 13, color: '#f87171' }}>{error}</Text>}
          </Box>
        )}
      </Box>

      {/* Action */}
      <Box style={{ padding: '16px 24px 28px', borderTop: '1px solid #1e1e30', flexShrink: 0 }}>
        {receipt ? (
          <Button
            fullWidth
            size="lg"
            radius="xl"
            onClick={() => navigate('/add-transaction')}
            style={{ background: 'linear-gradient(135deg, #009688, #4CAF50)', height: 52, border: 'none' }}
          >
            Add Transactions
          </Button>
        ) : (
          <Button
            fullWidth
            size="lg"
            radius="xl"
            disabled={!file}
            loading={uploading}
            onClick={handleUpload}
            style={{
              background: file ? 'linear-gradient(135deg, #009688, #4CAF50)' : '#1a1a2e',
              height: 52,
              border: 'none',
            }}
          >
            Upload Receipt
          </Button>
        )}
      </Box>
    </Box>
  )
}
