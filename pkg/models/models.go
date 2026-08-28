package models

import "time"

type User struct {
	ID               string    `json:"id"`
	UserCode         string    `json:"userCode"`
	Email            string    `json:"email"`
	PhoneNumber      string    `json:"phoneNumber"`
	FullName         string    `json:"fullName"`
	Age              int       `json:"age"`
	Address          string    `json:"address"`
	PinHash          string    `json:"-"`
	FakePinHash      string    `json:"-"`
	PasswordHash     string    `json:"-"`
	ProfileCompleted bool      `json:"profileCompleted"`
	KYCStatus        string    `json:"kycStatus"`
	BatteryLevel     int       `json:"batteryLevel"`
	IsTrackingActive bool      `json:"isTrackingActive"`
	FCMToken         string    `json:"fcmToken,omitempty"`
	CreatedAt        time.Time `json:"createdAt"`
}

type AuthRequest struct {
	Identifier string `json:"identifier"` // Email or Phone Number
	Password   string `json:"password"`
	OTP        string `json:"otp"`        // Used for OTP login
}

type RequestOTPRequest struct {
	Email string `json:"email"`
}

type RegisterRequest struct {
	Email       string `json:"email"`
	PhoneNumber string `json:"phoneNumber"`
	Password    string `json:"password"`
}

type ProfileSetupRequest struct {
	UserID   string `json:"userId"`
	FullName string `json:"fullName"`
	Age      int    `json:"age"`
	Address  string `json:"address"`
	PIN      string `json:"pin"`     // Real 4-Digit PIN
	FakePIN  string `json:"fakePin"` // Fake 4-Digit Duress PIN
}

type UpdateProfileRequest struct {
	FullName string `json:"fullName"`
	Age      int    `json:"age"`
	Address  string `json:"address"`
}

type AuthResponse struct {
	Token       string `json:"token"`
	User        User   `json:"user"`
	IsFakeLogin bool   `json:"isFakeLogin"`
}

type TrusteeConnection struct {
	ID               string    `json:"id"`
	RequesterID      string    `json:"requesterId"`
	ReceiverID       string    `json:"receiverId"`
	Status           string    `json:"status"` // PENDING, ACCEPTED, REJECTED
	IsSharingEnabled bool      `json:"isSharingEnabled"`
	CreatedAt        time.Time `json:"createdAt"`
	TrusteeUser      *User     `json:"trusteeUser,omitempty"`
}

type ActiveWard struct {
	ConnectionID     string         `json:"connectionId"`
	WardUser         User           `json:"wardUser"`
	IsSharingEnabled bool           `json:"isSharingEnabled"`
	LatestLocation   *LocationPoint `json:"latestLocation,omitempty"`
}

type SendTrusteeRequest struct {
	RequesterID string `json:"requesterId"`
	TargetCode  string `json:"targetCode"`  // Search by RAK-XXXX
	TargetPhone string `json:"targetPhone"` // Search by Phone
}

type RespondTrusteeRequest struct {
	ConnectionID string `json:"connectionId"`
	UserID       string `json:"userId"`
	Accept       bool   `json:"accept"`
}

type ToggleSharingRequest struct {
	ConnectionID string `json:"connectionId"`
	UserID       string `json:"userId"`
	Enable       bool   `json:"enable"`
}

type LocationPoint struct {
	Time           time.Time `json:"time"`
	UserID         string    `json:"userId"`
	Latitude       float64   `json:"latitude"`
	Longitude      float64   `json:"longitude"`
	AccuracyMeters float64   `json:"accuracyMeters"`
	BatteryLevel   int       `json:"batteryLevel"`
	SpeedMPS       float64   `json:"speedMPS"`
	NetworkType    string    `json:"networkType"`
	IsSOS          bool      `json:"isSos"`
}

type SOSEvent struct {
	ID               string         `json:"id"`
	UserID           string         `json:"userId"`
	TriggerType      string         `json:"triggerType"`
	Status           string         `json:"status"`
	InitialLatitude  float64        `json:"initialLatitude"`
	InitialLongitude float64        `json:"initialLongitude"`
	BatteryLevel     int            `json:"batteryLevel"`
	StartedAt        time.Time      `json:"startedAt"`
	ResolvedAt       *time.Time     `json:"resolvedAt,omitempty"`
	User             *User          `json:"user,omitempty"`
	LatestLocation   *LocationPoint `json:"latestLocation,omitempty"`
}

type TriggerSOSRequest struct {
	UserID       string  `json:"userId"`
	TriggerType  string  `json:"triggerType"`
	Latitude     float64 `json:"latitude"`
	Longitude    float64 `json:"longitude"`
	BatteryLevel int     `json:"batteryLevel"`
}

type ResolveSOSRequest struct {
	SOSEventID string `json:"sosEventId"`
	UserID     string `json:"userId"`
	PIN        string `json:"pin"`
}

type AdminUserView struct {
	User           User           `json:"user"`
	LatestLocation *LocationPoint `json:"latestLocation,omitempty"`
	ActiveSOS      *SOSEvent      `json:"activeSos,omitempty"`
	TrusteeCount   int            `json:"trusteeCount"`
}

type AdminStats struct {
	TotalUsers     int `json:"totalUsers"`
	ActiveSOSCount int `json:"activeSosCount"`
	TrackingActive int `json:"trackingActiveCount"`
}

type WSMessage struct {
	Type      string      `json:"type"`
	Payload   interface{} `json:"payload"`
	Timestamp time.Time   `json:"timestamp"`
}
