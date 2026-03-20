import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

declare global {
  interface Window {
    go?: {
      main: {
        App: {
          StartLogin: () => Promise<void>
          GetAccessToken: () => Promise<string>
          GetUsername: () => Promise<string>
          GetGlobalName: () => Promise<string>
          GetAvatar: () => Promise<string>
          GetDiscordID: () => Promise<string>
          Logout: () => Promise<void>
        }
      }
    }
    runtime?: { EventsOn: (event: string, cb: (...args: any[]) => void) => void }
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const setTokens = useAuthStore((s) => s.setTokens)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Particle starfield
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      speed: Math.random() * 0.3 + 0.05,
      opacity: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * Math.PI * 2,
    }))

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      stars.forEach(s => {
        s.pulse += 0.02
        const alpha = s.opacity * (0.7 + 0.3 * Math.sin(s.pulse))
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(180,180,255,${alpha})`
        ctx.fill()
        s.y -= s.speed
        if (s.y < -2) { s.y = canvas.height + 2; s.x = Math.random() * canvas.width }
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  useEffect(() => {
    window.runtime?.EventsOn('auth:success', async () => {
      const token      = await window.go?.main.App.GetAccessToken() ?? ''
      const username   = await window.go?.main.App.GetUsername()    ?? ''
      const globalName = await window.go?.main.App.GetGlobalName()  ?? ''
      const avatar     = await window.go?.main.App.GetAvatar()      ?? ''
      const discordId  = await window.go?.main.App.GetDiscordID()   ?? ''
      if (token) {
        setTokens(token, { username, globalName, avatar, discordId })
        navigate('/')
      }
    })
    window.runtime?.EventsOn('auth:error', (_: any, errCode: string) => {
      const messages: Record<string, string> = {
        not_member: 'Você precisa entrar no servidor Discord primeiro.',
        exchange_failed: 'Erro ao trocar código Discord. Tente novamente.',
        discord_error: 'Erro ao conectar com Discord. Tente novamente.',
      }
      setError(messages[errCode] ?? 'Erro desconhecido.')
      setLoading(false)
    })
    window.runtime?.EventsOn('auth:timeout', () => {
      setError('Login cancelado — tempo esgotado.')
      setLoading(false)
    })
  }, [setTokens, navigate])

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await window.go?.main.App.StartLogin()
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao iniciar login')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Canvas starfield */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* Glowing orbs */}
      <div style={{
        position: 'absolute', width: 500, height: 500,
        borderRadius: '50%', top: '10%', left: '5%',
        background: 'radial-gradient(circle, rgba(180,85,255,0.08) 0%, transparent 70%)',
        animation: 'orb-move-1 12s ease-in-out infinite',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400,
        borderRadius: '50%', bottom: '10%', right: '5%',
        background: 'radial-gradient(circle, rgba(255,85,170,0.07) 0%, transparent 70%)',
        animation: 'orb-move-2 15s ease-in-out infinite',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Main card */}
      <div className="anim-fade-up" style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
        padding: '52px 56px',
        background: 'rgba(13,8,24,0.7)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(180,85,255,0.2)',
        borderRadius: 20,
        boxShadow: '0 0 60px rgba(180,85,255,0.08), 0 24px 80px rgba(0,0,0,0.6)',
        minWidth: 360,
      }}>
        {/* Top border glow */}
        <div style={{
          position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(180,85,255,0.8), rgba(255,85,170,0.6), transparent)',
        }} />

        {/* Logo mark */}
        <div className="anim-float" style={{
          width: 64, height: 64, borderRadius: 16, marginBottom: 24,
          background: 'linear-gradient(135deg, rgba(180,85,255,0.2), rgba(255,85,170,0.1))',
          border: '1px solid rgba(180,85,255,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(180,85,255,0.2), inset 0 0 20px rgba(180,85,255,0.05)',
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4L28 10V22L16 28L4 22V10L16 4Z" stroke="#b455ff" strokeWidth="1.5" fill="none" />
            <path d="M16 4L28 10V22L16 28L4 22V10L16 4Z" fill="rgba(180,85,255,0.1)" />
            <circle cx="16" cy="16" r="4" fill="#b455ff" opacity="0.8" />
            <line x1="16" y1="4" x2="16" y2="12" stroke="#b455ff" strokeWidth="1" opacity="0.5" />
            <line x1="16" y1="20" x2="16" y2="28" stroke="#b455ff" strokeWidth="1" opacity="0.5" />
            <line x1="28" y1="10" x2="21" y2="14" stroke="#b455ff" strokeWidth="1" opacity="0.5" />
            <line x1="11" y1="18" x2="4" y2="22" stroke="#b455ff" strokeWidth="1" opacity="0.5" />
            <line x1="4" y1="10" x2="11" y2="14" stroke="#ff55aa" strokeWidth="1" opacity="0.5" />
            <line x1="21" y1="18" x2="28" y2="22" stroke="#ff55aa" strokeWidth="1" opacity="0.5" />
          </svg>
        </div>

        {/* Brand name */}
        <h1 className="anim-pulse-text" style={{
          fontFamily: 'var(--font-display)',
          fontSize: 36, fontWeight: 800,
          letterSpacing: '-0.02em',
          color: '#e2d4f8',
          marginBottom: 4,
        }}>
          <span style={{ color: 'var(--primary)' }}>Ast</span>flye
        </h1>

        {/* Tagline */}
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11, letterSpacing: '0.2em',
          color: 'var(--muted)', textTransform: 'uppercase',
          marginBottom: 40,
        }}>
          Your productivity universe
        </p>

        {/* Divider */}
        <div style={{
          width: '100%', height: 1, marginBottom: 32,
          background: 'linear-gradient(90deg, transparent, rgba(180,85,255,0.2), transparent)',
        }} />

        {/* Login button */}
        <button onClick={handleLogin} disabled={loading} style={{
          width: '100%', padding: '14px 24px',
          background: loading
            ? 'rgba(180,85,255,0.3)'
            : 'linear-gradient(135deg, #b455ff 0%, #cc44ee 40%, #ff55aa 100%)',
          border: 'none', borderRadius: 10,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-display)', fontWeight: 700,
          fontSize: 15, color: '#fff', letterSpacing: '0.02em',
          position: 'relative', overflow: 'hidden',
          transition: 'all 0.25s ease',
          boxShadow: '0 4px 20px rgba(180,85,255,0.3)',
          opacity: loading ? 0.7 : 1,
        }}
          onMouseEnter={e => {
            if (loading) return
            const t = e.currentTarget
            t.style.transform = 'translateY(-2px)'
            t.style.boxShadow = '0 8px 30px rgba(180,85,255,0.5), 0 0 60px rgba(255,85,170,0.2)'
          }}
          onMouseLeave={e => {
            const t = e.currentTarget
            t.style.transform = 'translateY(0)'
            t.style.boxShadow = '0 4px 20px rgba(180,85,255,0.3)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            {loading ? (
              <div style={{
                width: 18, height: 18,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff',
                borderRadius: '50%',
                animation: 'spin-slow 0.8s linear infinite',
              }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.003.022.015.04.033.054a19.893 19.893 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
            )}
            {loading ? 'Conectando...' : 'Login com Discord'}
          </span>
        </button>

        {/* Error message */}
        {error && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 8,
            background: 'rgba(255,51,102,0.1)', border: '1px solid rgba(255,51,102,0.3)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <span style={{ color: '#ff3366', fontSize: 14, flexShrink: 0 }}>⚠</span>
            <p style={{ fontSize: 12, color: '#ff6688', fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
              {error}
            </p>
          </div>
        )}

        <p style={{ marginTop: 14, fontSize: 11, color: 'var(--muted2)', fontFamily: 'var(--font-mono)' }}>
          Acesso restrito — membro do servidor
        </p>
      </div>
    </div>
  )
}
