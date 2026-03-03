import { useState, useEffect } from 'react'
import { app } from './firebase'
import './App.css'

function App() {
  const [firebaseStatus, setFirebaseStatus] = useState('checking')
  const [projectId, setProjectId] = useState('')

  useEffect(() => {
    try {
      if (app && app.options.projectId) {
        setProjectId(app.options.projectId)
        setFirebaseStatus('connected')
      } else {
        setFirebaseStatus('disconnected')
      }
    } catch (error) {
      console.error('Firebase connection error:', error)
      setFirebaseStatus('disconnected')
    }
  }, [])

  const statusColor = {
    connected: '#22c55e',
    checking: '#f59e0b',
    disconnected: '#ef4444',
  }[firebaseStatus]

  const statusLabel = {
    connected: '✓ Firebase Connected',
    checking: '⏳ Checking connection...',
    disconnected: '✗ Firebase Not Connected',
  }[firebaseStatus]

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>SkyView — FlightScore</h1>
      <div style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid #e5e7eb', borderRadius: '8px', maxWidth: '400px' }}>
        <h2 style={{ marginTop: 0 }}>Firebase Status</h2>
        <p style={{ color: statusColor, fontWeight: 'bold', fontSize: '1.1rem' }}>
          {statusLabel}
        </p>
        {firebaseStatus === 'connected' && (
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            Project ID: <code>{projectId}</code>
          </p>
        )}
        {firebaseStatus === 'disconnected' && (
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            Set <code>VITE_FIREBASE_*</code> environment variables and redeploy.
          </p>
        )}
      </div>
    </div>
  )
}

export default App
