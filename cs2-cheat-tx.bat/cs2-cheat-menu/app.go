package main

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/sys/windows"
)

// App struct
type App struct {
	ctx context.Context
}

// CheatConfig holds the configuration for CS2 cheats
type CheatConfig struct {
	AimbotEnabled      bool    `json:"aimbotEnabled"`
	AimbotFOV          float64 `json:"aimbotFOV"`
	AimbotSmoothness   float64 `json:"aimbotSmoothness"`
	RCSEnabled         bool    `json:"rcsEnabled"`
	WallhackEnabled    bool    `json:"wallhackEnabled"`
	ESPEnabled         bool    `json:"espEnabled"`
	TriggerbotEnabled  bool    `json:"triggerbotEnabled"`
	TriggerbotDelay    int     `json:"triggerbotDelay"`
	BunnyhopEnabled    bool    `json:"bunnyhopEnabled"`
	RadarHackEnabled   bool    `json:"radarHackEnabled"`
	SkinChangerEnabled bool    `json:"skinChangerEnabled"`
	KnifeType          int     `json:"knifeType"`
	GloveType          int     `json:"gloveType"`
	SkinWear           float64 `json:"skinWear"`
}

var currentConfig CheatConfig

// MemoryManager handles external memory operations
type MemoryManager struct {
	processHandle  uintptr
	clientDLL      uintptr
	engineDLL      uintptr
	isInjected     bool
	stopChan       chan struct{}
	activeFeatures map[string]bool
	mu             sync.Mutex
	featureThreads map[string]chan struct{}
	// Offsets Dinâmicos
	localPlayerOffset uintptr
	entityListOffset  uintptr
}

// Offsets atualizados para CS2 (Março 2026 - Versão Estável)
const (
	csgoProcessName         = "cs2.exe"
	clientDLLName           = "client.dll"
	engineDLLName           = "engine2.dll"
	
	// Offsets base (client.dll)
	dwEntityList            = 0x1D10D78
	dwLocalPlayerPawn       = 0x1BEDB28
	dwLocalPlayerController = 0x1E1C7D8
	dwViewMatrix            = 0x1E30FD0
	dwViewAngles            = 0x1A78650
	dwForceJump             = 0x1850DF0

	// Membros (Pawn/Controller)
	m_iHealth             = 0x32C
	m_iTeamNum            = 0x3EB
	m_vOldOrigin          = 0x1274
	m_hPlayerPawn         = 0x7E4
	m_fFlags              = 0x3CC
	m_pGameSceneNode      = 0x330
	m_modelState          = 0x170
	m_ArmorValue          = 0x274C
	m_flFlashOverlayAlpha = 0x1604
	m_bSpotted            = 0x1638
	m_iIDEntIndex         = 0x1458
	m_aimPunchAngle       = 0x1584
	m_pClippingWeapon     = 0x1620
	maxPlayers            = 64
)

// Constantes para controle de movimento (Subtick)
const (
	PLUS_JUMP    = 65537
	MINUS_JUMP   = 256
	PLUS_ATTACK  = 65537
	MINUS_ATTACK = 256
)

var (
	memoryManager                *MemoryManager
	kernel32                     = syscall.NewLazyDLL("kernel32.dll")
	user32                       = syscall.NewLazyDLL("user32.dll")
	procOpenProcess              = kernel32.NewProc("OpenProcess")
	procCloseHandle              = kernel32.NewProc("CloseHandle")
	procReadProcessMemory        = kernel32.NewProc("ReadProcessMemory")
	procWriteProcessMemory       = kernel32.NewProc("WriteProcessMemory")
	procGetModuleHandle          = kernel32.NewProc("GetModuleHandleW")
	procGetProcAddress           = kernel32.NewProc("GetProcAddress")
	procCreateToolhelp32Snapshot = kernel32.NewProc("CreateToolhelp32Snapshot")
	procProcess32First           = kernel32.NewProc("Process32FirstW")
	procProcess32Next            = kernel32.NewProc("Process32NextW")
	procModule32First            = kernel32.NewProc("Module32FirstW")
	procModule32Next             = kernel32.NewProc("Module32NextW")
	procGetExitCodeProcess       = kernel32.NewProc("GetExitCodeProcess")
	procFindWindowW              = user32.NewProc("FindWindowW")
	procGetWindowThreadProcessId = user32.NewProc("GetWindowThreadProcessId")
)

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	currentConfig = CheatConfig{
		AimbotFOV:        5.0,
		AimbotSmoothness: 2.0,
		TriggerbotDelay:  50,
		SkinWear:         0.001,
	}
	memoryManager = &MemoryManager{
		stopChan:       make(chan struct{}),
		activeFeatures: make(map[string]bool),
		featureThreads: make(map[string]chan struct{}),
	}
	// Removida auto-injeção para garantir que o usuário veja os logs ao clicar no botão
}

