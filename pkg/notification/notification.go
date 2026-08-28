package notification

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"women-safety-app/pkg/db"
)

// SendPushNotification sends an FCM notification using the legacy HTTP API
// Note: Google is deprecating the legacy API in favor of FCM HTTP v1,
// but for simplicity and since the user only has a Server Key currently,
// we will use the legacy API. If it fails, they will need to upgrade to v1.
func SendPushNotification(token, title, body string, data map[string]string) error {
	serverKey := os.Getenv("FCM_SERVER_KEY")
	if serverKey == "" {
		log.Println("⚠️ FCM_SERVER_KEY not set. Skipping push notification.")
		return nil
	}
	if token == "" {
		return nil // silently ignore empty tokens
	}

	payload := map[string]interface{}{
		"to": token,
		"notification": map[string]string{
			"title": title,
			"body":  body,
		},
		"data": data,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "https://fcm.googleapis.com/fcm/send", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Authorization", "key="+serverKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send fcm request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("FCM returned non-200 status: %d", resp.StatusCode)
	}

	return nil
}

// NotifyGuardians sends a push notification to all connected guardians of a user
func NotifyGuardians(userId, title, body string, data map[string]string) {
	tokens, err := db.GetGuardianFCMTokens(userId)
	if err != nil {
		log.Printf("Error getting guardian tokens for %s: %v", userId, err)
		return
	}

	for _, token := range tokens {
		err := SendPushNotification(token, title, body, data)
		if err != nil {
			log.Printf("Failed to push to %s: %v", token, err)
		}
	}
}
