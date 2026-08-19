package db

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"time"

	_ "github.com/lib/pq"
	"women-safety-app/pkg/models"
)

var DB *sql.DB

func InitDB(host, port, user, password, dbname string) (*sql.DB, error) {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	var err error
	DB, err = sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(5)
	DB.SetConnMaxLifetime(5 * time.Minute)

	if err := DB.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("✅ TimescaleDB connection established")
	return DB, nil
}

func generateUserCode() string {
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	return fmt.Sprintf("RAK-%04d", r.Intn(9000)+1000)
}

// User Operations
func GetUserByIdentifier(identifier string) (*models.User, error) {
	query := `SELECT id, COALESCE(user_code, ''), email, phone_number, password_hash, full_name, age, address, pin_hash, fake_pin_hash, profile_completed, kyc_status, battery_level, is_tracking_active, created_at 
	          FROM users WHERE email = $1 OR phone_number = $1 OR user_code = $1`
	row := DB.QueryRow(query, identifier)

	var u models.User
	err := row.Scan(&u.ID, &u.UserCode, &u.Email, &u.PhoneNumber, &u.PasswordHash, &u.FullName, &u.Age, &u.Address, &u.PinHash, &u.FakePinHash, &u.ProfileCompleted, &u.KYCStatus, &u.BatteryLevel, &u.IsTrackingActive, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func GetUserByID(id string) (*models.User, error) {
	query := `SELECT id, COALESCE(user_code, ''), email, phone_number, password_hash, full_name, age, address, pin_hash, fake_pin_hash, profile_completed, kyc_status, battery_level, is_tracking_active, created_at 
	          FROM users WHERE id = $1`
	row := DB.QueryRow(query, id)

	var u models.User
	err := row.Scan(&u.ID, &u.UserCode, &u.Email, &u.PhoneNumber, &u.PasswordHash, &u.FullName, &u.Age, &u.Address, &u.PinHash, &u.FakePinHash, &u.ProfileCompleted, &u.KYCStatus, &u.BatteryLevel, &u.IsTrackingActive, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// Step 1: Initial Registration (Email, Phone, Password)
func CreateUserAccount(req models.RegisterRequest) (*models.User, error) {
	query := `INSERT INTO users (email, phone_number, password_hash, full_name, age, address, pin_hash, fake_pin_hash, profile_completed, kyc_status) 
	          VALUES ($1, $2, $3, '', 0, '', '1234', '9999', FALSE, 'VERIFIED') 
	          RETURNING id, COALESCE(user_code, ''), email, phone_number, COALESCE(full_name, ''), age, COALESCE(address, ''), profile_completed, kyc_status, battery_level, is_tracking_active, created_at`
	row := DB.QueryRow(query, req.Email, req.PhoneNumber, req.Password)

	var u models.User
	err := row.Scan(&u.ID, &u.UserCode, &u.Email, &u.PhoneNumber, &u.FullName, &u.Age, &u.Address, &u.ProfileCompleted, &u.KYCStatus, &u.BatteryLevel, &u.IsTrackingActive, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// Step 2: Profile Building (Name, Age, Address, Real PIN, Fake PIN -> generates RAK-XXXX)
func CompleteUserProfile(req models.ProfileSetupRequest) (*models.User, error) {
	code := generateUserCode()
	query := `UPDATE users 
	          SET user_code = $1, full_name = $2, age = $3, address = $4, pin_hash = $5, fake_pin_hash = $6, profile_completed = TRUE 
	          WHERE id = $7 
	          RETURNING id, user_code, email, phone_number, full_name, age, address, profile_completed, kyc_status, battery_level, is_tracking_active, created_at`
	row := DB.QueryRow(query, code, req.FullName, req.Age, req.Address, req.PIN, req.FakePIN, req.UserID)

	var u models.User
	err := row.Scan(&u.ID, &u.UserCode, &u.Email, &u.PhoneNumber, &u.FullName, &u.Age, &u.Address, &u.ProfileCompleted, &u.KYCStatus, &u.BatteryLevel, &u.IsTrackingActive, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func UpdateUserStatus(userId string, batteryLevel int, isTrackingActive bool) error {
	query := `UPDATE users SET battery_level = $1, is_tracking_active = $2 WHERE id = $3`
	_, err := DB.Exec(query, batteryLevel, isTrackingActive, userId)
	return err
}

func UpdateProfileDetails(userId, fullName string, age int, address string) (*models.User, error) {
	query := `UPDATE users SET full_name = $1, age = $2, address = $3 WHERE id = $4
	          RETURNING id, user_code, email, phone_number, full_name, age, address, profile_completed, kyc_status, battery_level, is_tracking_active, created_at`
	row := DB.QueryRow(query, fullName, age, address, userId)
	var u models.User
	err := row.Scan(&u.ID, &u.UserCode, &u.Email, &u.PhoneNumber, &u.FullName, &u.Age, &u.Address, &u.ProfileCompleted, &u.KYCStatus, &u.BatteryLevel, &u.IsTrackingActive, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func DeleteUserAccount(userId string) error {
	query := `DELETE FROM users WHERE id = $1`
	_, err := DB.Exec(query, userId)
	return err
}

// Trustee Connections Operations
func SendConnectionRequest(requesterId, targetIdentifier string) (*models.TrusteeConnection, error) {
	targetUser, err := GetUserByIdentifier(targetIdentifier)
	if err != nil {
		return nil, fmt.Errorf("target guardian not found with code/phone: %s", targetIdentifier)
	}

	if targetUser.ID == requesterId {
		return nil, fmt.Errorf("you cannot add yourself as a guardian")
	}

	query := `INSERT INTO trustee_connections (requester_id, receiver_id, status, is_sharing_enabled)
	          VALUES ($1, $2, 'PENDING', TRUE)
	          ON CONFLICT (requester_id, receiver_id) DO UPDATE SET status = 'PENDING', is_sharing_enabled = TRUE, updated_at = CURRENT_TIMESTAMP
	          RETURNING id, requester_id, receiver_id, status, is_sharing_enabled, created_at`
	row := DB.QueryRow(query, requesterId, targetUser.ID)

	var conn models.TrusteeConnection
	err = row.Scan(&conn.ID, &conn.RequesterID, &conn.ReceiverID, &conn.Status, &conn.IsSharingEnabled, &conn.CreatedAt)
	if err != nil {
		return nil, err
	}
	conn.TrusteeUser = targetUser
	return &conn, nil
}

func GetPendingRequestsForUser(userId string) ([]models.TrusteeConnection, error) {
	query := `SELECT c.id, c.requester_id, c.receiver_id, c.status, c.is_sharing_enabled, c.created_at,
	                 u.id, COALESCE(u.user_code, ''), u.full_name, u.phone_number, u.email
	          FROM trustee_connections c
	          JOIN users u ON c.requester_id = u.id
	          WHERE c.receiver_id = $1 AND c.status = 'PENDING'`
	rows, err := DB.Query(query, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.TrusteeConnection
	for rows.Next() {
		var c models.TrusteeConnection
		var u models.User
		if err := rows.Scan(&c.ID, &c.RequesterID, &c.ReceiverID, &c.Status, &c.IsSharingEnabled, &c.CreatedAt,
			&u.ID, &u.UserCode, &u.FullName, &u.PhoneNumber, &u.Email); err != nil {
			return nil, err
		}
		c.TrusteeUser = &u
		list = append(list, c)
	}
	return list, nil
}

func RespondToConnectionRequest(connectionId, userId string, accept bool) error {
	status := "REJECTED"
	if accept {
		status = "ACCEPTED"
	}
	query := `UPDATE trustee_connections SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND receiver_id = $3`
	_, err := DB.Exec(query, status, connectionId, userId)
	return err
}

func GetMyTrustees(userId string) ([]models.TrusteeConnection, error) {
	query := `SELECT c.id, c.requester_id, c.receiver_id, c.status, c.is_sharing_enabled, c.created_at,
	                 u.id, COALESCE(u.user_code, ''), u.full_name, u.phone_number, u.email
	          FROM trustee_connections c
	          JOIN users u ON (CASE WHEN c.requester_id = $1 THEN c.receiver_id ELSE c.requester_id END) = u.id
	          WHERE (c.requester_id = $1 OR c.receiver_id = $1) AND c.status = 'ACCEPTED'`
	rows, err := DB.Query(query, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.TrusteeConnection
	for rows.Next() {
		var c models.TrusteeConnection
		var u models.User
		if err := rows.Scan(&c.ID, &c.RequesterID, &c.ReceiverID, &c.Status, &c.IsSharingEnabled, &c.CreatedAt,
			&u.ID, &u.UserCode, &u.FullName, &u.PhoneNumber, &u.Email); err != nil {
			return nil, err
		}
		c.TrusteeUser = &u
		list = append(list, c)
	}
	return list, nil
}

func GetActiveWards(guardianId string) ([]models.ActiveWard, error) {
	query := `SELECT c.id, c.is_sharing_enabled,
	                 u.id, COALESCE(u.user_code, ''), u.full_name, u.phone_number, u.email, u.battery_level, u.is_tracking_active
	          FROM trustee_connections c
	          JOIN users u ON (CASE WHEN c.requester_id = $1 THEN c.receiver_id ELSE c.requester_id END) = u.id
	          WHERE (c.requester_id = $1 OR c.receiver_id = $1) AND c.status = 'ACCEPTED' AND u.is_tracking_active = true`
	rows, err := DB.Query(query, guardianId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.ActiveWard
	for rows.Next() {
		var w models.ActiveWard
		if err := rows.Scan(&w.ConnectionID, &w.IsSharingEnabled,
			&w.WardUser.ID, &w.WardUser.UserCode, &w.WardUser.FullName, &w.WardUser.PhoneNumber, &w.WardUser.Email, &w.WardUser.BatteryLevel, &w.WardUser.IsTrackingActive); err != nil {
			return nil, err
		}
		list = append(list, w)
	}
	return list, nil
}

func ToggleGuardianSharing(connectionId, userId string, enable bool) error {
	query := `UPDATE trustee_connections SET is_sharing_enabled = $1 WHERE id = $2 AND (requester_id = $3 OR receiver_id = $3)`
	_, err := DB.Exec(query, enable, connectionId, userId)
	return err
}

// Location Ingestion
func StopUserTracking(userId string) error {
	query := `UPDATE users SET is_tracking_active = false WHERE id = $1`
	_, err := DB.Exec(query, userId)
	return err
}

func InsertLocation(lp *models.LocationPoint) error {
	query := `INSERT INTO location_history (time, user_id, latitude, longitude, accuracy_meters, battery_level, speed_mps, is_sos)
	          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
	_, err := DB.Exec(query, lp.Time, lp.UserID, lp.Latitude, lp.Longitude, lp.AccuracyMeters, lp.BatteryLevel, lp.SpeedMPS, lp.IsSOS)
	return err
}

// SOS Operations
func CreateSOSEvent(req models.TriggerSOSRequest) (*models.SOSEvent, error) {
	query := `INSERT INTO sos_events (user_id, trigger_type, status, initial_latitude, initial_longitude, battery_level)
	          VALUES ($1, $2, 'ACTIVE', $3, $4, $5)
	          RETURNING id, user_id, trigger_type, status, initial_latitude, initial_longitude, battery_level, started_at`
	row := DB.QueryRow(query, req.UserID, req.TriggerType, req.Latitude, req.Longitude, req.BatteryLevel)

	var evt models.SOSEvent
	err := row.Scan(&evt.ID, &evt.UserID, &evt.TriggerType, &evt.Status, &evt.InitialLatitude, &evt.InitialLongitude, &evt.BatteryLevel, &evt.StartedAt)
	if err != nil {
		return nil, err
	}
	return &evt, nil
}

func ResolveSOSEvent(sosId, userId string) error {
	query := `UPDATE sos_events SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`
	_, err := DB.Exec(query, sosId, userId)
	return err
}

func GetActiveSOSEvents() ([]models.SOSEvent, error) {
	query := `SELECT s.id, s.user_id, s.trigger_type, s.status, s.initial_latitude, s.initial_longitude, s.battery_level, s.started_at,
	                 u.full_name, u.phone_number
	          FROM sos_events s
	          JOIN users u ON s.user_id = u.id
	          WHERE s.status = 'ACTIVE'
	          ORDER BY s.started_at DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []models.SOSEvent
	for rows.Next() {
		var evt models.SOSEvent
		var fullName, phone string
		if err := rows.Scan(&evt.ID, &evt.UserID, &evt.TriggerType, &evt.Status, &evt.InitialLatitude, &evt.InitialLongitude, &evt.BatteryLevel, &evt.StartedAt, &fullName, &phone); err != nil {
			return nil, err
		}
		evt.User = &models.User{
			ID:          evt.UserID,
			FullName:    fullName,
			PhoneNumber: phone,
		}
		events = append(events, evt)
	}
	return events, nil
}

// SUPER-ADMIN Operations
func GetAllUsersForAdmin() ([]models.AdminUserView, error) {
	query := `SELECT u.id, COALESCE(u.user_code, 'UNASSIGNED'), u.email, u.phone_number, u.full_name, u.age, u.address, u.profile_completed, u.kyc_status, u.battery_level, u.is_tracking_active, u.created_at,
	                 (SELECT COUNT(*) FROM trustee_connections WHERE (requester_id = u.id OR receiver_id = u.id) AND status = 'ACCEPTED') as trustee_count
	          FROM users u
	          ORDER BY u.created_at DESC`
	rows, err := DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var adminList []models.AdminUserView
	for rows.Next() {
		var v models.AdminUserView
		if err := rows.Scan(&v.User.ID, &v.User.UserCode, &v.User.Email, &v.User.PhoneNumber, &v.User.FullName, &v.User.Age, &v.User.Address,
			&v.User.ProfileCompleted, &v.User.KYCStatus, &v.User.BatteryLevel, &v.User.IsTrackingActive, &v.User.CreatedAt, &v.TrusteeCount); err != nil {
			return nil, err
		}

		// Fetch latest known location point
		locQuery := `SELECT time, latitude, longitude, accuracy_meters, battery_level, speed_mps, is_sos FROM location_history WHERE user_id = $1 ORDER BY time DESC LIMIT 1`
		var lp models.LocationPoint
		if err := DB.QueryRow(locQuery, v.User.ID).Scan(&lp.Time, &lp.Latitude, &lp.Longitude, &lp.AccuracyMeters, &lp.BatteryLevel, &lp.SpeedMPS, &lp.IsSOS); err == nil {
			lp.UserID = v.User.ID
			v.LatestLocation = &lp
		}

		// Check if active SOS
		var sos models.SOSEvent
		sosQuery := `SELECT id, trigger_type, status, initial_latitude, initial_longitude, battery_level, started_at FROM sos_events WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1`
		if err := DB.QueryRow(sosQuery, v.User.ID).Scan(&sos.ID, &sos.TriggerType, &sos.Status, &sos.InitialLatitude, &sos.InitialLongitude, &sos.BatteryLevel, &sos.StartedAt); err == nil {
			sos.UserID = v.User.ID
			v.ActiveSOS = &sos
		}

		adminList = append(adminList, v)
	}
	return adminList, nil
}

func GetAdminStats() (*models.AdminStats, error) {
	var stats models.AdminStats
	DB.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&stats.TotalUsers)
	DB.QueryRow(`SELECT COUNT(*) FROM sos_events WHERE status = 'ACTIVE'`).Scan(&stats.ActiveSOSCount)
	DB.QueryRow(`SELECT COUNT(*) FROM users WHERE is_tracking_active = TRUE`).Scan(&stats.TrackingActive)
	return &stats, nil
}
