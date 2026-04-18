import { Box } from '@mantine/core'

/**
 * Wraps every screen in the same phone-frame shell used by the wireframes,
 * keeping the mobile-first 390 × 844 px layout.
 */
export default function AppShell({ children }) {
  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #080810 0%, #0d1320 50%, #080d10 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <Box
        style={{
          width: '100%',
          maxWidth: '390px',
          height: '844px',
          background: '#111118',
          borderRadius: '24px',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.7)',
          border: '1px solid #1e1e30',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
