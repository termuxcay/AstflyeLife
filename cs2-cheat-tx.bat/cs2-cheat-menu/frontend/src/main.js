import './style.css';
import { GetCheatConfig, UpdateCheatConfig, GetStatus, InjectCheat, EjectCheat } from '../wailsjs/go/main/App';
import * as runtime from '../wailsjs/runtime/runtime';

class CS2CheatMenu {
    constructor() {
        this.currentSection = 'aimbot';
        this.cheatConfig = {
            AimbotEnabled: false,
            AimbotFOV: 5.0,
            AimbotSmoothness: 2.0,
            RCSEnabled: false,
            WallhackEnabled: false,
            ESPEnabled: false,
            TriggerbotEnabled: false,
            TriggerbotDelay: 50,
            BunnyhopEnabled: false,
            RadarHackEnabled: false,
            SkinChangerEnabled: false,
            KnifeType: 0,
            GloveType: 0,
            SkinWear: 0.001
        };
        this.appStatus = {
            status: 'inactive',
            version: '1.2.0',
            gameRunning: false,
            injected: false
        };
        this.welcomeShown = false;
        this.logs = [];
        this.init();
    }

    async init() {
        window.runtime = runtime;
        
        // Renderiza o básico IMEDIATAMENTE para não ficar tela preta
        this.render();

        try {
            await this.loadConfig();
            await this.loadStatus();
            this.render(); // Re-renderiza com os dados reais
        } catch (e) {
            console.error("Backend sync failed:", e);
        }

        this.setupLogListener();
        this.startStatusUpdates();
        this.setupESPListener();
    }

    setupLogListener() {
        window.runtime.EventsOn('log', (msg) => {
            console.log('Backend Log:', msg);
            const entry = {
                time: new Date().toLocaleTimeString(),
                text: msg
            };
            this.logs.unshift(entry);
            if (this.logs.length > 100) this.logs.pop();
            
            const logContainer = document.querySelector('.log-container');
            if (logContainer) {
                const logEntry = document.createElement('div');
                logEntry.className = 'log-entry';
                logEntry.textContent = `[${entry.time}] ${entry.text}`;
                logContainer.prepend(logEntry);
            }
        });
    }

    setupESPListener() {
        window.runtime.EventsOn('espUpdate', (players) => {
            this.drawESP(players);
        });
    }

    drawESP(players) {
        let canvas = document.getElementById('espCanvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'espCanvas';
            canvas.style.position = 'fixed';
            canvas.style.top = '0';
            canvas.style.left = '0';
            canvas.style.width = '100vw';
            canvas.style.height = '100vh';
            canvas.style.pointerEvents = 'none';
            canvas.style.zIndex = '9999';
            document.body.appendChild(canvas);
            
            const resize = () => {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            };
            window.addEventListener('resize', resize);
            resize();
        }

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!this.cheatConfig.ESPEnabled) return;

