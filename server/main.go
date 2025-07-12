package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

func withCORS(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		handler(w, r)
	}
}

type Coord struct {
	X int
	Y int
}

var (
	board   = make(map[Coord]bool)
	boardMu = &sync.RWMutex{}
)

func nextGeneration(current map[Coord]bool) map[Coord]bool {
	neighborCounts := make(map[Coord]int)
	for cell := range current {
		for dx := -1; dx <= 1; dx++ {
			for dy := -1; dy <= 1; dy++ {
				if dx == 0 && dy == 0 {
					continue
				}
				n := Coord{X: cell.X + dx, Y: cell.Y + dy}
				neighborCounts[n]++
			}
		}
	}
	next := make(map[Coord]bool)
	const minCoord, maxCoord = 0, 999 // gridSize = 1000
	for cell, count := range neighborCounts {
		if cell.X < minCoord || cell.X > maxCoord || cell.Y < minCoord || cell.Y > maxCoord {
			continue // out-of-bounds cells die
		}
		if count == 3 || (count == 2 && current[cell]) {
			next[cell] = true
		}
	}
	return next
}

func main() {
	go func() {
		for {
			time.Sleep(500 * time.Millisecond)
			boardMu.Lock()
			board = nextGeneration(board)
			boardMu.Unlock()
		}
	}()
	http.HandleFunc("/ws", withCORS(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			fmt.Println("WebSocket upgrade error:", err)
			return
		}
		defer conn.Close()
		for {
			// Prepare a slice of active cells
			boardMu.RLock()
			active := make([]Coord, 0, len(board))
			for k := range board {
				active = append(active, k)
			}
			boardMu.RUnlock()
			// Send as JSON
			if err := conn.WriteJSON(active); err != nil {
				fmt.Println("WebSocket write error:", err)
				return
			}
			time.Sleep(100 * time.Millisecond)
		}
	}))
	http.HandleFunc("/cell", withCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var payload struct {
			Cells []Coord `json:"cells"`
		}
		err := json.NewDecoder(r.Body).Decode(&payload)
		if err != nil || len(payload.Cells) == 0 {
			http.Error(w, "Invalid JSON or no cells provided", http.StatusBadRequest)
			return
		}
		const minCoord, maxCoord = 0, 999 // gridSize = 1000
		added := 0
		boardMu.Lock()
		for _, cell := range payload.Cells {
			if cell.X >= minCoord && cell.X <= maxCoord && cell.Y >= minCoord && cell.Y <= maxCoord {
				board[Coord{X: cell.X, Y: cell.Y}] = true
				fmt.Printf("Received cell: x=%d, y=%d\n", cell.X, cell.Y)
				added++
			} else {
				fmt.Printf("Ignored out-of-bounds cell: x=%d, y=%d\n", cell.X, cell.Y)
			}
		}
		boardMu.Unlock()
		fmt.Fprintf(w, "Received %d cells (in bounds)", added)
	}))
	fmt.Println("Starting server on :8080")
	http.ListenAndServe(":8080", nil)
}
