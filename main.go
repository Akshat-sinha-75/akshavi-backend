package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"women-safety-app/pkg/api"
	"women-safety-app/pkg/cache"
	"women-safety-app/pkg/db"
	"women-safety-app/pkg/ws"
)

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

// Global CORS Middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	log.Println("🚀 Starting Women Safety App Platform...")

	// 1. Initialize Database
	dbHost := getEnv("DB_HOST", "postgres")
	dbPort := getEnv("DB_PORT", "5432")
	dbUser := getEnv("DB_USER", "postgres")
	dbPass := getEnv("DB_PASSWORD", "secure_db_pass_123")
	dbName := getEnv("DB_NAME", "women_safety")

	_, err := db.InitDB(dbHost, dbPort, dbUser, dbPass, dbName)
	if err != nil {
		log.Printf("⚠️ Warning: Database initialization error: %v", err)
	}

	// 2. Initialize Redis
	redisHost := getEnv("REDIS_HOST", "redis")
	redisPort := getEnv("REDIS_PORT", "6379")

	_, err = cache.InitRedis(redisHost, redisPort)
	if err != nil {
		log.Printf("⚠️ Warning: Redis initialization error: %v", err)
	}

	// 3. Initialize WebSocket Hub
	ws.GlobalHub = ws.NewHub()
	go ws.GlobalHub.Run()

	// 4. Setup Routes
	mux := http.NewServeMux()

	// Health Check
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		dbStatus := "down"
		if db.DB != nil && db.DB.Ping() == nil {
			dbStatus = "healthy"
		}
		redisStatus := "down"
		if cache.RDB != nil && cache.RDB.Ping(cache.Ctx).Err() == nil {
			redisStatus = "healthy"
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "ok",
			"timestamp": time.Now().UTC(),
			"services": map[string]string{
				"database": dbStatus,
				"redis":    redisStatus,
			},
		})
	})

	// WebSocket Endpoint
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		ws.ServeWS(ws.GlobalHub, w, r)
	})

	// 1. Auth & Profiles
	mux.HandleFunc("/api/auth/otp/request", api.RequestOTPHandler)
	mux.HandleFunc("/api/auth/login", api.LoginHandler)
	mux.HandleFunc("/api/auth/register", api.RegisterHandler)
	mux.HandleFunc("/api/auth/profile-setup", api.ProfileSetupHandler)

	// User Profile Management
	mux.HandleFunc("/api/users/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodDelete {
			api.DeleteUserHandler(w, r)
		} else if r.Method == http.MethodPut {
			api.UpdateUserHandler(w, r)
		} else {
			http.NotFound(w, r)
		}
	})

	// 2. Trustee Pairing & Granular Sharing
	mux.HandleFunc("/api/trustees/request", api.SendTrusteeRequestHandler)
	mux.HandleFunc("/api/trustees/requests", api.GetPendingRequestsHandler)
	mux.HandleFunc("/api/trustees/respond", api.RespondTrusteeRequestHandler)
	mux.HandleFunc("/api/trustees/my-list", api.GetMyTrusteesHandler)
	mux.HandleFunc("/api/trustees/wards/active", api.GetActiveWardsHandler)
	mux.HandleFunc("/api/trustees/toggle-sharing", api.ToggleSharingHandler)

	// 3. Location Ingest & Real-Time Tracking
	mux.HandleFunc("/api/location/track", api.TrackLocationHandler)
	mux.HandleFunc("/api/location/history/", api.LocationHistoryHandler)
	mux.HandleFunc("/api/location/trail/", api.GetLiveTrailHandler)
	mux.HandleFunc("/api/location/stop/", api.StopTrackingHandler)

	// 4. Emergency SOS Handlers
	mux.HandleFunc("/api/sos/trigger", api.TriggerSOSHandler)
	mux.HandleFunc("/api/sos/resolve", api.ResolveSOSHandler)
	mux.HandleFunc("/api/sos/active", api.GetActiveSOSHandler)

	// 5. Super-Admin Portal APIs
	mux.HandleFunc("/api/admin/login", api.AdminLoginHandler)
	mux.HandleFunc("/api/admin/users", api.AdminGetUsersHandler)
	mux.HandleFunc("/api/admin/stats", api.AdminGetStatsHandler)
	mux.HandleFunc("/api/admin/sos/resolve", api.AdminResolveSOSHandler)

	// Static Web Client & Admin Dashboard
	fileServer := http.FileServer(http.Dir("./web"))
	mux.Handle("/", fileServer)

	// Start HTTP Server with CORS
	port := getEnv("PORT", "8080")
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      corsMiddleware(mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("🌐 Server listening on http://0.0.0.0:%s", port)
		log.Printf("👑 Super-Admin Portal at http://localhost:%s/admin.html", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down server gracefully...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced shutdown: %v", err)
	}
	log.Println("👋 Server exited.")
}
