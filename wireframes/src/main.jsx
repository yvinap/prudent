import React from 'react'
import ReactDOM from 'react-dom/client'
import '@mantine/core/styles.css'
import { MantineProvider, createTheme } from '@mantine/core'
import App from './App.jsx'

const theme = createTheme({
  primaryColor: 'teal',
  defaultRadius: 'md',
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MantineProvider theme={theme} forceColorScheme="dark">
      <App />
    </MantineProvider>
  </React.StrictMode>,
)
