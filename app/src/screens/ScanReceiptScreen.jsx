// Copyright (C) 2026 V.P.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Text, Button, UnstyledButton } from '@mantine/core'
import { api, uploadToPresignedUrl } from '../lib/api'

export default function ScanReceiptScreen() {
  const navigate = useNavigate()
  const [state, setState] = useState('idle') // idle | uploading | success | error
  const [receipt, setReceipt] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const handleFile = async (file) => {
    if (!file) return
    const mimeMap = {
      'image/jpeg': 'image/jpeg',
      'image/png': 'image/png',
      'image/webp': 'image/webp',
      'application/pdf': 'application/pdf',
    }
    const contentType = mimeMap[file.type] || 'image/jpeg'

    setState('uploading')
    setErrorMsg('')
    try {
      const { receipt: r, uploadUrl } = await api.initiateReceiptUpload(contentType)
      await uploadToPresignedUrl(uploadUrl, file)
      setReceipt(r)
      setState('success')
    } catch (e) {
      setErrorMsg(e.message)
      setState('error')
    }
  }

  const openCamera = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.onchange = (e) => handleFile(e.target.files[0])
    input.click()
  }

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box style={{ padding: '24px 24px 16px', flexShrink: 0 }}>
        <UnstyledButton onClick={() => navigate('/home')} style={{ color: '#009688', fontWeight: 600, fontSize: 14 }}>
          ← Back
        </UnstyledButton>
        <Text fw={700} style={{ fontSize: 22, color: '#f1f5f9', marginTop: 12 }}>Scan Receipt</Text>
        <Text style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>
          Take a photo of your receipt to upload it automatically
        </Text>
      </Box>

      {/* Content */}
      <Box style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        {state === 'success' ? (
          <Box style={{ paddingBottom: 16 }}>
            <Box style={{ textAlign: 'center', marginBottom: 20, padding: '24px 0' }}>
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
                Receipt ID: {receipt?.id?.slice(0, 8)}…
              </Text>
              <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>
                Status: {receipt?.status || 'uploaded'}
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
                💡 Your receipt has been uploaded. Add transactions manually using the Add Transaction screen.
              </Text>
            </Box>
          </Box>
        ) : (
          <Box style={{ paddingBottom: 16 }}>
            {/* Camera viewfinder area */}
            <Box
              onClick={state !== 'uploading' ? openCamera : undefined}
              style={{
                width: '100%',
                aspectRatio: '3/4',
                maxHeight: 340,
                background: '#0a0a14',
                border: `2px solid ${state === 'uploading' ? '#009688' : '#2d2d4a'}`,
                borderRadius: 16,
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'border-color 0.3s',
                cursor: state !== 'uploading' ? 'pointer' : 'not-allowed',
              }}
            >
              {/* Corner brackets */}
              {[
                { top: 14, left: 14, borderTop: '3px solid #009688', borderLeft: '3px solid #009688', borderRadius: '5px 0 0 0' },
                { top: 14, right: 14, borderTop: '3px solid #009688', borderRight: '3px solid #009688', borderRadius: '0 5px 0 0' },
                { bottom: 14, left: 14, borderBottom: '3px solid #009688', borderLeft: '3px solid #009688', borderRadius: '0 0 0 5px' },
                { bottom: 14, right: 14, borderBottom: '3px solid #009688', borderRight: '3px solid #009688', borderRadius: '0 0 5px 0' },
              ].map((s, i) => (
                <Box key={i} style={{ position: 'absolute', width: 30, height: 30, ...s }} />
              ))}

              {state === 'uploading' ? (
                <Box style={{ textAlign: 'center' }}>
                  <Text style={{ color: '#4db6ac', fontSize: 13 }}>Uploading receipt…</Text>
                </Box>
              ) : state === 'error' ? (
                <Box style={{ textAlign: 'center', padding: '0 24px' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>⚠️</Text>
                  <Text style={{ color: '#f87171', fontSize: 13 }}>{errorMsg}</Text>
                  <Text style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Tap to try again</Text>
                </Box>
              ) : (
                <Box style={{ textAlign: 'center' }}>
                  <Text style={{ fontSize: 36, marginBottom: 8 }}>📷</Text>
                  <Text style={{ color: '#475569', fontSize: 13 }}>Tap to open camera</Text>
                </Box>
              )}
            </Box>

            <Box
              style={{
                marginTop: 16,
                padding: '14px 16px',
                background: '#0d1020',
                borderRadius: 12,
                border: '1px solid #1e1e30',
              }}
            >
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
            loading={state === 'uploading'}
            onClick={openCamera}
            style={{ background: 'linear-gradient(135deg, #009688, #4CAF50)', height: 52, border: 'none' }}
          >
            📷  Take Photo
          </Button>
        )}
      </Box>
    </Box>
  )
}
