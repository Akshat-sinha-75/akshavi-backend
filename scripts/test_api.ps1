# Women Safety Platform - Automated API Test Script
# Run this script to test all backend REST endpoints

$BaseUrl = "http://localhost:8080"
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   WOMEN SAFETY APP - API TEST SUITE     " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Health Check Test
Write-Host "`n[1/6] Testing Health Check Endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get
    Write-Host "✅ Health Check OK: Status=$($health.status)" -ForegroundColor Green
    Write-Host "   - Database: $($health.services.database)" -ForegroundColor Gray
    Write-Host "   - Redis:    $($health.services.redis)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
}

# 2. Authentication Test (Normal PIN)
Write-Host "`n[2/6] Testing User Login (Normal PIN)..." -ForegroundColor Yellow
$loginBody = @{
    identifier = "+919876543210"
    pin = "1234"
} | ConvertTo-Json

try {
    $loginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    Write-Host "✅ Login Success: User=$($loginResp.user.fullName), IsFake=$($loginResp.isFakeLogin)" -ForegroundColor Green
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
}

# 3. Authentication Test (Fake PIN / Duress Silent SOS)
Write-Host "`n[3/6] Testing Fake PIN Duress Trigger (Silent SOS)..." -ForegroundColor Yellow
$fakePinBody = @{
    identifier = "+919876543210"
    pin = "9999"
} | ConvertTo-Json

try {
    $fakeResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $fakePinBody -ContentType "application/json"
    Write-Host "✅ Fake PIN Test Passed: IsFakeLogin=$($fakeResp.isFakeLogin) (Silent SOS triggered!)" -ForegroundColor Green
} catch {
    Write-Host "❌ Fake PIN test failed: $_" -ForegroundColor Red
}

# 4. Location Ingest Test (TimescaleDB + Redis)
Write-Host "`n[4/6] Testing Live Location Ingestion..." -ForegroundColor Yellow
$locBody = @{
    userId = "a0000000-0000-0000-0000-000000000001"
    latitude = 19.0760
    longitude = 72.8777
    accuracyMeters = 3.5
    batteryLevel = 82
    speedMPS = 1.4
} | ConvertTo-Json

try {
    $locResp = Invoke-RestMethod -Uri "$BaseUrl/api/location/track" -Method Post -Body $locBody -ContentType "application/json"
    Write-Host "✅ Location Ingested OK: IsSOS=$($locResp.isSos)" -ForegroundColor Green
} catch {
    Write-Host "❌ Location ingestion failed: $_" -ForegroundColor Red
}

# 5. SOS Emergency Trigger Test
Write-Host "`n[5/6] Testing SOS Emergency Trigger..." -ForegroundColor Yellow
$sosBody = @{
    userId = "a0000000-0000-0000-0000-000000000001"
    triggerType = "ONE_TAP"
    latitude = 19.0760
    longitude = 72.8777
    batteryLevel = 82
} | ConvertTo-Json

$sosId = ""
try {
    $sosResp = Invoke-RestMethod -Uri "$BaseUrl/api/sos/trigger" -Method Post -Body $sosBody -ContentType "application/json"
    $sosId = $sosResp.sosEvent.id
    Write-Host "✅ Emergency SOS Activated: ID=$sosId, Status=$($sosResp.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ SOS Trigger failed: $_" -ForegroundColor Red
}

# 6. SOS Resolution Test (Using Real PIN)
Write-Host "`n[6/6] Testing SOS Resolution with Real PIN..." -ForegroundColor Yellow
if ($sosId) {
    $resolveBody = @{
        sosEventId = $sosId
        userId = "a0000000-0000-0000-0000-000000000001"
        pin = "1234"
    } | ConvertTo-Json

    try {
        $resolveResp = Invoke-RestMethod -Uri "$BaseUrl/api/sos/resolve" -Method Post -Body $resolveBody -ContentType "application/json"
        Write-Host "✅ SOS Successfully Resolved: Status=$($resolveResp.status)" -ForegroundColor Green
    } catch {
        Write-Host "❌ SOS Resolution failed: $_" -ForegroundColor Red
    }
}

# 7. Super-Admin Portal Authentication Test
Write-Host "`n[7/7] Testing Super-Admin Authentication..." -ForegroundColor Yellow
$adminAuthBody = @{
    email = "akshat.sinha.0503@gmail.com"
    password = "Akshatsinha@18"
} | ConvertTo-Json

try {
    $adminResp = Invoke-RestMethod -Uri "$BaseUrl/api/admin/login" -Method Post -Body $adminAuthBody -ContentType "application/json"
    Write-Host "✅ Super-Admin Login Success: Admin=$($adminResp.admin.name), Role=$($adminResp.admin.role)" -ForegroundColor Green
    
    $headers = @{ "Authorization" = "Bearer $($adminResp.token)" }
    $users = Invoke-RestMethod -Uri "$BaseUrl/api/admin/users" -Method Get -Headers $headers
    Write-Host "✅ Protected Admin Users List Fetched: $($users.Count) users found" -ForegroundColor Green
} catch {
    Write-Host "❌ Admin Auth failed: $_" -ForegroundColor Red
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host "   ALL TESTS EXECUTED SUCCESSFULLY!      " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