        players.forEach(player => {
            const screenPos = player.screenPos;
            const headPos = player.headPos;

            if (screenPos.X === -1 || headPos.X === -1) return;

            const height = Math.abs(screenPos.Y - headPos.Y);
            const width = height / 1.5;
            const x = screenPos.X - width / 2;
            const y = headPos.Y - (height * 0.15); // Pequeno offset para cima da cabeça

            // Cor baseada no time
            ctx.strokeStyle = player.isEnemy ? '#ff4b4b' : '#4b4bff';
            ctx.lineWidth = 2;

            // Box
            ctx.strokeRect(x, y, width, height);

            // Health bar
            const healthPerc = player.health / 100;
            ctx.fillStyle = '#00000088';
            ctx.fillRect(x - 6, y, 4, height);
            ctx.fillStyle = `rgb(${255 * (1 - healthPerc)}, ${255 * healthPerc}, 0)`;
            ctx.fillRect(x - 6, y + (height * (1 - healthPerc)), 4, height * healthPerc);

            // Nome e Info
            ctx.fillStyle = 'white';
            ctx.font = '12px Arial';
            ctx.fillText(`${player.name} [${player.health}HP]`, x, y - 5);
            ctx.fillText(`${Math.floor(player.distance / 10)}m`, x, y + height + 12);
        });
    }

    async loadConfig() {
        try {
            this.cheatConfig = await GetCheatConfig();
        } catch (error) {
            console.error('Failed to load cheat config:', error);
            this.cheatConfig = {
                AimbotEnabled: false,
                AimbotFOV: 5.0,
                AimbotSmoothness: 2.0,
                WallhackEnabled: false,
                ESPEnabled: false,
                TriggerbotEnabled: false,
                TriggerbotDelay: 50,
                BunnyhopEnabled: false,
                RadarHackEnabled: false
            };
        }
    }

    async loadStatus() {
        try {
            this.appStatus = await GetStatus();
        } catch (error) {
            console.error('Failed to load status:', error);
            this.appStatus = {
                status: 'inactive',
                version: '1.0.0',
                gameRunning: false,
                injected: false
            };
        }
    }

    render() {
        const app = document.querySelector('#app');
        if (!app) {
            console.error("CRITICAL: #app element not found!");
            return;
        }

        app.innerHTML = `
            <div class="header">
                <div style="font-size: 24px; font-weight: bold;">ASTFLYE2 EXTERNAL</div>
                <div style="margin-top: 10px;">
                    Status: ${this.appStatus.injected ? 'CONNECTED' : 'READY'}
                </div>
            </div>
            
            <div class="main-content">
                <div class="sidebar">
                    <div class="nav-item ${this.currentSection === 'aimbot' ? 'active' : ''}" onclick="window.menu.setSection('aimbot')">Aimbot</div>
                    <div class="nav-item ${this.currentSection === 'visuals' ? 'active' : ''}" onclick="window.menu.setSection('visuals')">Visuals</div>
                    <div class="nav-item ${this.currentSection === 'movement' ? 'active' : ''}" onclick="window.menu.setSection('movement')">Movement</div>
                    <div class="nav-item ${this.currentSection === 'settings' ? 'active' : ''}" onclick="window.menu.setSection('settings')">Logs</div>
                </div>

                <div class="content">
                    <h1>${this.currentSection.toUpperCase()}</h1>
                    <hr/>
                    <div style="margin-top: 20px;">
                        ${this.renderCurrentSection()}
                    </div>
                    
                    <div style="margin-top: 40px; display: flex; gap: 10px;">
                        <button class="btn" onclick="window.menu.injectCheat()">INITIALIZE SYSTEM</button>
                        <button class="btn" style="background: #333;" onclick="window.runtime.Quit()">EXIT</button>
                    </div>
                </div>
            </div>
        `;
    }

    setSection(name) {
        this.currentSection = name;
        this.render();
    }

    renderCurrentSection() {
        switch (this.currentSection) {
            case 'aimbot':
                return this.renderAimbotSection();
            case 'visuals':
                return this.renderVisualsSection();
            case 'movement':
                return this.renderMovementSection();
            case 'inventory':
                return this.renderInventorySection();
            case 'misc':
                return this.renderMiscSection();
            case 'settings':
                return this.renderSettingsSection();
            default:
                return this.renderAimbotSection();
        }
    }

    renderInventorySection() {
        return `
            <div class="cheat-section">
                <h2 class="section-title">Inventory Changer</h2>
                
                <div class="toggle-switch">
                    <span class="toggle-label">Enable Skin Changer</span>
                    <label class="toggle-container">
                        <input type="checkbox" class="toggle-input" 
                               ${this.cheatConfig.SkinChangerEnabled ? 'checked' : ''} 
                               onchange="window.menu.toggleSkinChanger(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem;">
                    <div class="slider-control" style="margin: 0;">
                        <span class="slider-label">Knife Type</span>
                        <select class="btn btn-secondary" style="width: 100%; text-align: left; text-transform: none;" 
                                onchange="window.menu.updateKnife(this.value)">
                            <option value="0">Default</option>
                            <option value="1">Karambit</option>
                            <option value="2">M9 Bayonet</option>
                            <option value="3">Butterfly</option>
                            <option value="4">Skeleton</option>
                        </select>
                    </div>
                    <div class="slider-control" style="margin: 0;">
                        <span class="slider-label">Glove Type</span>
                        <select class="btn btn-secondary" style="width: 100%; text-align: left; text-transform: none;" 
                                onchange="window.menu.updateGloves(this.value)">
                            <option value="0">Default</option>
                            <option value="1">Sport Gloves</option>
                            <option value="2">Driver Gloves</option>
                            <option value="3">Specialist Gloves</option>
                        </select>
                    </div>
                </div>

                <div class="slider-control">
                    <span class="slider-label">Skin Wear (Float): <span class="slider-value" id="skinWearValue">${this.cheatConfig.SkinWear || 0.001}</span></span>
                    <input type="range" class="range-slider" min="0" max="1" step="0.001" 
                           value="${this.cheatConfig.SkinWear || 0.001}" 
                           oninput="window.menu.updateSliderUI(this, '')"
                           onchange="window.menu.updateSkinWear(this.value)">
                </div>

                <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 1rem; font-style: italic;">
                    Note: Skins are visible only to you (Local). Use in-game "Update" button if available.
                </p>
            </div>
        `;
    }

    async toggleSkinChanger(enabled) {
        this.cheatConfig.SkinChangerEnabled = enabled;
        await this.saveConfig();
    }

    async updateKnife(value) {
        this.cheatConfig.KnifeType = parseInt(value);
        await this.saveConfig();
    }

    async updateGloves(value) {
        this.cheatConfig.GloveType = parseInt(value);
        await this.saveConfig();
    }

    async updateSkinWear(value) {
        this.cheatConfig.SkinWear = parseFloat(value);
        await this.saveConfig();
    }

    renderAimbotSection() {
        return `
            <div class="cheat-section">
                <h2 class="section-title">Aimbot Settings</h2>
                
                <div class="toggle-switch">
                    <span class="toggle-label">Enable Aimbot</span>
                    <label class="toggle-container">
                        <input type="checkbox" class="toggle-input" 
                               ${this.cheatConfig.AimbotEnabled ? 'checked' : ''} 
                               onchange="window.menu.toggleAimbot(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="toggle-switch">
                    <span class="toggle-label">Recoil Control (RCS)</span>
                    <label class="toggle-container">
                        <input type="checkbox" class="toggle-input" 
                               ${this.cheatConfig.RCSEnabled ? 'checked' : ''} 
                               onchange="window.menu.toggleRCS(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="slider-control">
                    <span class="slider-label">Aimbot FOV: <span class="slider-value" id="aimbotFovValue">${(this.cheatConfig.AimbotFOV || 5.0).toFixed(1)}°</span></span>
                    <input type="range" class="range-slider" min="1" max="20" step="0.1" 
                           value="${this.cheatConfig.AimbotFOV || 5.0}" 
                           oninput="window.menu.updateSliderUI(this, '°')"
                           onchange="window.menu.updateAimbotFov(this.value)">
                </div>

                <div class="slider-control">
                    <span class="slider-label">Smoothness: <span class="slider-value" id="aimbotSmoothValue">${(this.cheatConfig.AimbotSmoothness || 2.0).toFixed(1)}</span></span>
                    <input type="range" class="range-slider" min="1" max="10" step="0.1" 
                           value="${this.cheatConfig.AimbotSmoothness || 2.0}" 
                           oninput="window.menu.updateSliderUI(this, '')"
                           onchange="window.menu.updateAimbotSmoothness(this.value)">
                </div>

                <div class="toggle-switch">
                    <span class="toggle-label">Enable Triggerbot</span>
                    <label class="toggle-container">
                        <input type="checkbox" class="toggle-input" 
                               ${this.cheatConfig.TriggerbotEnabled ? 'checked' : ''} 
                               onchange="window.menu.toggleTriggerbot(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="slider-control">
                    <span class="slider-label">Triggerbot Delay: <span class="slider-value" id="triggerbotDelayValue">${this.cheatConfig.TriggerbotDelay || 50}ms</span></span>
                    <input type="range" class="range-slider" min="10" max="200" step="5" 
                           value="${this.cheatConfig.TriggerbotDelay || 50}" 
                           oninput="window.menu.updateSliderUI(this, 'ms')"
                           onchange="window.menu.updateTriggerbotDelay(this.value)">
                </div>
            </div>
        `;
    }

    async toggleRCS(enabled) {
        this.cheatConfig.RCSEnabled = enabled;
        await this.saveConfig();
    }

    updateSliderUI(el, unit) {
        const valueDisplay = el.parentElement.querySelector('.slider-value');
        if (valueDisplay) {
            valueDisplay.textContent = el.value + unit;
        }
    }

    renderVisualsSection() {
        return `
            <div class="cheat-section">
                <h2 class="section-title">Visual Settings</h2>
                
                <div class="toggle-switch">
                    <span class="toggle-label">Wallhack</span>
                    <label class="toggle-container">
                        <input type="checkbox" class="toggle-input" 
                               ${this.cheatConfig.WallhackEnabled ? 'checked' : ''} 
                               onchange="window.menu.toggleWallhack(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="toggle-switch">
                    <span class="toggle-label">ESP</span>
                    <label class="toggle-container">
                        <input type="checkbox" class="toggle-input" 
                               ${this.cheatConfig.ESPEnabled ? 'checked' : ''} 
                               onchange="window.menu.toggleESP(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>

                <div class="toggle-switch">
                    <span class="toggle-label">Radar Hack</span>
                    <label class="toggle-container">
                        <input type="checkbox" class="toggle-input" 
                               ${this.cheatConfig.RadarHackEnabled ? 'checked' : ''} 
                               onchange="window.menu.toggleRadarHack(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        `;
    }

    renderMovementSection() {
        return `
            <div class="cheat-section">
                <h2 class="section-title">Movement Settings</h2>
                
                <div class="toggle-switch">
                    <span class="toggle-label">Bunny Hop</span>
                    <label class="toggle-container">
                        <input type="checkbox" class="toggle-input" 
                               ${this.cheatConfig.BunnyhopEnabled ? 'checked' : ''} 
                               onchange="window.menu.toggleBunnyhop(this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        `;
    }

    renderMiscSection() {
        return `
            <div class="cheat-section">
                <h2 class="section-title">Miscellaneous Settings</h2>
                
                <div class="status-item" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
                    <h3 style="color: var(--primary); margin-top: 0;">Binds & Info</h3>
                    <ul style="list-style: none; padding: 0; color: var(--text-secondary); font-size: 0.9rem;">
                        <li style="margin-bottom: 0.5rem;">🔥 <b>Aimbot:</b> Hold Left Mouse</li>
                        <li style="margin-bottom: 0.5rem;">🐰 <b>Bunnyhop:</b> Hold Spacebar</li>
                        <li style="margin-bottom: 0.5rem;">🔫 <b>Triggerbot:</b> Automatic when aiming</li>
                        <li style="margin-bottom: 0.5rem;">🛡️ <b>Status:</b> All offsets updated (March 2026)</li>
                    </ul>
                </div>

                <p style="color: var(--text-secondary); margin: 1rem 0; font-style: italic;">
                    Additional features like Radar Hack and more will be added in future updates.
                </p>
            </div>
        `;
    }

    renderSettingsSection() {
        const logEntries = this.logs.map(log => 
            `<div class="log-entry">[${log.time}] ${log.text}</div>`
        ).join('');

        return `
            <div class="cheat-section">
                <h2 class="section-title">System Logs</h2>
                <div class="log-container" style="background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); height: 250px; overflow-y: auto; padding: 1rem; border-radius: 8px; font-family: monospace; font-size: 0.85rem; color: #00ff88;">
                    ${logEntries || '<div class="log-entry">Aguardando injeção...</div>'}
                </div>
                
                <h2 class="section-title" style="margin-top: 2rem;">Application Settings</h2>
                <p style="color: var(--text-secondary); margin: 1rem 0;">
                    Configurações de transparência e overlay serão adicionadas aqui.
                </p>
            </div>
        `;
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                this.currentSection = item.dataset.section;
                this.render();
            });
        });

        // Update slider values in real-time
        // Slider UI updates are now handled by oninput in renderAimbotSection
    }

    startStatusUpdates() {
        setInterval(async () => {
            await this.loadStatus();
            this.updateStatusUI();
        }, 2000);
    }

    updateStatusUI() {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-indicator span');
        const statusItems = document.querySelectorAll('.status-value');
        
        if (statusDot) {
            statusDot.className = `status-dot ${this.appStatus.injected ? 'active' : ''}`;
        }
        if (statusText) {
            statusText.textContent = this.appStatus.injected ? 'SYSTEM ACTIVE' : 'SYSTEM READY';
        }
        if (statusItems.length >= 3) {
            statusItems[0].textContent = this.appStatus.status ? this.appStatus.status.replace('_', ' ').toUpperCase() : 'IDLE';
            statusItems[1].textContent = "v" + (this.appStatus.version || '1.2.0');
            statusItems[2].textContent = this.appStatus.gameRunning ? 'RUNNING' : 'NOT FOUND';
        }

        // Update button states
        const injectBtn = document.querySelector('button[onclick*="injectCheat"]');
        const ejectBtn = document.querySelector('button[onclick*="ejectCheat"]');
        
        if (injectBtn) {
            injectBtn.disabled = this.appStatus.injected;
            injectBtn.textContent = this.appStatus.gameRunning ? '⚡ Initialize System' : '🚀 Launch CS2';
        }
        if (ejectBtn) ejectBtn.disabled = !this.appStatus.injected;
    }

    // Cheat control methods
    async toggleAimbot(enabled) {
        this.cheatConfig.AimbotEnabled = enabled;
        await this.saveConfig();
    }

    async toggleTriggerbot(enabled) {
        this.cheatConfig.TriggerbotEnabled = enabled;
        await this.saveConfig();
    }

    async toggleWallhack(enabled) {
        this.cheatConfig.WallhackEnabled = enabled;
        await this.saveConfig();
    }

    async toggleESP(enabled) {
        this.cheatConfig.ESPEnabled = enabled;
        await this.saveConfig();
    }

    async toggleBunnyhop(enabled) {
        this.cheatConfig.BunnyhopEnabled = enabled;
        await this.saveConfig();
    }

    async toggleRadarHack(enabled) {
        this.cheatConfig.RadarHackEnabled = enabled;
        await this.saveConfig();
    }

    async updateAimbotFov(value) {
        this.cheatConfig.AimbotFOV = parseFloat(value);
        await this.saveConfig();
    }

    async updateAimbotSmoothness(value) {
        this.cheatConfig.AimbotSmoothness = parseFloat(value);
        await this.saveConfig();
    }

    async updateTriggerbotDelay(value) {
        this.cheatConfig.TriggerbotDelay = parseInt(value);
        await this.saveConfig();
    }

    async saveConfig() {
        try {
            const result = await UpdateCheatConfig(this.cheatConfig);
            console.log('Config saved:', result);
        } catch (error) {
            console.error('Failed to save config:', error);
        }
    }

    async injectCheat() {
        try {
            const result = await InjectCheat();
            alert(result);
            await this.loadStatus();
            this.updateStatusUI();
        } catch (error) {
            console.error('Failed to inject cheat:', error);
            alert('Failed to inject cheat: ' + error.message);
        }
    }

    async ejectCheat() {
        try {
            const result = await EjectCheat();
            alert(result);
            await this.loadStatus();
            this.updateStatusUI();
        } catch (error) {
            console.error('Failed to eject cheat:', error);
            alert('Failed to eject cheat: ' + error.message);
        }
    }
}

// Initialize the menu when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.menu = new CS2CheatMenu();
});