// GetCheatConfig returns the current cheat configuration
func (a *App) GetCheatConfig() CheatConfig {
	return currentConfig
}

// UpdateCheatConfig updates the cheat configuration
func (a *App) UpdateCheatConfig(config CheatConfig) string {
	currentConfig = config
	go a.handleCheatFeatures(config)
	return "Configuração atualizada com sucesso!"
}

func (a *App) handleCheatFeatures(config CheatConfig) {
	if !memoryManager.isInjected {
		return
	}

	memoryManager.mu.Lock()
	defer memoryManager.mu.Unlock()

	a.manageFeatureLocked("aimbot", config.AimbotEnabled, func() {
		go a.runAimbot(config.AimbotFOV, config.AimbotSmoothness, memoryManager.featureThreads["aimbot"])
	})

	a.manageFeatureLocked("triggerbot", config.TriggerbotEnabled, func() {
		go a.runTriggerbot(config.TriggerbotDelay, memoryManager.featureThreads["triggerbot"])
	})

	a.manageFeatureLocked("bunnyhop", config.BunnyhopEnabled, func() {
		go a.runBunnyhop(memoryManager.featureThreads["bunnyhop"])
	})

	wallhackEnabled := config.WallhackEnabled
	espEnabled := config.ESPEnabled
	a.manageFeatureLocked("visuals", wallhackEnabled || espEnabled, func() {
		go a.runVisuals(wallhackEnabled, espEnabled, memoryManager.featureThreads["visuals"])
	})

	a.manageFeatureLocked("esp", config.ESPEnabled, func() {
		go a.runESP(memoryManager.featureThreads["esp"])
	})

	a.manageFeatureLocked("skinchanger", config.SkinChangerEnabled, func() {
		go a.runSkinChanger(config.KnifeType, config.GloveType, float32(config.SkinWear), memoryManager.featureThreads["skinchanger"])
	})
}

func (a *App) runSkinChanger(knifeID int, gloveID int, skinWear float32, stopChan <-chan struct{}) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	const (
		m_pClippingWeapon      = 0x3DE0
		m_AttributeManager     = 0x1148
		m_Item                 = 0x50
		m_iItemDefinitionIndex = 0x1BA
		m_ItemIDHigh           = 0x1D0
	)

	for {
		select {
		case <-stopChan:
			return
		case <-ticker.C:
			if !memoryManager.isInjected {
				continue
			}

			localPlayerPawn := memoryManager.readUint64(memoryManager.clientDLL + dwLocalPlayerPawn)
			if localPlayerPawn == 0 {
				continue
			}

			activeWeapon := memoryManager.readUint64(uintptr(localPlayerPawn) + m_pClippingWeapon)
			if activeWeapon == 0 {
				continue
			}
		}
	}
}

func (a *App) manageFeatureLocked(featureName string, enabled bool, startFunc func()) {
	if !enabled && memoryManager.activeFeatures[featureName] {
		if stopChan, exists := memoryManager.featureThreads[featureName]; exists {
			close(stopChan)
			delete(memoryManager.featureThreads, featureName)
		}
		memoryManager.activeFeatures[featureName] = false
		return
	}

	if enabled && !memoryManager.activeFeatures[featureName] {
		stopChan := make(chan struct{})
		memoryManager.featureThreads[featureName] = stopChan
		memoryManager.activeFeatures[featureName] = true
		startFunc()
	}
}

func (a *App) runAimbot(fov, smoothness float64, stopChan <-chan struct{}) {
	ticker := time.NewTicker(5 * time.Millisecond) // Mais rápido para aim suave
	defer ticker.Stop()

	procGetAsyncKeyState := user32.NewProc("GetAsyncKeyState")

	for {
		select {
		case <-stopChan:
			return
		case <-ticker.C:
			if !memoryManager.isInjected {
				continue
			}

			// Aimbot bind: Mouse Esquerdo (0x01) ou Tecla Custom (ex: Alt 0x12)
			ret, _, _ := procGetAsyncKeyState.Call(0x01)
			if ret&0x8000 == 0 {
				continue
			}

			if target := a.findBestTarget(fov); target != 0 {
				a.aimAtTarget(target, smoothness)
			}
		}
	}
}

func (a *App) runTriggerbot(delay int, stopChan <-chan struct{}) {
	ticker := time.NewTicker(time.Duration(delay) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-stopChan:
			return
		case <-ticker.C:
			if !memoryManager.isInjected {
				return
			}
			if a.shouldTrigger() {
				a.triggerShot()
			}
		}
	}
}

