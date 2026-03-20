using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using PasterAimbot;

namespace Paster.Class
{
    public class ESPOverlay : Form
    {
        private const int WS_EX_LAYERED = 0x00080000;
        private const int WS_EX_TRANSPARENT = 0x00000020;
        private const int WS_EX_TOOLWINDOW = 0x00000080;
        private const int WS_EX_NOACTIVATE = 0x08000000; // Não capturar foco/mouse

        [DllImport("user32.dll")]
        private static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        [DllImport("user32.dll")]
        private static extern int GetWindowLong(IntPtr hWnd, int nIndex);

        [DllImport("user32.dll")]
        private static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);

        private const uint LWA_COLORKEY = 0x00000001;
        private const uint LWA_ALPHA = 0x00000002;

        private bool _espEnabled = false;
        private Timer _renderTimer;

        public ESPOverlay()
        {
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Normal;
            TopMost = true;
            ShowInTaskbar = false;
            BackColor = Color.Fuchsia;
            TransparencyKey = Color.Fuchsia;
            
            StartPosition = FormStartPosition.Manual;
            Location = new Point(0, 0);
            Size = new Size(Screen.PrimaryScreen.Bounds.Width, Screen.PrimaryScreen.Bounds.Height);

            // Importante: Não capturar eventos de mouse
            SetWindowLong(this.Handle, -20, GetWindowLong(this.Handle, -20) | WS_EX_NOACTIVATE);

            _renderTimer = new Timer();
            _renderTimer.Interval = 33; // ~30 FPS para melhor performance
            _renderTimer.Tick += RenderTimer_Tick;
            _renderTimer.Start();
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= (int)(WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE);
                return cp;
            }
        }

        private void RenderTimer_Tick(object sender, EventArgs e)
        {
            Invalidate();
        }

        public void ToggleESP()
        {
            _espEnabled = !_espEnabled;
            if (_espEnabled)
            {
                Show();
                BringToFront();
            }
            else
            {
                Hide();
            }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            if (!_espEnabled) return;

            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.CompositingMode = CompositingMode.SourceCopy;

            try
            {
                // Desenhar caixa de detecção ao redor do alvo
                if (AIModel.LastDetectionBox != RectangleF.Empty)
                {
                    // Converter coordenadas normalizadas para coordenadas de tela
                    float scaleX = Screen.PrimaryScreen.Bounds.Width / 640f;
                    float scaleY = Screen.PrimaryScreen.Bounds.Height / 640f;
                    
                    float boxX = AIModel.LastDetectionBox.X * scaleX;
                    float boxY = AIModel.LastDetectionBox.Y * scaleY;
                    float boxWidth = AIModel.LastDetectionBox.Width * scaleX;
                    float boxHeight = AIModel.LastDetectionBox.Height * scaleY;

                    // Centralizar na tela
                    float screenCenterX = Screen.PrimaryScreen.Bounds.Width / 2f;
                    float screenCenterY = Screen.PrimaryScreen.Bounds.Height / 2f;
                    
                    float finalX = screenCenterX - 320f + boxX;
                    float finalY = screenCenterY - 320f + boxY;

                    // Desenhar caixa do alvo (mais sutil)
                    using (Pen pen = new Pen(Color.Lime, 1))
                    {
                        pen.DashStyle = DashStyle.Dash;
                        g.DrawRectangle(pen, finalX, finalY, boxWidth, boxHeight);
                    }

                    // Ponto central do alvo (onde o aimbot mira)
                    float targetCenterX = finalX + boxWidth/2;
                    float targetCenterY = finalY + boxHeight/2;
                    
                    // Desenhar ponto central do alvo
                    using (Brush centerBrush = new SolidBrush(Color.Red))
                    {
                        g.FillEllipse(centerBrush, targetCenterX - 5, targetCenterY - 5, 10, 10);
                    }
                    
                    // LINHA PRINCIPAL: Do centro da tela (mouse) até o alvo
                    using (Pen mainLinePen = new Pen(Color.Yellow, 3))
                    {
                        mainLinePen.DashStyle = DashStyle.Solid;
                        g.DrawLine(mainLinePen, screenCenterX, screenCenterY, targetCenterX, targetCenterY);
                    }
                    
                    // Segunda linha para mais destaque
                    using (Pen secondLinePen = new Pen(Color.Cyan, 1))
                    {
                        secondLinePen.DashStyle = DashStyle.Dash;
                        g.DrawLine(secondLinePen, screenCenterX, screenCenterY, targetCenterX, targetCenterY);
                    }
                }

                // Mira do centro da tela (onde o mouse está)
                int fovCenterX = Screen.PrimaryScreen.Bounds.Width / 2;
                int fovCenterY = Screen.PrimaryScreen.Bounds.Height / 2;
                
                // Cruz central bem visível
                using (Pen centerCrossPen = new Pen(Color.White, 2))
                {
                    g.DrawLine(centerCrossPen, fovCenterX - 20, fovCenterY, fovCenterX + 20, fovCenterY);
                    g.DrawLine(centerCrossPen, fovCenterX, fovCenterY - 20, fovCenterX, fovCenterY + 20);
                }
                
                // Círculo central
                using (Pen centerCirclePen = new Pen(Color.White, 1))
                {
                    centerCirclePen.DashStyle = DashStyle.Solid;
                    g.DrawEllipse(centerCirclePen, fovCenterX - 8, fovCenterY - 8, 16, 16);
                }

                // Desenhar FOV (mais sutil)
                int fovSize = Math.Min(200, (int)(Screen.PrimaryScreen.Bounds.Height * 0.3f));
                
                using (Pen fovPen = new Pen(Color.Gray, 1))
                {
                    fovPen.DashStyle = DashStyle.Dash;
                    g.DrawEllipse(fovPen, fovCenterX - fovSize/2, fovCenterY - fovSize/2, fovSize, fovSize);
                }

                // Status bem visível
                using (Font font = new Font("Arial", 12, FontStyle.Bold))
                using (Brush textBrush = new SolidBrush(Color.White))
                {
                    string status = AIModel.LastDetectionBox != RectangleF.Empty 
                        ? $"🎯 IA DETECTANDO! | Conf: {AIModel.AIConfidence:F2}"
                        : "❌ IA PROCURANDO...";
                    
                    // Fundo para o texto
                    using (Brush bgBrush = new SolidBrush(Color.FromArgb(128, 0, 0, 0)))
                    {
                        g.FillRectangle(bgBrush, 8, 8, 300, 30);
                    }
                    
                    g.DrawString(status, font, textBrush, 10, 10);
                }
            }
            catch
            {
                // Ignorar erros de desenho para não travar
            }
        }
    }
}
