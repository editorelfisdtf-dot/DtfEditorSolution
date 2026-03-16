using System.Text.Json;
using System.Net;
using System.Net.Mail;
using System.IO.Compression;
using Microsoft.AspNetCore.Http.Features;

var builder = WebApplication.CreateBuilder(args);

// --- 1. SOLUCIÓN AL ERROR 413: Configurar límites de tamaño ---
// Configura Kestrel para aceptar peticiones de hasta 100MB
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = 200 * 1024 * 1024; // 200MB
});

var app = builder.Build();

// --- MIDDLEWARE DE ARCHIVOS ESTÁTICOS (DEBE IR ANTES DE LOS ENDPOINTS) ---
app.UseDefaultFiles();
app.UseStaticFiles();

// --- 2. Configuración de Directorios ---
var dataDir = Path.Combine(app.Environment.ContentRootPath, "data");
var tempDir = Path.Combine(app.Environment.ContentRootPath, "temp_uploads");
Directory.CreateDirectory(dataDir);
Directory.CreateDirectory(tempDir);

var configPath = Path.Combine(dataDir, "config.json");
string adminPassword = builder.Configuration["AdminPassword"] ?? "Elfis.Precio$";

// --- 3. Endpoints de Configuración ---
app.MapGet("/api/config", () => {
    if (File.Exists(configPath)) return Results.Text(File.ReadAllText(configPath), "application/json");
    return Results.Json(new { PricePerMeter = 10000 });
});

// --- 4. Endpoint de Carga (Upload) Optimizado ---
app.MapPost("/upload", async (UploadRequest request) =>
{
    if (string.IsNullOrEmpty(request.Image))
        return Results.BadRequest(new { ok = false, message = "No se recibió ninguna imagen." });

    // Generar un nombre único para evitar colisiones entre usuarios
    string orderId = Guid.NewGuid().ToString().Substring(0, 8);
    string fileName = $"mesa_dtf_{orderId}_{DateTime.Now:yyyyMMdd}";
    string zipPath = Path.Combine(tempDir, $"{fileName}.zip");

    try
    {
        // Extraer los bytes de la cadena Base64 (quitando el encabezado "data:image/png;base64,")
        var base64Data = request.Image.Contains(",") ? request.Image.Split(',')[1] : request.Image;
        byte[] imageBytes = Convert.FromBase64String(base64Data);

        // Crear el archivo ZIP directamente en disco (ahorra RAM)
        using (var fs = new FileStream(zipPath, FileMode.Create))
        using (var archive = new ZipArchive(fs, ZipArchiveMode.Create))
        {
            var entry = archive.CreateEntry($"{fileName}.png", CompressionLevel.Optimal);
            using (var entryStream = entry.Open())
            {
                await entryStream.WriteAsync(imageBytes, 0, imageBytes.Length);
            }
        }

        // --- Configuración de Envío de Correo ---
        var fromAddress = new MailAddress("editorelfisdtf@gmail.com", "Sistema Elfis DTF");
        var toAddress = new MailAddress("editorelfisdtf@gmail.com"); // Se envía a ti mismo

        using var message = new MailMessage(fromAddress, toAddress)
        {
            Subject = $"📦 NUEVO PEDIDO DTF - {request.UserName ?? "Sin Nombre"}",
            Body = $"Detalles del pedido:\n\n" +
                   $"Cliente: {request.UserName}\n" +
                   $"Teléfono: {request.Phone}\n" +
                   $"Modo de organización: {request.Mode}\n" +
                   $"ID de pedido: {orderId}\n" +
                   $"Fecha: {DateTime.Now:dd/MM/yyyy HH:mm}\n\n" +
                   $"El diseño se adjunta en formato ZIP para preservar la transparencia y calidad."
        };

        // Adjuntar el archivo desde el disco
        message.Attachments.Add(new Attachment(zipPath));

        using var smtp = new SmtpClient("smtp.gmail.com", 587)
        {
            // USA TU CONTRASEÑA DE APLICACIÓN DE GMAIL AQUÍ
            Credentials = new NetworkCredential("editorelfisdtf@gmail.com", "mklxzkemwqladxgu"),
            EnableSsl = true
        };

        await smtp.SendMailAsync(message);

        // --- Limpieza ---
        message.Dispose(); // Liberar el archivo adjunto
        if (File.Exists(zipPath)) File.Delete(zipPath);

        return Results.Ok(new { ok = true, message = "Pedido enviado correctamente." });
    }
    catch (Exception ex)
    {
        // Si algo falla, intentamos borrar el temporal
        if (File.Exists(zipPath)) File.Delete(zipPath);
        return Results.Json(new { ok = false, message = "Error en el servidor: " + ex.Message }, statusCode: 500);
    }
});

app.Run();

// Estructura de datos para recibir el pedido
public record UploadRequest(string Image, string UserName, string Phone, string Mode);