func (a *App) runBunnyhop(stopChan <-chan struct{}) {
	ticker := time.NewTicker(1 * time.Millisecond)
	defer ticker.Stop()

	procGetAsyncKeyState := user32.NewProc("GetAsyncKeyState")

	for {
		select {
		case <-stopChan:
			memoryManager.writeUint32(memoryManager.clientDLL+dwForceJump, MINUS_JUMP)
			return
		case <-ticker.C:
			if !memoryManager.isInjected || !a.isCSGOWindowActive() {
				continue
			}

			ret, _, _ := procGetAsyncKeyState.Call(0x20)
			if ret&0x8000 != 0 {
				localPlayerPawn := memoryManager.readUint64(memoryManager.clientDLL + dwLocalPlayerPawn)
				if localPlayerPawn == 0 {
					continue
				}

				fFlags := memoryManager.readInt32(uintptr(localPlayerPawn) + m_fFlags)
				if (fFlags & (1 << 0)) != 0 {
					memoryManager.writeUint32(memoryManager.clientDLL+dwForceJump, PLUS_JUMP)
					time.Sleep(1 * time.Millisecond)
					memoryManager.writeUint32(memoryManager.clientDLL+dwForceJump, MINUS_JUMP)
				}
			}
		}
	}
}

func (a *App) isCSGOWindowActive() bool {
	procGetForegroundWindow := user32.NewProc("GetForegroundWindow")
	procGetWindowThreadProcessId := user32.NewProc("GetWindowThreadProcessId")

	fgWin, _, _ := procGetForegroundWindow.Call()
	if fgWin == 0 {
		return false
	}

	var dwProcessId uint32
	procGetWindowThreadProcessId.Call(fgWin, uintptr(unsafe.Pointer(&dwProcessId)))

	pid := memoryManager.findProcessID(csgoProcessName)
	return dwProcessId == pid
}

type ESPPlayerInfo struct {
	Position  Vector3 `json:"position"`
	ScreenPos Vector2 `json:"screenPos"`
	HeadPos   Vector2 `json:"headPos"`
	Health    int     `json:"health"`
	Team      int     `json:"team"`
	IsEnemy   bool    `json:"isEnemy"`
	Distance  float32 `json:"distance"`
	Name      string  `json:"name"`
	IsVisible bool    `json:"isVisible"`
	Armor     int     `json:"armor"`
}

func (a *App) runESP(stopChan <-chan struct{}) {
	ticker := time.NewTicker(5 * time.Millisecond) // ESP ultra rápido
	defer ticker.Stop()

	for {
		select {
		case <-stopChan:
			return
		case <-ticker.C:
			if !memoryManager.isInjected {
				continue
			}

			localPlayerController := memoryManager.readUint64(memoryManager.clientDLL + dwLocalPlayerController)
			if localPlayerController == 0 {
				continue
			}

			localTeam := memoryManager.readInt32(uintptr(localPlayerController) + m_iTeamNum)
			localPlayerPawn := a.getLocalPlayer()
			if localPlayerPawn == 0 {
				continue
			}

			localPos := memoryManager.readVector3(localPlayerPawn + m_vOldOrigin)
			viewMatrix := memoryManager.readMatrix4x4(memoryManager.clientDLL + dwViewMatrix)

			var players []ESPPlayerInfo
			entityList := memoryManager.readUint64(memoryManager.clientDLL + memoryManager.entityListOffset)
			if entityList == 0 {
				continue
			}

			// Percorrer entidades
			for i := 1; i < 64; i++ {
				listEntry := memoryManager.readUint64(uintptr(entityList) + uintptr((i&0x7FFF)>>9)*8 + 16)
				if listEntry == 0 {
					continue
				}

				controller := memoryManager.readUint64(uintptr(listEntry) + uintptr(i&0x1FF)*120)
				if controller == 0 {
					continue
				}

				pawnHandle := memoryManager.readUint32(uintptr(controller) + m_hPlayerPawn)
				if pawnHandle == 0 {
					continue
				}

				listEntryPawn := memoryManager.readUint64(uintptr(entityList) + uintptr((pawnHandle&0x7FFF)>>9)*8 + 16)
				if listEntryPawn == 0 {
					continue
				}

				playerPawn := memoryManager.readUint64(uintptr(listEntryPawn) + uintptr(pawnHandle&0x1FF)*120)
				if playerPawn == 0 || uintptr(playerPawn) == localPlayerPawn {
					continue
				}

				health := memoryManager.readInt32(uintptr(playerPawn) + m_iHealth)
				if health <= 0 || health > 100 {
					continue
				}

				team := memoryManager.readInt32(uintptr(playerPawn) + m_iTeamNum)
				position := memoryManager.readVector3(uintptr(playerPawn) + m_vOldOrigin)
				headPos := a.getBonePosition(uintptr(playerPawn), 6)

				screenPos := a.worldToScreen(position, viewMatrix)
				screenHeadPos := a.worldToScreen(headPos, viewMatrix)

				if screenPos.X != -1 && screenHeadPos.X != -1 {
					players = append(players, ESPPlayerInfo{
						Position:  position,
						ScreenPos: screenPos,
						HeadPos:   screenHeadPos,
						Health:    int(health),
						Team:      int(team),
						IsEnemy:   team != localTeam,
						Distance:  calculateDistance(localPos, position),
						IsVisible: true,
						Name:      memoryManager.readString(uintptr(controller)+0x778, 32),
						Armor:     int(memoryManager.readInt32(uintptr(playerPawn) + m_ArmorValue)),
					})
				}
			}

			runtime.EventsEmit(a.ctx, "espUpdate", players)
		}
	}
}

