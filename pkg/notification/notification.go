package notification

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"women-safety-app/pkg/db"
)

// SendPushNotification sends an Expo Push notification
func SendPushNotification(token, title, body string, data map[string]string) error {
	if token == "" {
		return nil // silently ignore empty tokens
	}

	payload := map[string]interface{}{
		"to":    token,
		"title": title,
		"body":  body,
		"data":  data,
		"sound": "default",
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", "https://exp.host/--/api/v2/push/send", bytes.NewBuffer(jsonData))
	if err != nil {
		return err
	}

	req.Header.Set("Accept", "application/json")
	req.Header.Set("Accept-encoding", "gzip, deflate")
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
