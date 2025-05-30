# ============================================
# SCRIPT CORREGIDO PARA ELIMINAR ASOCIACIONES DUPLICADAS
# ============================================

Write-Host "🔄 Iniciando corrección de asociaciones duplicadas..." -ForegroundColor Yellow

# Crear backup
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = "backup_models_$timestamp"
Write-Host "📦 Creando backup en: $backupDir" -ForegroundColor Cyan

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item "src\models\*.ts" $backupDir\ -Force
Write-Host "✅ Backup creado exitosamente" -ForegroundColor Green

# Obtener lista de archivos a procesar
$modelFiles = Get-ChildItem "src\models\*.ts" | Where-Object { $_.Name -ne "index.ts" }
Write-Host "📝 Archivos a procesar: $($modelFiles.Count)" -ForegroundColor White

# Procesar cada archivo
foreach ($file in $modelFiles) {
    Write-Host "🔧 Procesando: $($file.Name)" -ForegroundColor Yellow
    
    # Leer contenido
    $lines = Get-Content $file.FullName
    $newLines = @()
    $skipNextLine = $false
    
    # Procesar línea por línea
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $line = $lines[$i]
        
        # Si encontramos un decorador de asociación, saltarlo
        if ($line -match "^\s*@(BelongsTo|HasMany|HasOne)") {
            Write-Host "  ❌ Eliminando: $($line.Trim())" -ForegroundColor Red
            $skipNextLine = $true
            continue
        }
        
        # Si debemos saltar la línea siguiente (la propiedad)
        if ($skipNextLine) {
            # Extraer nombre de la propiedad y convertir a 'any'
            if ($line -match "^\s*(\w+)([!?])?:\s*[\w\[\]]+;?\s*$") {
                $propertyName = $matches[1]
                $nullable = if ($matches[2]) { $matches[2] } else { "!" }
                
                # Determinar si es array
                $newType = if ($line -match "\[\]") { "any[]" } else { "any" }
                
                $newLine = "  $propertyName$nullable $newType;"
                $newLines += $newLine
                Write-Host "  ✅ Convertido a: $newLine" -ForegroundColor Green
            } else {
                # Si no coincide el patrón, mantener la línea original
                $newLines += $line
            }
            $skipNextLine = $false
            continue
        }
        
        # Agregar líneas normales
        $newLines += $line
    }
    
    # Escribir archivo modificado
    Set-Content -Path $file.FullName -Value $newLines -Encoding UTF8
    Write-Host "  ✅ Archivo actualizado" -ForegroundColor Green
}

Write-Host ""
Write-Host "🎉 PROCESO COMPLETADO!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor White
Write-Host "📊 Resumen:" -ForegroundColor White
Write-Host "  • Archivos procesados: $($modelFiles.Count)" -ForegroundColor White
Write-Host "  • Backup guardado en: $backupDir" -ForegroundColor White
Write-Host "  • Decoradores eliminados: @BelongsTo, @HasMany, @HasOne" -ForegroundColor White
Write-Host "  • Propiedades convertidas a tipo 'any'" -ForegroundColor White

# Verificar resultado
Write-Host ""
Write-Host "🔍 Verificando resultado..." -ForegroundColor Yellow
$remainingAssociations = Select-String -Path "src\models\*.ts" -Pattern "@BelongsTo|@HasMany|@HasOne"

if ($remainingAssociations) {
    Write-Host "⚠️  Aún quedan asociaciones por corregir:" -ForegroundColor Yellow
    foreach ($match in $remainingAssociations) {
        Write-Host "  $($match.Filename):$($match.LineNumber) - $($match.Line.Trim())" -ForegroundColor Red
    }
} else {
    Write-Host "✅ ¡PERFECTO! No quedan decoradores de asociaciones" -ForegroundColor Green
}

Write-Host ""
Write-Host "🚀 SIGUIENTES PASOS:" -ForegroundColor Cyan
Write-Host "1. Compilar el proyecto:" -ForegroundColor White
Write-Host "   npm run build" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Si compila bien, iniciar el servidor:" -ForegroundColor White
Write-Host "   npm start" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Si hay problemas, restaurar backup:" -ForegroundColor White
Write-Host "   Copy-Item '$backupDir\*.ts' 'src\models\' -Force" -ForegroundColor Gray

Write-Host ""
Write-Host "✨ Script completado exitosamente!" -ForegroundColor Green