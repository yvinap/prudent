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

import { Box, Text, Button, Stack, Group } from '@mantine/core'
import { useAuth } from '../contexts/AuthContext'

export default function WelcomeScreen() {
  const { signIn } = useAuth()

  return (
    <Box style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '48px 32px' }}>
      {/* Hero */}
      <Box
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          style={{
            width: 88,
            height: 88,
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #009688, #4CAF50)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            boxShadow: '0 8px 24px rgba(0, 150, 136, 0.35)',
          }}
        >
          <Text fw={800} c="white" style={{ fontSize: 40 }}>P</Text>
        </Box>

        <Text fw={800} ta="center" style={{ fontSize: 36, letterSpacing: '-0.5px', color: '#f1f5f9' }}>
          Prudigo
        </Text>
        <Text c="dimmed" ta="center" mt={8} style={{ fontSize: 16, maxWidth: 260 }}>
          Smart budgeting for a better financial future
        </Text>

        <Box mt={48} style={{ width: '100%' }}>
          {[
            { icon: '💰', label: 'Track income & expenses' },
            { icon: '📊', label: 'Visualize your spending' },
            { icon: '🎯', label: 'Reach your savings goals' },
          ].map((item) => (
            <Group key={item.label} gap={12} mb={16}>
              <Box
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '12px',
                  background: '#1a2a28',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </Box>
              <Text style={{ color: '#cbd5e1', fontWeight: 500 }}>{item.label}</Text>
            </Group>
          ))}
        </Box>
      </Box>

      {/* Actions */}
      <Stack gap={12} mt={32}>
        <Button
          fullWidth
          size="lg"
          radius="xl"
          onClick={signIn}
          style={{ background: 'linear-gradient(135deg, #009688, #4CAF50)', height: 52, border: 'none' }}
        >
          Get Started with Google
        </Button>
        <Button
          fullWidth
          size="lg"
          radius="xl"
          variant="outline"
          color="teal"
          onClick={signIn}
          style={{ height: 52, borderColor: '#00796b', color: '#4db6ac' }}
        >
          Sign In with Google
        </Button>
      </Stack>
    </Box>
  )
}
