$body = @{
    fullName = "Ananya Sen"
    email = "ananya@gmail.com"
    phoneNumber = "+919811223344"
    age = 21
    address = "Kolkata, WB"
    pin = "1234"
    fakePin = "9999"
} | ConvertTo-Json

$res = Invoke-RestMethod -Uri "http://localhost:8080/api/auth/register" -Method Post -Body $body -ContentType "application/json"
$res | Format-List