func calculateDistance(pos1, pos2 Vector3) float32 {
	dx := pos1.X - pos2.X
	dy := pos1.Y - pos2.Y
	dz := pos1.Z - pos2.Z
	return float32(math.Sqrt(float64(dx*dx + dy*dy + dz*dz)))
}

func (a *App) runVisuals(wallhack, esp bool, stopChan <-chan struct{}) {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-stopChan:
			return
		case <-ticker.C:
			if !memoryManager.isInjected {
				return
			}
			if wallhack {
				a.applyWallhack()
			}
		}
	}
}

type Vector3 struct {
	X, Y, Z float32
}

type Vector2 struct {
	X, Y float32
}

type Matrix4x4 [4][4]float32

func (m *MemoryManager) readMemory(address uintptr, buffer []byte) bool {
	var bytesRead uintptr
	ret, _, _ := procReadProcessMemory.Call(
		m.processHandle,
		uintptr(address),
		uintptr(unsafe.Pointer(&buffer[0])),
		uintptr(len(buffer)),
		uintptr(unsafe.Pointer(&bytesRead)),
	)
	return ret != 0 && bytesRead == uintptr(len(buffer))
}

func (m *MemoryManager) writeMemory(address uintptr, data []byte) bool {
	var bytesWritten uintptr
	ret, _, _ := procWriteProcessMemory.Call(
		m.processHandle,
		uintptr(address),
		uintptr(unsafe.Pointer(&data[0])),
		uintptr(len(data)),
		uintptr(unsafe.Pointer(&bytesWritten)),
	)
	return ret != 0 && bytesWritten == uintptr(len(data))
}

func (m *MemoryManager) readUint64(address uintptr) uint64 {
	buffer := make([]byte, 8)
	if m.readMemory(address, buffer) {
		return binary.LittleEndian.Uint64(buffer)
	}
	return 0
}

func (m *MemoryManager) readUint32(address uintptr) uint32 {
	buffer := make([]byte, 4)
	if m.readMemory(address, buffer) {
		return binary.LittleEndian.Uint32(buffer)
	}
	return 0
}

func (m *MemoryManager) readInt32(address uintptr) int32 {
	buffer := make([]byte, 4)
	if m.readMemory(address, buffer) {
		return int32(binary.LittleEndian.Uint32(buffer))
	}
	return 0
}

func (m *MemoryManager) readFloat32(address uintptr) float32 {
	buffer := make([]byte, 4)
	if m.readMemory(address, buffer) {
		return math.Float32frombits(binary.LittleEndian.Uint32(buffer))
	}
	return 0
}

func (m *MemoryManager) writeFloat32(address uintptr, value float32) bool {
	buffer := make([]byte, 4)
	binary.LittleEndian.PutUint32(buffer, math.Float32bits(value))
	return m.writeMemory(address, buffer)
}

func (m *MemoryManager) writeUint32(address uintptr, value uint32) bool {
	buffer := make([]byte, 4)
	binary.LittleEndian.PutUint32(buffer, value)
	return m.writeMemory(address, buffer)
}

func (m *MemoryManager) readVector3(address uintptr) Vector3 {
	return Vector3{
		X: m.readFloat32(address),
		Y: m.readFloat32(address + 4),
		Z: m.readFloat32(address + 8),
	}
}

func (m *MemoryManager) readMatrix4x4(address uintptr) Matrix4x4 {
	var matrix Matrix4x4
	for i := 0; i < 4; i++ {
		for j := 0; j < 4; j++ {
			matrix[i][j] = m.readFloat32(address + uintptr((i*4+j)*4))
		}
	}
	return matrix
}

