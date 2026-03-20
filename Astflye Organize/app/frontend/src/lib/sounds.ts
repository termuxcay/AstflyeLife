const ctx = () => new (window.AudioContext || (window as any).webkitAudioContext)()

function playTone(
  freq: number,
  type: OscillatorType,
  duration: number,
  gainPeak: number,
  freq2?: number,
) {
  const ac = ctx()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)

  osc.type = type
  osc.frequency.setValueAtTime(freq, ac.currentTime)
  if (freq2) osc.frequency.linearRampToValueAtTime(freq2, ac.currentTime + duration)

  gain.gain.setValueAtTime(0, ac.currentTime)
  gain.gain.linearRampToValueAtTime(gainPeak, ac.currentTime + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)

  osc.start(ac.currentTime)
  osc.stop(ac.currentTime + duration)
}

export function playLogin() {
  // Rising two-tone chime: warm, welcoming
  playTone(440, 'sine', 0.18, 0.4)
  setTimeout(() => playTone(660, 'sine', 0.22, 0.35), 100)
  setTimeout(() => playTone(880, 'sine', 0.28, 0.3), 200)
}

export function playTaskCreate() {
  // Quick upward chirp
  playTone(600, 'sine', 0.15, 0.3, 900)
}

export function playTaskDone() {
  // Satisfying two-note resolution
  playTone(523, 'sine', 0.15, 0.35)
  setTimeout(() => playTone(784, 'sine', 0.25, 0.3), 100)
}

export function playTaskDelete() {
  // Short downward blip
  playTone(400, 'triangle', 0.12, 0.25, 280)
}

export function playExpenseAdd() {
  // Soft coin-like chime
  playTone(880, 'sine', 0.08, 0.25)
  setTimeout(() => playTone(660, 'sine', 0.2, 0.2), 50)
}

export function playNotification() {
  // Two-pulse alert
  playTone(740, 'sine', 0.12, 0.3)
  setTimeout(() => playTone(740, 'sine', 0.15, 0.25), 160)
}

const soundFns: Record<string, () => void> = {
  login: playLogin,
  taskCreate: playTaskCreate,
  taskDone: playTaskDone,
  taskDelete: playTaskDelete,
  expenseAdd: playExpenseAdd,
  notification: playNotification,
}

export function playSound(name: keyof typeof soundFns) {
  const enabled = (() => {
    try {
      return JSON.parse(localStorage.getItem('astflye-settings') || '{}').state?.soundEnabled !== false
    } catch {
      return true
    }
  })()
  if (!enabled) return
  soundFns[name]?.()
}
