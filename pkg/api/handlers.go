package api

import (
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"women-safety-app/pkg/cache"
	"women-safety-app/pkg/db"
	"women-safety-app/pkg/models"
	"women-safety-app/pkg/notification"
	"women-safety-app/pkg/ws"
)

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// 1. Authentication Handlers
func RequestOTPHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.RequestOTPRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	user, err := db.GetUserByIdentifier(req.Email)
	if err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	// Generate 6 digit OTP
	otp := fmt.Sprintf("%06d", rand.Intn(1000000))
	cache.StoreOTP(user.Email, otp)
	if user.PhoneNumber != "" {
		cache.StoreOTP(user.PhoneNumber, otp)
	}

	// Since we don't have SMTP configured, we log the OTP to the console
	log.Printf("📧 [SIMULATED EMAIL] OTP for %s is: %s", user.Email, otp)

	writeJSON(w, http.StatusOK, map[string]string{"message": "OTP sent successfully (Check server logs)"})
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.AuthRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	user, err := db.GetUserByIdentifier(req.Identifier)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "User not found with provided email or phone number")
		return
	}

	// Verify OTP if provided
	if req.OTP != "" {
		if !cache.VerifyOTP(req.Identifier, req.OTP) {
			writeError(w, http.StatusUnauthorized, "Invalid or expired OTP")
			return
		}
	} else {
		// Fallback to Password verification (or could strictly enforce OTP)
		if req.Password != user.PasswordHash {
			writeError(w, http.StatusUnauthorized, "Incorrect password or OTP required")
			return
		}
	}

	resp := models.AuthResponse{
		Token:       "jwt_valid_" + user.ID,
		User:        *user,
		IsFakeLogin: false,
	}
	writeJSON(w, http.StatusOK, resp)
}

func isValidPassword(s string) bool {
	if len(s) < 8 {
		return false
	}
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(s)
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(s)
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(s)
	hasSpecial := regexp.MustCompile(`[\W_]`).MatchString(s)
	return hasUpper && hasLower && hasNumber && hasSpecial
}

func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.Email == "" || req.PhoneNumber == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "Email, phone number, and password are required")
		return
	}

	if !isValidPassword(req.Password) {
		writeError(w, http.StatusBadRequest, "Password must be at least 8 characters long, contain 1 uppercase, 1 lowercase, 1 number, and 1 special character.")
		return
	}

	user, err := db.CreateUserAccount(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Registration failed: "+err.Error())
		return
	}

	log.Printf("🎉 New Account Registered: %s (%s)", user.Email, user.PhoneNumber)
	writeJSON(w, http.StatusCreated, models.AuthResponse{
		Token:       "jwt_valid_" + user.ID,
		User:        *user,
		IsFakeLogin: false,
	})
}

func ProfileSetupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.ProfileSetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	if req.UserID == "" || req.FullName == "" || req.PIN == "" || req.FakePIN == "" {
		writeError(w, http.StatusBadRequest, "User ID, Full Name, Real PIN, and Fake PIN are required")
		return
	}

	if req.PIN == req.FakePIN {
		writeError(w, http.StatusBadRequest, "Real PIN and Fake PIN must be different")
		return
	}

	if req.Age == 0 {
		req.Age = 22
	}
	if req.Address == "" {
		req.Address = "Mumbai, Maharashtra"
	}

	user, err := db.CompleteUserProfile(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to complete profile: "+err.Error())
		return
	}

	log.Printf("🛡️ Profile Completed: %s (Code: %s)", user.FullName, user.UserCode)
	writeJSON(w, http.StatusOK, user)
}

func UpdateUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	userId := r.URL.Path[len("/api/users/") : len(r.URL.Path)-len("/profile")]

	var req models.UpdateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	user, err := db.UpdateProfileDetails(userId, req.FullName, req.Age, req.Address)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update profile")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func DeleteUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	userId := r.URL.Path[len("/api/users/"):]

	err := db.DeleteUserAccount(userId)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to delete account")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func RegisterFCMTokenHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		UserID   string `json:"userId"`
		FCMToken string `json:"fcmToken"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.UserID == "" || req.FCMToken == "" {
		writeError(w, http.StatusBadRequest, "userId and fcmToken are required")
		return
	}

	if err := db.UpdateFCMToken(req.UserID, req.FCMToken); err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to update FCM token")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "success"})
}

// 2. Trustee Connections Handlers (Request & Pairing System)
func SendTrusteeRequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.SendTrusteeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request payload")
		return
	}

	target := req.TargetCode
	if target == "" {
		target = req.TargetPhone
	}

	if target == "" || req.RequesterID == "" {
		writeError(w, http.StatusBadRequest, "Target code or phone is required")
		return
	}

	conn, err := db.SendConnectionRequest(req.RequesterID, target)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":     "REQUEST_SENT",
		"connection": conn,
	})
}

func GetPendingRequestsHandler(w http.ResponseWriter, r *http.Request) {
	userId := r.URL.Query().Get("userId")
	if userId == "" {
		writeError(w, http.StatusBadRequest, "userId query parameter is required")
		return
	}

	requests, err := db.GetPendingRequestsForUser(userId)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, requests)
}

func GetSentRequestsHandler(w http.ResponseWriter, r *http.Request) {
	userId := r.URL.Query().Get("userId")
	if userId == "" {
		writeError(w, http.StatusBadRequest, "userId query parameter is required")
		return
	}

	requests, err := db.GetSentRequestsForUser(userId)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, requests)
}

func RespondTrusteeRequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.RespondTrusteeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid payload")
		return
	}

	err := db.RespondToConnectionRequest(req.ConnectionID, req.UserID, req.Accept)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	status := "REJECTED"
	if req.Accept {
		status = "ACCEPTED"
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": status})
}


func GetMyTrusteesHandler(w http.ResponseWriter, r *http.Request) {
	userId := r.URL.Query().Get("userId")
	if userId == "" {
		writeError(w, http.StatusBadRequest, "userId query parameter is required")
		return
	}

	trustees, err := db.GetMyTrustees(userId)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, trustees)
}

func GetActiveWardsHandler(w http.ResponseWriter, r *http.Request) {
	userId := r.URL.Query().Get("userId")
	if userId == "" {
		writeError(w, http.StatusBadRequest, "userId query parameter is required")
		return
	}

	wards, err := db.GetActiveWards(userId)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// For each active ward, fetch their latest real-time location from Redis
	for i := range wards {
		loc, _ := cache.GetLatestLocation(wards[i].WardUser.ID)
		if loc != nil {
			wards[i].LatestLocation = loc
		}
	}

	writeJSON(w, http.StatusOK, wards)
}

func ToggleSharingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.ToggleSharingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid payload")
		return
	}

	err := db.ToggleGuardianSharing(req.ConnectionID, req.UserID, req.Enable)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":           "UPDATED",
		"isSharingEnabled": req.Enable,
	})
}

// 3. Location Ingest & Real-Time Tracking ("TRACK ME")
func TrackLocationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var lp models.LocationPoint
	if err := json.NewDecoder(r.Body).Decode(&lp); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid location payload")
		return
	}

	if lp.UserID == "" {
		lp.UserID = "a0000000-0000-0000-0000-000000000001"
	}
	if lp.Time.IsZero() {
		lp.Time = time.Now().UTC()
	}

	activeSOS, _ := cache.GetActiveSOS(lp.UserID)
	if activeSOS != nil {
		lp.IsSOS = true
	}

	db.InsertLocation(&lp)
	cache.SetLatestLocation(&lp)
	cache.AppendToTrail(&lp)
	user, _ := db.GetUserByID(lp.UserID)
	if user != nil && !user.IsTrackingActive {
		go notification.NotifyGuardians(lp.UserID, "Tracking Started", fmt.Sprintf("%s has started sharing their live location.", user.FullName), nil)
	}

	db.UpdateUserStatus(lp.UserID, lp.BatteryLevel, true)

	// Real-time broadcast to Admin and Guardians
	ws.GlobalHub.BroadcastMessage("LOCATION_UPDATE", lp)

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":   "received",
		"isSos":    lp.IsSOS,
		"location": lp,
	})
}

func LocationHistoryHandler(w http.ResponseWriter, r *http.Request) {
	parts := strings.Split(r.URL.Path, "/")
	userId := parts[len(parts)-1]

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	rows, err := db.DB.Query(`SELECT time, user_id, latitude, longitude, accuracy_meters, battery_level, speed_mps, is_sos 
	                          FROM location_history WHERE user_id = $1 ORDER BY time DESC LIMIT $2`, userId, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer rows.Close()

	var points []models.LocationPoint
	for rows.Next() {
		var p models.LocationPoint
		if err := rows.Scan(&p.Time, &p.UserID, &p.Latitude, &p.Longitude, &p.AccuracyMeters, &p.BatteryLevel, &p.SpeedMPS, &p.IsSOS); err == nil {
			points = append(points, p)
		}
	}

	writeJSON(w, http.StatusOK, points)
}

func StopTrackingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userId := strings.TrimPrefix(r.URL.Path, "/api/location/stop/")
	if userId == "" || userId == r.URL.Path {
		writeError(w, http.StatusBadRequest, "User ID required")
		return
	}

	err := db.StopUserTracking(userId)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to stop tracking")
		return
	}
	
	cache.ClearTrail(userId)
	ws.GlobalHub.BroadcastMessage("TRACKING_STOPPED", map[string]string{"userId": userId})

	writeJSON(w, http.StatusOK, map[string]string{"message": "Tracking stopped"})
}

func GetLiveTrailHandler(w http.ResponseWriter, r *http.Request) {
	userId := strings.TrimPrefix(r.URL.Path, "/api/location/trail/")
	if userId == "" || userId == r.URL.Path {
		writeError(w, http.StatusBadRequest, "User ID required")
		return
	}

	trail, err := cache.GetTrail(userId)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if trail == nil {
		trail = []models.LocationPoint{}
	}
	writeJSON(w, http.StatusOK, trail)
}

// 4. Emergency SOS Handlers
func TriggerSOSHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.TriggerSOSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid payload")
		return
	}

	sosEvt, err := db.CreateSOSEvent(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	user, _ := db.GetUserByID(req.UserID)
	sosEvt.User = user

	cache.SetActiveSOS(sosEvt)

	db.InsertLocation(&models.LocationPoint{
		Time:           time.Now().UTC(),
		UserID:         req.UserID,
		Latitude:       req.Latitude,
		Longitude:      req.Longitude,
		AccuracyMeters: 3.0,
		BatteryLevel:   req.BatteryLevel,
		SpeedMPS:       0.0,
		IsSOS:          true,
	})

	ws.GlobalHub.BroadcastMessage("SOS_TRIGGERED", sosEvt)
	log.Printf("🚨 EMERGENCY SOS BROADCAST for User: %s (Trigger: %s)", req.UserID, req.TriggerType)

	go notification.NotifyGuardians(req.UserID, "🚨 EMERGENCY SOS", fmt.Sprintf("%s triggered an emergency SOS!", user.FullName), map[string]string{"type": "SOS"})

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":   "SOS_ACTIVE",
		"sosEvent": sosEvt,
	})
}

func ResolveSOSHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req models.ResolveSOSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid payload")
		return
	}

	user, err := db.GetUserByID(req.UserID)
	if err != nil {
		writeError(w, http.StatusNotFound, "User not found")
		return
	}

	if req.PIN != user.PinHash {
		writeError(w, http.StatusUnauthorized, "Invalid PIN. Cannot cancel SOS.")
		return
	}

	db.ResolveSOSEvent(req.SOSEventID, req.UserID)
	cache.ClearActiveSOS(req.UserID)

	ws.GlobalHub.BroadcastMessage("SOS_RESOLVED", map[string]string{
		"sosEventId": req.SOSEventID,
		"userId":     req.UserID,
	})

	writeJSON(w, http.StatusOK, map[string]string{"status": "SOS_RESOLVED"})
}

func GetActiveSOSHandler(w http.ResponseWriter, r *http.Request) {
	events, err := db.GetActiveSOSEvents()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	for i := range events {
		loc, _ := cache.GetLatestLocation(events[i].UserID)
		events[i].LatestLocation = loc
	}

	writeJSON(w, http.StatusOK, events)
}

// 5. SUPER-ADMIN Portal Handlers
type AdminLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

const SuperAdminEmail = "akshat.sinha.0503@gmail.com"
const SuperAdminPass = "Akshatsinha@18"
const AdminAuthToken = "admin_super_secret_token_raksha_2026"

func checkAdminAuth(r *http.Request) bool {
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimPrefix(authHeader, "Bearer ")
		return token == AdminAuthToken
	}
	if r.Header.Get("X-Admin-Token") == AdminAuthToken {
		return true
	}
	return false
}

func AdminLoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req AdminLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid login payload")
		return
	}

	if req.Email != SuperAdminEmail || req.Password != SuperAdminPass {
		writeError(w, http.StatusUnauthorized, "Invalid Super-Admin credentials")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status": "authenticated",
		"token":  AdminAuthToken,
		"admin": map[string]string{
			"name":  "Akshat Sinha",
			"email": SuperAdminEmail,
			"role":  "SUPER_ADMIN",
		},
	})
}

func AdminGetUsersHandler(w http.ResponseWriter, r *http.Request) {
	if !checkAdminAuth(r) {
		writeError(w, http.StatusUnauthorized, "Super-Admin authentication required")
		return
	}

	users, err := db.GetAllUsersForAdmin()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func AdminGetStatsHandler(w http.ResponseWriter, r *http.Request) {
	if !checkAdminAuth(r) {
		writeError(w, http.StatusUnauthorized, "Super-Admin authentication required")
		return
	}

	stats, err := db.GetAdminStats()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func AdminResolveSOSHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	if !checkAdminAuth(r) {
		writeError(w, http.StatusUnauthorized, "Super-Admin authentication required")
		return
	}

	var req models.ResolveSOSRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid payload")
		return
	}

	db.ResolveSOSEvent(req.SOSEventID, req.UserID)
	cache.ClearActiveSOS(req.UserID)

	ws.GlobalHub.BroadcastMessage("SOS_RESOLVED", map[string]string{
		"sosEventId": req.SOSEventID,
		"userId":     req.UserID,
		"adminResolved": "true",
	})

	writeJSON(w, http.StatusOK, map[string]string{"status": "SOS_RESOLVED_BY_ADMIN"})
}
