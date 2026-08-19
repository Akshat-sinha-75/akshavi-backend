package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"women-safety-app/pkg/models"
)

var RDB *redis.Client
var Ctx = context.Background()

func InitRedis(host, port string) (*redis.Client, error) {
	RDB = redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%s", host, port),
		Password:     "",
		DB:           0,
		DialTimeout:  3 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	if err := RDB.Ping(Ctx).Err(); err != nil {
		return nil, fmt.Errorf("redis ping failed: %w", err)
	}

	log.Println("✅ Redis cache connection established")
	return RDB, nil
}

// SOS State Caching
func SetActiveSOS(evt *models.SOSEvent) error {
	data, err := json.Marshal(evt)
	if err != nil {
		return err
	}
	key := fmt.Sprintf("sos:active:%s", evt.UserID)
	// Active SOS persists until resolved, expires after 24h as safety cleanup
	return RDB.Set(Ctx, key, data, 24*time.Hour).Err()
}

func ClearActiveSOS(userId string) error {
	key := fmt.Sprintf("sos:active:%s", userId)
	return RDB.Del(Ctx, key).Err()
}

func GetActiveSOS(userId string) (*models.SOSEvent, error) {
	key := fmt.Sprintf("sos:active:%s", userId)
	val, err := RDB.Get(Ctx, key).Result()
	if err != nil {
		return nil, err
	}
	var evt models.SOSEvent
	if err := json.Unmarshal([]byte(val), &evt); err != nil {
		return nil, err
	}
	return &evt, nil
}

// Latest Location Caching (for sub-millisecond retrieval)
func SetLatestLocation(lp *models.LocationPoint) error {
	data, err := json.Marshal(lp)
	if err != nil {
		return err
	}
	key := fmt.Sprintf("loc:latest:%s", lp.UserID)
	return RDB.Set(Ctx, key, data, 24*time.Hour).Err()
}

func GetLatestLocation(userId string) (*models.LocationPoint, error) {
	key := fmt.Sprintf("loc:latest:%s", userId)
	val, err := RDB.Get(Ctx, key).Result()
	if err != nil {
		return nil, err
	}
	var lp models.LocationPoint
	if err := json.Unmarshal([]byte(val), &lp); err != nil {
		return nil, err
	}
	return &lp, nil
}

// OTP Caching
func StoreOTP(identifier string, otp string) error {
	key := fmt.Sprintf("otp:%s", identifier)
	// OTP expires in 5 minutes
	return RDB.Set(Ctx, key, otp, 5*time.Minute).Err()
}

func VerifyOTP(identifier string, otp string) bool {
	key := fmt.Sprintf("otp:%s", identifier)
	val, err := RDB.Get(Ctx, key).Result()
	if err != nil {
		return false
	}
	if val == otp {
		// Delete OTP after successful verification
		RDB.Del(Ctx, key)
		return true
	}
	return false
}