func (m *MemoryManager) readString(address uintptr, maxLength int) string {
	if maxLength <= 0 {
		maxLength = 256
	}
	buffer := make([]byte, maxLength)
	if m.readMemory(address, buffer) {
		for i := 0; i < maxLength; i++ {
			if buffer[i] == 0 {
				return string(buffer[:i])
			}
		}
		return string(buffer)
	}
	return ""
}

func (m *MemoryManager) findProcessID(processName string) uint32 {
	snapshot, _, _ := procCreateToolhelp32Snapshot.Call(0x2, 0)
	if snapshot == 0 || snapshot == ^uintptr(0) {
		return 0
	}
	defer procCloseHandle.Call(snapshot)

	var entry windows.ProcessEntry32
	entry.Size = uint32(unsafe.Sizeof(entry))

	ret, _, _ := procProcess32First.Call(snapshot, uintptr(unsafe.Pointer(&entry)))
	if ret == 0 {
		return 0
	}

	targetName := strings.ToLower(processName)
	if !strings.HasSuffix(targetName, ".exe") {
		targetName += ".exe"
	}

	for {
		name := strings.ToLower(syscall.UTF16ToString(entry.ExeFile[:]))
		if name == targetName || name == processName {
			return entry.ProcessID
		}
		r1, _, _ := procProcess32Next.Call(snapshot, uintptr(unsafe.Pointer(&entry)))
		if r1 == 0 {
			break
		}
	}
	return 0
}

func (m *MemoryManager) getModuleBaseAddress(pid uint32, moduleName string) uintptr {
	if pid == 0 {
		return 0
	}
	// Usar flags de snapshot robustas: TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32
	snapshot, _, _ := procCreateToolhelp32Snapshot.Call(0x8|0x10, uintptr(pid))
	if snapshot == 0 || snapshot == ^uintptr(0) {
		return 0
	}
	defer procCloseHandle.Call(snapshot)

	var module windows.ModuleEntry32
	module.Size = uint32(unsafe.Sizeof(module))

	ret, _, _ := procModule32First.Call(snapshot, uintptr(unsafe.Pointer(&module)))
	if ret == 0 {
		return 0
	}

	targetModule := strings.ToLower(moduleName)
	for {
		// Acessar o nome do módulo de forma segura via windows.UTF16ToString
		name := windows.UTF16ToString(module.Module[:])
		if strings.EqualFold(name, targetModule) {
			return uintptr(module.ModBaseAddr)
		}
		r1, _, _ := procModule32Next.Call(snapshot, uintptr(unsafe.Pointer(&module)))
		if r1 == 0 {
			break
		}
	}
	return 0
}

func (a *App) getLocalPlayer() uintptr {
	if memoryManager == nil || !memoryManager.isInjected {
		return 0
	}
	return uintptr(memoryManager.readUint64(memoryManager.clientDLL + memoryManager.localPlayerOffset))
}

func (a *App) isEnemy(playerPawn uintptr) bool {
	localPlayerPawn := a.getLocalPlayer()
	if localPlayerPawn == 0 || playerPawn == 0 {
		return false
	}
	localTeam := memoryManager.readInt32(localPlayerPawn + m_iTeamNum)
	entityTeam := memoryManager.readInt32(playerPawn + m_iTeamNum)
	return localTeam != entityTeam && entityTeam > 0
}

func (a *App) worldToScreen(worldPos Vector3, viewMatrix Matrix4x4) Vector2 {
	clipX := worldPos.X*viewMatrix[0][0] + worldPos.Y*viewMatrix[0][1] + worldPos.Z*viewMatrix[0][2] + viewMatrix[0][3]
	clipY := worldPos.X*viewMatrix[1][0] + worldPos.Y*viewMatrix[1][1] + worldPos.Z*viewMatrix[1][2] + viewMatrix[1][3]
	clipW := worldPos.X*viewMatrix[3][0] + worldPos.Y*viewMatrix[3][1] + worldPos.Z*viewMatrix[3][2] + viewMatrix[3][3]

	if clipW < 0.1 {
		return Vector2{X: -1, Y: -1}
	}

	ndcX := clipX / clipW
	ndcY := clipY / clipW

	return Vector2{
		X: (1920 / 2) * (1 + ndcX),
		Y: (1080 / 2) * (1 - ndcY),
	}
}

func (a *App) getBonePosition(entity uintptr, boneIndex int) Vector3 {
	gameSceneNode := uintptr(memoryManager.readUint64(entity + m_pGameSceneNode))
	if gameSceneNode == 0 {
		return Vector3{}
	}

	// CS2 Bone Array Logic: m_modelState + 0x80 (128)
	boneArray := uintptr(memoryManager.readUint64(gameSceneNode + m_modelState + 0x80))
	if boneArray == 0 {
		return Vector3{}
	}

	// Cada osso tem 32 bytes (Vector3 + padding)
	return memoryManager.readVector3(boneArray + uintptr(boneIndex)*32)
}

