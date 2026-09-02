Write-Host "`n╔═══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                               ║" -ForegroundColor Cyan
Write-Host "║     🧪 TEST: SISTEMA DE CONTACTO CON ZOHO MAIL              ║" -ForegroundColor Cyan
Write-Host "║                                                               ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Test 1: Mensaje completo (con teléfono)
Write-Host "📧 Test 1: Mensaje completo (con teléfono)" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────────" -ForegroundColor Gray

$body1 = @{
    nombre = "Juan Pérez"
    email = "juan@example.com"
    telefono = "+56 9 1234 5678"
    mensaje = "Hola, necesito información sobre los timbres Shiny 722. ¿Tienen disponibilidad en color azul?"
} | ConvertTo-Json

try {
    $response1 = Invoke-WebRequest -Uri "http://localhost:3000/api/contact" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body1 `
        -UseBasicParsing
    
    Write-Host "✅ Status: $($response1.StatusCode)" -ForegroundColor Green
    $response1.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 2: Mensaje sin teléfono (opcional)
Write-Host "📧 Test 2: Mensaje sin teléfono (campo opcional)" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────────" -ForegroundColor Gray

$body2 = @{
    nombre = "María González"
    email = "maria@example.com"
    mensaje = "Me interesa hacer un pedido mayorista. ¿Tienen descuentos por volumen?"
} | ConvertTo-Json

try {
    $response2 = Invoke-WebRequest -Uri "http://localhost:3000/api/contact" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body2 `
        -UseBasicParsing
    
    Write-Host "✅ Status: $($response2.StatusCode)" -ForegroundColor Green
    $response2.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host -ForegroundColor White
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 3: Email inválido (debe fallar)
Write-Host "📧 Test 3: Email inválido (debe fallar con status 400)" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────────" -ForegroundColor Gray

$body3 = @{
    nombre = "Pedro Ruiz"
    email = "email-invalido"
    mensaje = "Este mensaje no debería enviarse"
} | ConvertTo-Json

try {
    $response3 = Invoke-WebRequest -Uri "http://localhost:3000/api/contact" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body3 `
        -UseBasicParsing
    
    Write-Host "⚠️ Status: $($response3.StatusCode) (esperábamos 400)" -ForegroundColor Yellow
} catch {
    Write-Host "✅ Validación funcionando correctamente" -ForegroundColor Green
    Write-Host "❌ Error esperado: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Start-Sleep -Seconds 2

# Test 4: Campos faltantes (debe fallar)
Write-Host "📧 Test 4: Campos faltantes (debe fallar con status 400)" -ForegroundColor Yellow
Write-Host "────────────────────────────────────────────────────────────────" -ForegroundColor Gray

$body4 = @{
    nombre = "Ana Torres"
    email = "ana@example.com"
    # mensaje falta
} | ConvertTo-Json

try {
    $response4 = Invoke-WebRequest -Uri "http://localhost:3000/api/contact" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body4 `
        -UseBasicParsing
    
    Write-Host "⚠️ Status: $($response4.StatusCode) (esperábamos 400)" -ForegroundColor Yellow
} catch {
    Write-Host "✅ Validación funcionando correctamente" -ForegroundColor Green
    Write-Host "❌ Error esperado: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ TESTS COMPLETADOS" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 PRÓXIMOS PASOS:" -ForegroundColor Yellow
Write-Host "  1. Revisa tu email: contacto@artema.cl" -ForegroundColor White
Write-Host "  2. Busca los emails de prueba (pueden estar en SPAM)" -ForegroundColor White
Write-Host "  3. Verifica el formato HTML del email" -ForegroundColor White
Write-Host "  4. Prueba responder desde el email" -ForegroundColor White
Write-Host ""

Read-Host "Presiona Enter para cerrar"

