# API Testing Script for Production Readiness
Write-Host "`n🧪 Testing API Endpoints..." -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:5000"

# Test 1: API Test Endpoint
Write-Host "1️⃣  Testing /api/test..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/test" -Method Get
    if ($response.success -eq $true) {
        Write-Host "   ✅ PASS: Returns JSON with success=true" -ForegroundColor Green
        Write-Host "   Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
    } else {
        Write-Host "   ❌ FAIL: success is not true" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: API Sermons Endpoint
Write-Host "`n2️⃣  Testing /api/sermons..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/sermons" -Method Get
    if ($response.success -eq $true -and $response.data) {
        Write-Host "   ✅ PASS: Returns JSON with success=true and data array" -ForegroundColor Green
        Write-Host "   Count: $($response.count)" -ForegroundColor Gray
    } else {
        Write-Host "   ❌ FAIL: Missing success or data field" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: API 404 Handler
Write-Host "`n3️⃣  Testing /api/nonexistent (404 handler)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/api/nonexistent" -Method Get -ErrorAction Stop
    Write-Host "   ❌ FAIL: Should have returned 404" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        # Parse JSON error response
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errorBody = $reader.ReadToEnd() | ConvertFrom-Json
        
        if ($errorBody.success -eq $false) {
            Write-Host "   ✅ PASS: Returns 404 with JSON error" -ForegroundColor Green
            Write-Host "   Response: $($errorBody | ConvertTo-Json -Compress)" -ForegroundColor Gray
        } else {
            Write-Host "   ❌ FAIL: 404 but wrong format" -ForegroundColor Red
        }
    } else {
        Write-Host "   ❌ FAIL: Wrong status code" -ForegroundColor Red
    }
}

# Test 4: Root returns HTML (not JSON)
Write-Host "`n4️⃣  Testing / (should return HTML)..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/" -Method Get
    if ($response.Content -match "<div id=`"root`">") {
        Write-Host "   ✅ PASS: Root returns HTML with #root div" -ForegroundColor Green
    } else {
        Write-Host "   ❌ FAIL: Root doesn't return expected HTML" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "🏁 Testing Complete!" -ForegroundColor Cyan
Write-Host "`nIf all tests pass, you're ready to deploy! 🚀`n" -ForegroundColor Green
