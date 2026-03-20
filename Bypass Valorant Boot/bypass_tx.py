import customtkinter as ctk
import winreg
import ctypes
import os
import sys

# Configurações iniciais do CustomTkinter
ctk.set_appearance_mode("Dark")
ctk.set_default_color_theme("blue")

# Constantes do Registro
REG_PATH = r"SYSTEM\CurrentControlSet\Control\SecureBoot\State"
REG_VAL = "UEFISecureBootEnabled"

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False

def get_secureboot_status():
    try:
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, REG_PATH, 0, winreg.KEY_READ)
        value, _ = winreg.QueryValueEx(key, REG_VAL)
        winreg.CloseKey(key)
        return value == 1
    except Exception as e:
        print(f"Erro ao ler registro: {e}")
        return False

def set_secureboot(enabled):
    if not is_admin():
        return False, "Por favor, execute como Administrador!"
    
    try:
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, REG_PATH, 0, winreg.KEY_SET_VALUE)
        value = 1 if enabled else 0
        winreg.SetValueEx(key, REG_VAL, 0, winreg.REG_DWORD, value)
        winreg.CloseKey(key)
        return True, "Sucesso!"
    except Exception as e:
        return False, str(e)

class BypassMenu(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Configurações da Janela
        self.title("bypass tx.bat")
        self.geometry("300x200")
        self.overrideredirect(True)  # Remove a barra de título (frameless)
        self.attributes("-topmost", True)  # Sempre no topo
        self.attributes("-alpha", 0.95)   # Leve transparência
        
        # Cores Neon/LED
        self.led_on = "#00FFCC"  # Ciano Neon
        self.led_off = "#FF3366" # Vermelho Neon
        self.bg_color = "#0A0A0C"
        self.configure(fg_color=self.bg_color)

        # Frame principal com borda "LED"
        self.main_frame = ctk.CTkFrame(self, fg_color=self.bg_color, corner_radius=10, border_width=1, border_color="#1E1E24")
        self.main_frame.pack(fill="both", expand=True, padx=2, pady=2)

        # Lógica de arrastar a janela
        self.main_frame.bind("<ButtonPress-1>", self.start_move)
        self.main_frame.bind("<B1-Motion>", self.do_move)

        # Título
        self.label_title = ctk.CTkLabel(self.main_frame, text="bypass tx.bat", font=("Orbitron", 16, "bold"), text_color="white")
        self.label_title.pack(pady=(20, 10))
        self.label_title.bind("<ButtonPress-1>", self.start_move)
        self.label_title.bind("<B1-Motion>", self.do_move)

        # Linha LED
        self.led_line = ctk.CTkFrame(self.main_frame, height=2, width=200, fg_color=self.led_off)
        self.led_line.pack(pady=5)

        # Botão Ativar/Desativar
        initial_status = get_secureboot_status()
        self.current_state = initial_status
        
        # Lógica de texto exata conforme o usuário pediu
        if initial_status:
            self.btn_text = "Desativado"
        else:
            self.btn_text = "Ativar"
        
        self.update_led(initial_status)

        self.btn = ctk.CTkButton(
            self.main_frame, 
            text=self.btn_text, 
            command=self.toggle_status,
            font=("Segoe UI", 14, "bold"),
            fg_color="#1E1E24",
            hover_color="#2D2D35",
            border_width=1,
            border_color="#3A3A45",
            corner_radius=8,
            width=180,
            height=40
        )
        self.btn.pack(pady=(20, 10))

        # Botão Sair (Minimalista)
        self.btn_exit = ctk.CTkButton(
            self.main_frame, 
            text="×", 
            width=20, 
            height=20, 
            fg_color="transparent", 
            hover_color="#FF3366",
            command=self.destroy,
            text_color="gray"
        )
        self.btn_exit.place(x=270, y=5)

    def start_move(self, event):
        self.x = event.x
        self.y = event.y

    def do_move(self, event):
        deltax = event.x - self.x
        deltay = event.y - self.y
        x = self.winfo_x() + deltax
        y = self.winfo_y() + deltay
        self.geometry(f"+{x}+{y}")

    def update_led(self, status):
        color = self.led_on if status else self.led_off
        self.led_line.configure(fg_color=color)
        # Sombra/Brilho simulado
        self.main_frame.configure(border_color=color)

    def toggle_status(self):
        new_status = not self.current_state
        success, msg = set_secureboot(new_status)
        
        if success:
            self.current_state = new_status
            if self.current_state:
                # Agora está ativado, o próximo clique deve desativar
                self.btn.configure(text="Desativado")
            else:
                # Agora está desativado, o próximo clique deve ativar
                self.btn.configure(text="Ativado")
            self.update_led(self.current_state)
        else:
            ctypes.windll.user32.MessageBoxW(0, msg, "Erro", 0x10)

if __name__ == "__main__":
    if not is_admin():
        # Tenta reiniciar como admin
        ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, " ".join(sys.argv), None, 1)
    else:
        app = BypassMenu()
        app.mainloop()
