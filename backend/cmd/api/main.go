package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/shikkandar/way-to-jannah/backend/internal/masjidscan"
)

func main() {
	scanner := masjidscan.New()
	appKey := os.Getenv("APP_KEY") // optional shared secret the app sends, so strangers can't spend our API credit

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// POST /api/masjid/scan — multipart form with an "image" file (photo of the timing board).
	mux.HandleFunc("POST /api/masjid/scan", func(w http.ResponseWriter, r *http.Request) {
		if appKey != "" && r.Header.Get("X-App-Key") != appKey {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, masjidscan.MaxImageBytes+1<<20)
		file, _, err := r.FormFile("image")
		if err != nil {
			writeError(w, http.StatusBadRequest, "send the photo as an \"image\" file (max 5 MB)")
			return
		}
		defer file.Close()

		img, err := io.ReadAll(io.LimitReader(file, masjidscan.MaxImageBytes+1))
		if err != nil {
			writeError(w, http.StatusBadRequest, "could not read the photo")
			return
		}
		if len(img) > masjidscan.MaxImageBytes {
			writeError(w, http.StatusRequestEntityTooLarge, "photo is larger than 5 MB")
			return
		}
		mediaType := http.DetectContentType(img)
		switch mediaType {
		case "image/jpeg", "image/png", "image/webp":
		default:
			writeError(w, http.StatusUnsupportedMediaType, "photo must be JPEG, PNG or WebP")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Minute)
		defer cancel()
		result, err := scanner.Scan(ctx, img, mediaType)
		switch {
		case errors.Is(err, masjidscan.ErrUnreadable):
			writeError(w, http.StatusUnprocessableEntity, "couldn't find prayer times in this photo — try a clearer, straight-on photo of the board")
		case err != nil:
			log.Printf("masjid scan failed: %v", err)
			writeError(w, http.StatusBadGateway, "scan failed, please try again")
		default:
			writeJSON(w, http.StatusOK, result)
		}
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("api listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, withCORS(mux)))
}

// The Expo web preview runs on another origin; the native app doesn't need CORS.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-App-Key")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