func (a *App) getViewAngles() Vector3 {
	localPlayerPawn := a.getLocalPlayer()
	if localPlayerPawn == 0 {
		return Vector3{}
	}
	return memoryManager.readVector3(localPlayerPawn + dwViewAngles)
}

func (a *App) setViewAngles(angles Vector3) {
	localPlayerPawn := a.getLocalPlayer()
	if localPlayerPawn == 0 {
		return
	}
	memoryManager.writeFloat32(localPlayerPawn+dwViewAngles, angles.X)
	memoryManager.writeFloat32(localPlayerPawn+dwViewAngles+4, angles.Y)
}

func (a *App) calculateAngle(localPos, targetPos Vector3) Vector3 {
	delta := Vector3{
		X: targetPos.X - localPos.X,
		Y: targetPos.Y - localPos.Y,
		Z: targetPos.Z - localPos.Z,
	}
	length := float32(math.Sqrt(float64(delta.X*delta.X + delta.Y*delta.Y + delta.Z*delta.Z)))
	return Vector3{
		X: float32(math.Atan2(float64(delta.Y), float64(delta.X))) * 180 / math.Pi,
		Y: float32(math.Atan2(float64(-delta.Z), float64(length))) * 180 / math.Pi,
		Z: 0,
	}
}

func (a *App) findBestTarget(fov float64) uintptr {
	if memoryManager == nil || !memoryManager.isInjected {
		return 0
	}
	localPlayerPawn := a.getLocalPlayer()
	if localPlayerPawn == 0 {
		return 0
	}

	localPos := memoryManager.readVector3(localPlayerPawn + m_vOldOrigin)
	localViewAngles := a.getViewAngles()
	var bestTarget uintptr
	bestFOV := float32(fov)
	entityList := memoryManager.readUint64(memoryManager.clientDLL + memoryManager.entityListOffset)
	if entityList == 0 {
		return 0
	}

	for i := 1; i < 64; i++ {
		listEntry := memoryManager.readUint64(uintptr(entityList) + uintptr((i&0x7FFF)>>9)*8 + 16)
		if listEntry == 0 {
			continue
		}
		controller := memoryManager.readUint64(uintptr(listEntry) + uintptr(i&0x1FF)*120)
		if controller == 0 {
			continue
		}
		pawnHandle := memoryManager.readUint32(uintptr(controller) + m_hPlayerPawn)
		if pawnHandle == 0 {
			continue
		}
		listEntryPawn := memoryManager.readUint64(uintptr(entityList) + uintptr((pawnHandle&0x7FFF)>>9)*8 + 16)
		if listEntryPawn == 0 {
			continue
		}
		playerPawn := memoryManager.readUint64(uintptr(listEntryPawn) + uintptr(pawnHandle&0x1FF)*120)
		if playerPawn == 0 || uintptr(playerPawn) == localPlayerPawn {
			continue
		}
		if !a.isEnemy(uintptr(playerPawn)) {
			continue
		}
		health := memoryManager.readInt32(uintptr(playerPawn) + m_iHealth)
		if health <= 0 || health > 100 {
			continue
		}

		bonePos := a.getBonePosition(uintptr(playerPawn), 6) // Cabeça
		targetAngle := a.calculateAngle(localPos, bonePos)

		deltaX := targetAngle.X - localViewAngles.X
		deltaY := targetAngle.Y - localViewAngles.Y

		// Normalização para cálculo de FOV
		for deltaX > 180 {
			deltaX -= 360
		}
		for deltaX < -180 {
			deltaX += 360
		}

		currentFOV := float32(math.Sqrt(float64(deltaX*deltaX + deltaY*deltaY)))
		if currentFOV < bestFOV {
			bestFOV = currentFOV
			bestTarget = uintptr(playerPawn)
		}
	}
	return bestTarget
}

