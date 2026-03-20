<script>
  import { onMount } from 'svelte';
  import { IsSecureBootEnabled, SetSecureBoot } from '../wailsjs/go/main/App.js';
  import { Quit } from '../wailsjs/runtime/runtime.js';

  let isEnabled = false;
  let btnText = "ENABLE";
  let statusText = "STATUS: OFF";
  let themeColor = "#ff004c"; // Vermelho neon inicial

  async function checkStatus() {
    isEnabled = await IsSecureBootEnabled();
    updateUI();
  }

  function updateUI() {
    if (isEnabled) {
      btnText = "INJECTED";
      statusText = "CAMOUFLAGE: ACTIVE";
      themeColor = "#00ff95"; // Verde neon "Cheat"
    } else {
      btnText = "INJECT";
      statusText = "CAMOUFLAGE: IDLE";
      themeColor = "#ff004c"; // Vermelho neon
    }
  }

  async function toggle() {
    const nextState = !isEnabled;
    const result = await SetSecureBoot(nextState);
    
    if (result === "OK") {
      isEnabled = nextState;
      updateUI();
    } else {
      alert(result);
    }
  }

  onMount(() => {
    checkStatus();
  });
</script>

<main style="--accent: {themeColor}">
  <div class="menu-container">
    <div class="header" style="--wails-draggable:drag">
      <div class="led-dot"></div>
      <span class="title">BYPASS TX.BAT</span>
      <button class="close-btn" on:click={Quit}>×</button>
    </div>

    <div class="separator"></div>

    <div class="content">
      <div class="status-box">
        <span class="status-label">{statusText}</span>
      </div>

      <div class="module-group">
        <span class="group-title">MAIN MODULES</span>
        <div class="module-item">
          <span class="module-name">SECURE BOOT</span>
          <div class="led-indicator"></div>
        </div>
        <div class="module-item">
          <span class="module-name">TPM 2.0 SIM</span>
          <div class="led-indicator"></div>
        </div>
        <div class="module-item">
          <span class="module-name">UEFI MASK</span>
          <div class="led-indicator"></div>
        </div>
      </div>

      <button class="main-btn" on:click={toggle}>
        {btnText}
      </button>

      <div class="footer">
        <span>V9 ULTIMATE EDITION</span>
      </div>
    </div>
    
    <!-- Resize handle simulation area -->
    <div class="resize-handle"></div>
  </div>
</main>

<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap');

  :global(body) {
    margin: 0;
    padding: 0;
    background-color: transparent !important;
    font-family: 'JetBrains Mono', monospace;
    color: #fff;
    overflow: hidden;
    user-select: none;
    width: 100vw;
    height: 100vh;
  }

  /* Custom Minimalist Scrollbar */
  ::-webkit-scrollbar {
    width: 4px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: var(--accent);
    box-shadow: 0 0 5px var(--accent);
  }

  main {
    width: 100%;
    height: 100%;
    padding: 10px;
    box-sizing: border-box;
    display: flex;
  }

  .menu-container {
    width: 100%;
    height: 100%;
    background: rgba(15, 15, 18, 0.98);
    border: 1px solid var(--accent);
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 20px rgba(0, 0, 0, 0.8), inset 0 0 10px rgba(0, 0, 0, 0.5);
    position: relative;
    overflow: hidden;
  }

  /* Scanline effect */
  .menu-container::after {
    content: "";
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.1) 50%), 
                linear-gradient(90deg, rgba(255, 0, 0, 0.02), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.02));
    background-size: 100% 2px, 3px 100%;
    pointer-events: none;
    z-index: 10;
  }

  .header {
    height: 40px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    background: rgba(25, 25, 30, 0.5);
    flex-shrink: 0;
  }

  .led-dot {
    width: 8px;
    height: 8px;
    background-color: var(--accent);
    border-radius: 50%;
    margin-right: 10px;
    box-shadow: 0 0 10px var(--accent);
    animation: blink 1.5s infinite;
  }

  .title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.5px;
    flex: 1;
    color: #eee;
  }

  .close-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 22px;
    cursor: pointer;
    padding: 0 5px;
  }

  .close-btn:hover { color: #fff; }

  .separator {
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0.6;
    flex-shrink: 0;
  }

  .content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .status-box {
    background: rgba(0, 0, 0, 0.3);
    padding: 10px;
    border-left: 3px solid var(--accent);
    margin-bottom: 25px;
    flex-shrink: 0;
  }

  .status-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent);
    text-shadow: 0 0 8px var(--accent);
  }

  .module-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 30px;
    overflow-y: auto;
    flex: 1;
  }

  .group-title {
    font-size: 10px;
    color: #666;
    margin-bottom: 8px;
    letter-spacing: 1px;
  }

  .module-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
    padding: 10px 14px;
    border-radius: 3px;
    flex-shrink: 0;
  }

  .module-name {
    font-size: 12px;
    color: #ccc;
    font-weight: 400;
  }

  .led-indicator {
    width: 12px;
    height: 6px;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
  }

  .main-btn {
    margin-top: 10px;
    background: transparent;
    border: 2px solid var(--accent);
    color: #fff;
    padding: 15px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 3px;
    flex-shrink: 0;
  }

  .main-btn:hover {
    background: var(--accent);
    color: #000;
    box-shadow: 0 0 20px var(--accent);
  }

  .footer {
    margin-top: 20px;
    text-align: center;
    font-size: 10px;
    color: #444;
    letter-spacing: 2px;
    flex-shrink: 0;
  }

  .resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 20px;
    height: 20px;
    cursor: nwse-resize;
    background: linear-gradient(135deg, transparent 50%, var(--accent) 50%);
    opacity: 0.4;
    z-index: 20;
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
</style>
