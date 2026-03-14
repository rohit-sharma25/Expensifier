# /tmp/test-bank-sync.ps1
# This script simulates an incoming bank SMS to the local Cloud Function emulator.

$LOCAL_WEBHOOK_URL = "http://127.0.0.1:5001/expensify-55ed8/us-central1/bankSmsWebhook"
$SECRET_KEY = "0GjAuPvVTpLj3C6H"

# Sample HDFC SMS
$SMS_BODY = @{
    text = "HDFC Bank: Rs 1,500.00 debited from a/c **9876 on 13-03-26 to SWIGGY. Bal: Rs 45,200.00"
    secret = $SECRET_KEY
}

Write-Host "🚀 Sending Mock SMS to local emulator..." -ForegroundColor Cyan
Write-Host "Target: $LOCAL_WEBHOOK_URL" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $LOCAL_WEBHOOK_URL -Method Post -Body ($SMS_BODY | ConvertTo-Json) -ContentType "application/json"
    Write-Host "✅ Success! Response:" -ForegroundColor Green
    $response | ConvertTo-Json
} catch {
    Write-Host "❌ Failed. Ensure 'firebase emulators:start' is running." -ForegroundColor Red
    Write-Host $_.Exception.Message
}