func (a *App) aimAtTarget(entity uintptr, smoothness float64) {
	localPlayerPawn := a.getLocalPlayer()
	if localPlayerPawn == 0 {
		return
	}

	localPos := memoryManager.readVector3(localPlayerPawn + m_vOldOrigin)
	bonePos := a.getBonePosition(entity, 6) // Cabeça
	targetAngle := a.calculateAngle(localPos, bonePos)

	// RCS - Recoil Control System
	if currentConfig.RCSEnabled {
		aimPunch := memoryManager.readVector3(localPlayerPawn + m_aimPunchAngle)
		targetAngle.X -= aimPunch.X * 2.0
		targetAngle.Y -= aimPunch.Y * 2.0
	}

	currentAngle := a.getViewAngles()
	deltaX := targetAngle.X - currentAngle.X
	deltaY := targetAngle.Y - currentAngle.Y

	// Normalização de ângulos
	for deltaX > 180 {
		deltaX -= 360
	}
	for deltaX < -180 {
		deltaX += 360
	}
	if deltaY > 89 {
		deltaY = 89
	}
	if deltaY < -89 {
		deltaY = -89
	}

	smoothFactor := float32(1.0 / smoothness)
	a.setViewAngles(Vector3{
		X: currentAngle.X + deltaX*smoothFactor,
		Y: currentAngle.Y + deltaY*smoothFactor,
		Z: 0,
	})
}

func (a *App) shouldTrigger() bool {
	localPlayerPawn := a.getLocalPlayer()
	if localPlayerPawn == 0 {
		return false
	}

	// m_iIDEntIndex indica qual entidade está sob o crosshair
	crosshairID := memoryManager.readInt32(localPlayerPawn + m_iIDEntIndex)
	if crosshairID <= 0 || crosshairID > 512 {
		return false
	}

	entityList := memoryManager.readUint64(memoryManager.clientDLL + memoryManager.entityListOffset)
	if entityList == 0 {
		return false
	}
	listEntry := memoryManager.readUint64(uintptr(entityList) + uintptr((crosshairID&0x7FFF)>>9)*8 + 16)
	if listEntry == 0 {
		return false
	}

	playerPawn := memoryManager.readUint64(uintptr(listEntry) + uintptr(crosshairID&0x1FF)*120)
	if playerPawn == 0 {
		return false
	}

	return a.isEnemy(uintptr(playerPawn))
}

func (a *App) triggerShot() {
	memoryManager.writeUint32(memoryManager.clientDLL+0x1850E20, PLUS_ATTACK) // dwForceAttack atualizado
	time.Sleep(15 * time.Millisecond)                                         // Pequeno delay para subtick
	memoryManager.writeUint32(memoryManager.clientDLL+0x1850E20, MINUS_ATTACK)
}

func (a *App) applyWallhack() {
	if memoryManager == nil || !memoryManager.isInjected {
		return
	}
	entityList := memoryManager.readUint64(memoryManager.clientDLL + memoryManager.entityListOffset)
	if entityList == 0 {
		return
	}
	for i := 1; i < 64; i++ {
		listEntry := memoryManager.readUint64(uintptr(entityList) + uintptr((i&0x7FFF)>>9)*8 + 16)
		if listEntry == 0 {
			continue
		}
		controller := memoryManager.readUint64(uintptr(listEntry) + uintptr(i&0x1FF)*120)
		if controller == 0 {
			continue
		}
		pawnHandle := memoryManager.readUint32(uintptr(controller) + m_hPlayerPawn)
		if pawnHandle == 0 {
			continue
		}
		listEntryPawn := memoryManager.readUint64(uintptr(entityList) + uintptr((pawnHandle&0x7FFF)>>9)*8 + 16)
		if listEntryPawn == 0 {
			continue
		}
		playerPawn := memoryManager.readUint64(uintptr(listEntryPawn) + uintptr(pawnHandle&0x1FF)*120)
		if playerPawn == 0 {
			continue
		}
		if a.isEnemy(uintptr(playerPawn)) {
			memoryManager.writeUint32(uintptr(playerPawn)+m_bSpotted, 1)
		}
	}
}

func (a *App) GetStatus() map[string]interface{} {
	gameRunning := a.isCS2Running()
	status := "waiting_game"
	if gameRunning {
		status = "active"
		if memoryManager != nil && memoryManager.isInjected {
			status = "protected"
		}
	}
	return map[string]interface{}{
		"status":      status,
		"version":     "2.0.0-Astflye",
		"gameRunning": gameRunning,
		"injected":    memoryManager != nil && memoryManager.isInjected,
	}
}

func (a *App) isCS2Running() bool {
	if memoryManager == nil {
		return false
	}
	return memoryManager.findProcessID(csgoProcessName) != 0
}

