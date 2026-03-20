package main

import (
	"context"

	"golang.org/x/sys/windows/registry"
)

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

type regKeyInfo struct {
	Root registry.Key
	Path string
	Name string
	Type string // "dword" or "string"
}

// --- ARSENAL V15: MINIMALIST STEALTH & CLEAN RESTORE ---
// Focado apenas no essencial para o VAN 9003, evitando conflitos de rede/vanguard.
var ultimateBypassKeys = []regKeyInfo{
	// 1. TPM 2.0 CORE SPOOF (tpm.msc & msinfo32)
	{registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Tpm`, "TpmPresent", "dword"},
	{registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Tpm`, "TpmEnabled", "dword"},
	{registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Tpm`, "TpmReady", "dword"},
	{registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows NT\CurrentVersion\TPM`, "SpecVersion", "string"}, // "2.0"

	// 2. SECURE BOOT EVIDENCE (UEFI & BIOS reporting)
	{registry.LOCAL_MACHINE, `HARDWARE\Description\System\BIOS`, "UEFISecureBootConfig", "dword"},
	{registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\SecureBoot\State`, "UEFISecureBootEnabled", "dword"},
	{registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\SecureBoot\State`, "SecureBoot", "dword"},
	{registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\SecureBoot\Settings`, "HasHardwareEvidence", "dword"},
}

func (a *App) IsSecureBootEnabled() bool {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `HARDWARE\Description\System\BIOS`, registry.QUERY_VALUE)
	if err != nil {
		return false
	}
	defer k.Close()
	val, _, err := k.GetIntegerValue("UEFISecureBootConfig")
	return err == nil && val == 1
}

func (a *App) SetSecureBoot(enabled bool) string {
	for _, info := range ultimateBypassKeys {
		if enabled {
			// Abre ou cria a chave
			k, err := registry.OpenKey(info.Root, info.Path, registry.SET_VALUE|registry.CREATE_SUB_KEY)
			if err != nil {
				k, _, err = registry.CreateKey(info.Root, info.Path, registry.SET_VALUE)
				if err != nil {
					continue
				}
			}
			if info.Type == "string" {
				k.SetStringValue(info.Name, "2.0")
			} else {
				k.SetDWordValue(info.Name, 1)
			}
			k.Close()
		} else {
			// DESATIVAR: Em vez de setar 0 em tudo, vamos tentar remover o valor
			// para que o Windows volte ao estado original "limpo".
			k, err := registry.OpenKey(info.Root, info.Path, registry.SET_VALUE)
			if err == nil {
				k.DeleteValue(info.Name)
				k.Close()
			}
		}
	}
	return "OK"
}
