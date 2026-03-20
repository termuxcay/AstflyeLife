using KdTree;
using KdTree.Math;
using Microsoft.ML.OnnxRuntime;
using Microsoft.ML.OnnxRuntime.Tensors;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace PasterAimbot
{
    public class AIModel : IDisposable
    {
        private const int IMAGE_SIZE = 640;
        private const int NUM_DETECTIONS = 8400; // Standard for OnnxV8 model (Shape: 1x5x8400)

        private readonly RunOptions _modeloptions;
        private InferenceSession _onnxModel;

        public float ConfidenceThreshold = 0.4f; // Reduzido para melhor detecção
        public int FovSize = 640;

        private List<string> _outputNames;
        private Bitmap _screenCaptureBitmap = null;
        private Prediction _lastValidPrediction = null;
        private DateTime _lastPredictionTime = DateTime.MinValue;

        public AIModel(string modelPath)
        {
            _modeloptions = new RunOptions();

            var sessionOptions = new SessionOptions
            {
                EnableCpuMemArena = true,
                EnableMemoryPattern = true,
                GraphOptimizationLevel = GraphOptimizationLevel.ORT_ENABLE_ALL,
                ExecutionMode = ExecutionMode.ORT_PARALLEL
            };

            // Attempt to load via DirectML (else fallback to CPU)
            try
            {
                LoadViaDirectML(sessionOptions, modelPath);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"There was an error starting the OnnxModel via DirectML: {ex}\n\nProgram will attempt to use CPU only, performance may be poor.", "Model Error");
                LoadViaCPU(sessionOptions, modelPath);
            }

            // Validate the onnx model output shape (ensure model is OnnxV8)
            ValidateOnnxShape();
        }

        private void LoadViaDirectML(SessionOptions sessionOptions, string modelPath)
        {
            sessionOptions.AppendExecutionProvider_DML();
            _onnxModel = new InferenceSession(modelPath, sessionOptions);
            _outputNames = _onnxModel.OutputMetadata.Keys.ToList();
        }

        private void LoadViaCPU(SessionOptions sessionOptions, string modelPath)
        {
            try
            {
                sessionOptions.AppendExecutionProvider_CPU();
                _onnxModel = new InferenceSession(modelPath, sessionOptions);
                _outputNames = _onnxModel.OutputMetadata.Keys.ToList();
            }
            catch (Exception e)
            {
                MessageBox.Show($"Error starting the model via CPU: {e}");
                System.Windows.Application.Current.Shutdown();
            }
        }

        private void ValidateOnnxShape()
        {
            foreach (var output in _onnxModel.OutputMetadata)
            {
                var shape = _onnxModel.OutputMetadata[output.Key].Dimensions;
                if (shape.Length != 3 || shape[0] != 1 || shape[1] != 5 || shape[2] != NUM_DETECTIONS)
                {
                    MessageBox.Show($"Output shape {string.Join("x", shape)} does not match the expected shape of 1x5x8400.\n\nThis model will not work , please use an ONNX V8 model.", "Model Error");
                }
            }
        }

        public class Prediction
        {
            public RectangleF Rectangle { get; set; }
            public float Confidence { get; set; }
        }

        public static float AIConfidence { get; set; }
        public static RectangleF LastDetectionBox { get; set; } // Para ESP
        public static Point CurrentTargetPosition { get; set; } // Posição onde o mouse vai

        public Bitmap ScreenGrab(System.Drawing.Rectangle detectionBox)
        {
            if (_screenCaptureBitmap == null || _screenCaptureBitmap.Width != detectionBox.Width || _screenCaptureBitmap.Height != detectionBox.Height)
            {
                _screenCaptureBitmap?.Dispose();
                _screenCaptureBitmap = new Bitmap(detectionBox.Width, detectionBox.Height);
            }

            using (var g = Graphics.FromImage(_screenCaptureBitmap))
            {
                g.CopyFromScreen(detectionBox.Left, detectionBox.Top, 0, 0, detectionBox.Size);
            }
            return _screenCaptureBitmap;
        }

        public static float[] BitmapToFloatArray(Bitmap image)
        {
            int height = image.Height;
            int width = image.Width;
            float[] result = new float[3 * height * width];
            System.Drawing.Rectangle rect = new System.Drawing.Rectangle(0, 0, width, height);
            BitmapData bmpData = image.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format24bppRgb);

            IntPtr ptr = bmpData.Scan0;
            int bytes = Math.Abs(bmpData.Stride) * height;
            byte[] rgbValues = new byte[bytes];

            Marshal.Copy(ptr, rgbValues, 0, bytes);
            for (int i = 0; i < rgbValues.Length / 3; i++)
            {
                int index = i * 3;
                result[i] = rgbValues[index + 2] / 255.0f; // R
                result[height * width + i] = rgbValues[index + 1] / 255.0f; // G
                result[2 * height * width + i] = rgbValues[index] / 255.0f; // B
            }

            image.UnlockBits(bmpData);

            return result;
        }

        public async Task<Prediction> GetClosestPredictionToCenterAsync()
        {
            try
            {
                System.Diagnostics.Debug.WriteLine("[DEBUG] Iniciando detecção otimizada...");
                
                // Define detection box
                int halfScreenWidth = Screen.PrimaryScreen.Bounds.Width / 2;
                int halfScreenHeight = Screen.PrimaryScreen.Bounds.Height / 2;
                int detectionBoxSize = Math.Min(FovSize, 640);
                System.Drawing.Rectangle detectionBox = new System.Drawing.Rectangle(halfScreenWidth - detectionBoxSize / 2,
                                                       halfScreenHeight - detectionBoxSize / 2,
                                                       detectionBoxSize,
                                                       detectionBoxSize);

                // Capture a screenshot
                Bitmap frame = ScreenGrab(detectionBox);
                if (frame == null)
                {
                    System.Diagnostics.Debug.WriteLine("[DEBUG] Falha ao capturar tela");
                    return null;
                }

                // Convert Bitmap to float array and normalize
                float[] inputArray = BitmapToFloatArray(frame);
                if (inputArray == null) 
                { 
                    System.Diagnostics.Debug.WriteLine("[DEBUG] Falha ao converter imagem");
                    return null; 
                }

                Tensor<float> inputTensor = new DenseTensor<float>(inputArray, new int[] { 1, 3, frame.Height, frame.Width });
                var inputs = new List<NamedOnnxValue> { NamedOnnxValue.CreateFromTensor("images", inputTensor) };
                
                System.Diagnostics.Debug.WriteLine("[DEBUG] Executando inferência otimizada...");
                var results = _onnxModel.Run(inputs, _outputNames, _modeloptions);

                var outputTensor = results[0].AsTensor<float>();

                // Calculate FOV boundaries
                float fovMinX = (IMAGE_SIZE - detectionBoxSize) / 2.0f;
                float fovMaxX = (IMAGE_SIZE + detectionBoxSize) / 2.0f;
                float fovMinY = (IMAGE_SIZE - detectionBoxSize) / 2.0f;
                float fovMaxY = (IMAGE_SIZE + detectionBoxSize) / 2.0f;

                // Otimização: processar apenas as primeiras 2000 detecções em vez de 8400
                int maxDetections = Math.Min(2000, NUM_DETECTIONS);
                var predictions = new List<Prediction>();

                // Processamento otimizado sem KdTree
                for (int i = 0; i < maxDetections; i++)
                {
                    float objectness = outputTensor[0, 4, i];
                    if (objectness < ConfidenceThreshold) continue;

                    float x_center = outputTensor[0, 0, i];
                    float y_center = outputTensor[0, 1, i];
                    float width = outputTensor[0, 2, i];
                    float height = outputTensor[0, 3, i];

                    float x_min = x_center - width / 2;
                    float y_min = y_center - height / 2;
                    float x_max = x_center + width / 2;
                    float y_max = y_center + height / 2;

                    if (x_min >= fovMinX && x_max <= fovMaxX && y_min >= fovMinY && y_max <= fovMaxY)
                    {
                        predictions.Add(new Prediction
                        {
                            Rectangle = new RectangleF(x_min, y_min, x_max - x_min, y_max - y_min),
                            Confidence = objectness
                        });
                    }
                }

                System.Diagnostics.Debug.WriteLine($"[DEBUG] Detecções válidas: {predictions.Count}");

                if (!predictions.Any())
                {
                    System.Diagnostics.Debug.WriteLine("[DEBUG] Nenhuma detecção válida");
                    return null;
                }

                // Pegar a detecção com maior confiança e mais próxima do centro
                var centerPoint = new PointF(IMAGE_SIZE / 2f, IMAGE_SIZE / 2f);
                var bestPrediction = predictions
                    .OrderByDescending(p => p.Confidence)
                    .ThenBy(p => 
                    {
                        var predCenter = new PointF(p.Rectangle.X + p.Rectangle.Width / 2, p.Rectangle.Y + p.Rectangle.Height / 2);
                        return CalculateDistance(centerPoint, predCenter);
                    })
                    .FirstOrDefault();

                if (bestPrediction != null)
                {
                    System.Diagnostics.Debug.WriteLine($"[DEBUG] Melhor predição: Conf={bestPrediction.Confidence:F2}");
                    _lastValidPrediction = bestPrediction;
                    _lastPredictionTime = DateTime.Now;
                    AIConfidence = bestPrediction.Confidence;
                    LastDetectionBox = bestPrediction.Rectangle; // Para ESP
                    
                    // Calcular posição do alvo para ESP
                    float scaleX = Screen.PrimaryScreen.Bounds.Width / 640f;
                    float scaleY = Screen.PrimaryScreen.Bounds.Height / 640f;
                    float screenCenterX = Screen.PrimaryScreen.Bounds.Width / 2f;
                    float screenCenterY = Screen.PrimaryScreen.Bounds.Height / 2f;
                    
                    float targetX = screenCenterX - 320f + (bestPrediction.Rectangle.X + bestPrediction.Rectangle.Width / 2) * scaleX;
                    float targetY = screenCenterY - 320f + (bestPrediction.Rectangle.Y + bestPrediction.Rectangle.Height / 2) * scaleY;
                    CurrentTargetPosition = new Point((int)targetX, (int)targetY);
                }
                
                return bestPrediction;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[DEBUG] Erro: {ex.Message}");
                return null;
            }
        }

        private float CalculateDistance(PointF point1, PointF point2)
        {
            float dx = point1.X - point2.X;
            float dy = point1.Y - point2.Y;
            return (float)Math.Sqrt(dx * dx + dy * dy);
        }

        private Prediction ApplySmoothing(Prediction currentPrediction)
        {
            return currentPrediction; // Temporariamente desativado
        }

        public void Dispose()
        {
            _onnxModel?.Dispose();
            _screenCaptureBitmap?.Dispose();
            GC.SuppressFinalize(this); // called to prevent the finalizer from running if the object is already disposed of.
        }
    }
}