func (a *App) InjectCheat() string {
	// Resetar estado
	memoryManager.isInjected = false
	memoryManager.localPlayerOffset = 0
	memoryManager.entityListOffset = 0
	
	time.Sleep(200 * time.Millisecond)
	a.logToUI(">>> INICIANDO SISTEMA ASTFLYE2 <<<")
	
	pid := memoryManager.findProcessID(csgoProcessName)
	if pid == 0 {
		a.logToUI("ERRO: CS2.EXE NÃO ENCONTRADO!")
		return "ERRO: CS2 não encontrado."
	}
	a.logToUI(fmt.Sprintf("Sucesso: CS2 detectado (PID: %d)", pid))

	handle, _, _ := procOpenProcess.Call(0x1F0FFF, 0, uintptr(pid))
	if handle == 0 {
		a.logToUI("ERRO: Falha de permissão (Admin).")
		return "ERRO: Rode como Administrador."
	}
	memoryManager.processHandle = handle
	
	clientBase := memoryManager.getModuleBaseAddress(pid, clientDLLName)
	if clientBase == 0 {
		a.logToUI("ERRO: CLIENT.DLL NÃO ENCONTRADO!")
		return "ERRO: client.dll não encontrado."
	}
	memoryManager.clientDLL = clientBase
	a.logToUI(fmt.Sprintf("Client.dll: 0x%X", clientBase))

	// BUSCA DINÂMICA
	a.logToUI("Validando memória do jogo...")
	
	// 1. Tentar encontrar LocalPlayerController primeiro (mais estável)
	controllerOffsets := []uintptr{0x1E1C7D8, 0x22F3118, 0x22EE8B8}
	var localController uintptr
	for _, off := range controllerOffsets {
		ctrl := uintptr(memoryManager.readUint64(clientBase + off))
		if ctrl != 0 && ctrl > 0x1000000 {
			pawnHandle := memoryManager.readUint32(ctrl + m_hPlayerPawn)
			if pawnHandle != 0 {
				localController = ctrl
				a.logToUI(fmt.Sprintf("Sucesso: LocalController em 0x%X", off))
				break
			}
		}
	}

	// 2. Tentar encontrar EntityList
	entityListOffsets := []uintptr{0x1D10D78, 0x24AD228, 0x24A90D8, 0x1E019A0}
	for _, off := range entityListOffsets {
		entList := uintptr(memoryManager.readUint64(clientBase + off))
		if entList != 0 && entList > 0x1000000 {
			memoryManager.entityListOffset = off
			a.logToUI(fmt.Sprintf("Sucesso: EntityList em 0x%X", off))
			break
		}
	}

	// 3. Tentar encontrar LocalPlayerPawn via Controller + EntityList
	if localController != 0 && memoryManager.entityListOffset != 0 {
		pawnHandle := memoryManager.readUint32(localController + m_hPlayerPawn)
		entityList := uintptr(memoryManager.readUint64(clientBase + memoryManager.entityListOffset))
		
		listEntry := uintptr(memoryManager.readUint64(entityList + uintptr((pawnHandle&0x7FFF)>>9)*8 + 16))
		if listEntry != 0 {
			pawn := uintptr(memoryManager.readUint64(listEntry + uintptr(pawnHandle&0x1FF)*120))
			if pawn != 0 {
				health := memoryManager.readInt32(pawn + m_iHealth)
				if health > 0 && health <= 100 {
					// Encontramos o Pawn dinamicamente! 
					// Mas para o resto do cheat, precisamos de um offset estável para dwLocalPlayerPawn
					// Vamos tentar casar esse endereço com nossa lista de offsets
					pawnOffsets := []uintptr{0x1BEDB28, 0x2068B60, 0x2064AE0, 0x182FAE0}
					for _, off := range pawnOffsets {
						if uintptr(memoryManager.readUint64(clientBase + off)) == pawn {
							memoryManager.localPlayerOffset = off
							a.logToUI(fmt.Sprintf("Sucesso: LocalPlayerPawn em 0x%X (Vida: %d)", off, health))
							break
						}
					}
				}
			}
		}
	}

	// Fallback se a busca dinâmica falhar
	if memoryManager.localPlayerOffset == 0 {
		a.logToUI("Aviso: Usando offsets de fallback...")
		memoryManager.localPlayerOffset = dwLocalPlayerPawn
	}
	if memoryManager.entityListOffset == 0 {
		memoryManager.entityListOffset = dwEntityList
	}

	memoryManager.isInjected = true
	a.logToUI(">>> SISTEMA ASTFLYE2 ATIVO <<<")
	return "SISTEMA ATIVO!"
}

func (a *App) logToUI(msg string) {
	runtime.EventsEmit(a.ctx, "log", msg)
	println("[UI LOG]", msg)
}

func (a *App) EjectCheat() string {
	if !memoryManager.isInjected {
		return "Cheat não está injetado!"
	}
	memoryManager.mu.Lock()
	defer memoryManager.mu.Unlock()
	for _, stopChan := range memoryManager.featureThreads {
		close(stopChan)
	}
	memoryManager.featureThreads = make(map[string]chan struct{})
	memoryManager.activeFeatures = make(map[string]bool)
	memoryManager.isInjected = false
	return "Cheat ejetado com sucesso!"
}
