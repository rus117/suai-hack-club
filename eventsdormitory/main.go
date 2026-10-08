package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Event struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Date     string `json:"date"`
	Category string `json:"category"`
	Place    string `json:"place"`
	Intro    string `json:"intro"`
	Body     string `json:"body"`
	Image    string `json:"image"`
	Draft    bool   `json:"draft"`
}
type Article struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Category string `json:"category"`
	Intro    string `json:"intro"`
	Body     string `json:"body"`
	Image    string `json:"image"`
	Draft    bool   `json:"draft"`
}
type User struct {
	ID             string          `json:"id"`
	Name           string          `json:"name"`
	Provider       string          `json:"provider"`
	Email          string          `json:"email,omitempty"`
	Username       string          `json:"username,omitempty"`
	Joined         string          `json:"joined"`
	Actions        map[string]bool `json:"actions"`
	FirstName      string          `json:"firstName,omitempty"`
	LastName       string          `json:"lastName,omitempty"`
	Course         int             `json:"course,omitempty"`
	Age            int             `json:"age,omitempty"`
	Faculty        string          `json:"faculty,omitempty"`
	About          string          `json:"about,omitempty"`
	Avatar         string          `json:"avatar,omitempty"`
	ProfileUpdated bool            `json:"profileUpdated,omitempty"`
}
type Registration struct {
	UserID   string `json:"userId"`
	EventID  string `json:"eventId"`
	Attended bool   `json:"attended"`
	Created  string `json:"created"`
}
type Database struct {
	Events        []Event         `json:"events"`
	Articles      []Article       `json:"articles"`
	Users         map[string]User `json:"users"`
	Registrations []Registration  `json:"registrations"`
}
type Session struct {
	UserID  string
	Admin   bool
	Expires time.Time
	CSRF    string
}
type App struct {
	mu                       sync.Mutex
	db                       Database
	sessions                 map[string]Session
	flows                    map[string]Flow
	file, origin, adminToken string
	demo                     bool
	client                   *http.Client
	limits                   map[string]Bucket
}

type Bucket struct {
	Count int
	Until time.Time
}

func (a *App) allow(r *http.Request) bool {
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	key := host + ":" + r.URL.Path
	limit := 300
	if strings.HasPrefix(r.URL.Path, "/auth/") || r.URL.Path == "/api/demo/login" {
		limit = 20
	}
	if r.URL.Path == "/api/admin/login" {
		limit = 5
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.limits == nil {
		a.limits = map[string]Bucket{}
	}
	for k, b := range a.limits {
		if time.Now().After(b.Until) {
			delete(a.limits, k)
		}
	}
	b := a.limits[key]
	if b.Until.IsZero() {
		b.Until = time.Now().Add(time.Minute)
	}
	b.Count++
	a.limits[key] = b
	return b.Count <= limit
}

func token() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func env(k, d string) string {
	if s := os.Getenv(k); s != "" {
		return s
	}
	return d
}
func newApp(file string) (*App, error) {
	a := &App{file: file, origin: strings.TrimRight(env("BASE_URL", "http://localhost:8080"), "/"), adminToken: os.Getenv("ADMIN_TOKEN"), demo: os.Getenv("DEMO_MODE") == "true", sessions: map[string]Session{}, flows: map[string]Flow{}, client: &http.Client{Timeout: 15 * time.Second}}
	b, err := os.ReadFile(file)
	if errors.Is(err, os.ErrNotExist) {
		a.db = seed()
		return a, nil
	}
	if err != nil {
		return nil, err
	}
	err = json.Unmarshal(b, &a.db)
	if a.db.Users == nil {
		a.db.Users = map[string]User{}
	}
	return a, err
}

// Called with mu held. Write a complete snapshot before publishing the mutation.
func (a *App) save() error {
	if err := os.MkdirAll(filepath.Dir(a.file), 0700); err != nil {
		return err
	}
	b, err := json.MarshalIndent(a.db, "", "  ")
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(a.file), "snapshot-*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	if err = f.Chmod(0600); err == nil {
		_, err = f.Write(b)
	}
	if err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(name, a.file)
}
func (a *App) mutate(fn func()) error {
	old, _ := json.Marshal(a.db)
	fn()
	if err := a.save(); err != nil {
		json.Unmarshal(old, &a.db)
		return err
	}
	return nil
}
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, msg string) {
	respond(w, status, map[string]string{"error": msg})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 128<<10)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(v) != nil {
		fail(w, 400, "Проверьте заполненные поля")
		return false
	}
	if d.Decode(&struct{}{}) != io.EOF {
		fail(w, 400, "Некорректный запрос")
		return false
	}
	return true
}
func (a *App) session(r *http.Request) (Session, bool) {
	c, e := r.Cookie("dorm_session")
	if e != nil {
		return Session{}, false
	}
	s, ok := a.sessions[c.Value]
	if !ok || time.Now().After(s.Expires) {
		delete(a.sessions, c.Value)
		return Session{}, false
	}
	return s, true
}
func (a *App) issue(w http.ResponseWriter, user string, admin bool) {
	for k, s := range a.sessions {
		if time.Now().After(s.Expires) {
			delete(a.sessions, k)
		}
	}
	key := token()
	a.sessions[key] = Session{user, admin, time.Now().Add(7 * 24 * time.Hour), token()}
	http.SetCookie(w, &http.Cookie{Name: "dorm_session", Value: key, Path: "/", HttpOnly: true, Secure: strings.HasPrefix(a.origin, "https://"), SameSite: http.SameSiteLaxMode, MaxAge: 604800})
}
func (a *App) routes() http.Handler {
	m := http.NewServeMux()
	m.HandleFunc("/api/", a.api)
	m.HandleFunc("/auth/", a.auth)
	m.Handle("/assets/", http.StripPrefix("/assets/", http.FileServer(http.Dir("web/assets"))))
	m.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			http.Error(w, "Method not allowed", 405)
			return
		}
		if r.URL.Path == "/style.css" || r.URL.Path == "/zones.css" || r.URL.Path == "/app.js" || r.URL.Path == "/calendar.js" {
			http.ServeFile(w, r, "web"+r.URL.Path)
			return
		}
		if r.URL.Path == "/archive" {
			http.Redirect(w, r, "/profile#visited", http.StatusSeeOther)
			return
		}
		if r.URL.Path == "/healthz" {
			w.Write([]byte("ok"))
			return
		}
		if r.URL.Path == "/robots.txt" {
			w.Write([]byte("User-agent: *\nDisallow: /admin\nDisallow: /profile\nDisallow: /roof/quiet-hour\n"))
			return
		}
		http.ServeFile(w, r, "web/index.html")
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/auth/") {
			if !a.allow(r) {
				w.Header().Set("Retry-After", "60")
				fail(w, 429, "Слишком много запросов. Попробуйте через минуту.")
				return
			}
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
		}
		m.ServeHTTP(w, r)
	})
}
func (a *App) api(w http.ResponseWriter, r *http.Request) {
	a.mu.Lock()
	defer a.mu.Unlock()
	s, logged := a.session(r)
	p := strings.TrimPrefix(r.URL.Path, "/api/")
	if r.Method != "GET" {
		if r.Header.Get("Origin") != a.origin {
			fail(w, 403, "Источник запроса не разрешён")
			return
		}
		if p != "admin/login" && p != "demo/login" && (!logged || r.Header.Get("X-CSRF-Token") != s.CSRF) {
			fail(w, 403, "Обновите страницу и войдите снова")
			return
		}
	}
	switch {
	case p == "public" && r.Method == "GET":
		events := []Event{}
		articles := []Article{}
		for _, e := range a.db.Events {
			date, err := time.Parse(time.RFC3339, e.Date)
			if !e.Draft && err == nil && date.After(time.Now()) {
				events = append(events, e)
			}
		}
		for _, b := range a.db.Articles {
			if !b.Draft {
				articles = append(articles, b)
			}
		}
		respond(w, 200, map[string]any{"events": events, "articles": articles, "auth": map[string]bool{"telegram": os.Getenv("TG_CLIENT_ID") != "" && os.Getenv("TG_CLIENT_SECRET") != "", "vk": os.Getenv("VK_CLIENT_ID") != "", "demo": a.demo}})
	case p == "me" && r.Method == "GET":
		if !logged {
			respond(w, 200, map[string]any{"user": nil})
			return
		}
		regs := []Registration{}
		for _, v := range a.db.Registrations {
			if v.UserID == s.UserID {
				regs = append(regs, v)
			}
		}
		var u any
		if x, ok := a.db.Users[s.UserID]; ok {
			u = x
		}
		history := []Event{}
		for _, reg := range regs {
			if !reg.Attended {
				continue
			}
			for _, e := range a.db.Events {
				date, err := time.Parse(time.RFC3339, e.Date)
				if e.ID == reg.EventID && err == nil && !date.After(time.Now()) {
					history = append(history, e)
				}
			}
		}
		respond(w, 200, map[string]any{"user": u, "admin": s.Admin, "csrf": s.CSRF, "registrations": regs, "history": history})
	case p == "profile" && r.Method == "POST":
		if s.UserID == "" {
			fail(w, 401, "Сначала войдите в профиль")
			return
		}
		a.updateProfile(w, r, s.UserID)
	case p == "profile/photo" && (r.Method == "GET" || r.Method == "POST"):
		a.profilePhoto(w, r, s)
	case p == "demo/login" && r.Method == "POST":
		if !a.demo {
			fail(w, 404, "Демонстрационный вход выключен")
			return
		}
		id := "demo:neighbor"
		if _, ok := a.db.Users[id]; !ok {
			if a.mutate(func() {
				a.db.Users[id] = User{ID: id, Name: "Сосед по общежитию", Provider: "demo", Joined: time.Now().Format(time.RFC3339), Actions: map[string]bool{}}
			}) != nil {
				fail(w, 500, "Не удалось сохранить профиль")
				return
			}
		}
		a.issue(w, id, false)
		respond(w, 200, map[string]bool{"ok": true})
	case p == "admin/login" && r.Method == "POST":
		var b struct {
			Token string `json:"token"`
		}
		if !decode(w, r, &b) {
			return
		}
		if a.adminToken == "" || !equalSecret(a.adminToken, b.Token) {
			fail(w, 401, "Неверный ключ администратора")
			return
		}
		a.issue(w, "", true)
		respond(w, 200, map[string]bool{"ok": true})
	case p == "logout" && r.Method == "POST":
		if c, e := r.Cookie("dorm_session"); e == nil {
			delete(a.sessions, c.Value)
		}
		http.SetCookie(w, &http.Cookie{Name: "dorm_session", Path: "/", MaxAge: -1, HttpOnly: true})
		respond(w, 200, map[string]bool{"ok": true})
	case p == "register" && r.Method == "POST":
		if s.UserID == "" {
			fail(w, 401, "Войдите через Telegram или VK")
			return
		}
		var b struct {
			EventID string `json:"eventId"`
			Cancel  bool   `json:"cancel"`
		}
		if !decode(w, r, &b) {
			return
		}
		valid := false
		for _, e := range a.db.Events {
			if e.ID == b.EventID && !e.Draft {
				t, err := time.Parse(time.RFC3339, e.Date)
				valid = err == nil && t.After(time.Now())
			}
		}
		if !valid {
			fail(w, 400, "Запись на это событие закрыта")
			return
		}
		if b.Cancel {
			for _, v := range a.db.Registrations {
				if v.UserID == s.UserID && v.EventID == b.EventID && v.Attended {
					fail(w, 409, "Посещение уже подтверждено. Если отметка ошибочна, напишите организатору.")
					return
				}
			}
		}
		err := a.mutate(func() {
			out := []Registration{}
			found := false
			for _, v := range a.db.Registrations {
				if v.UserID == s.UserID && v.EventID == b.EventID {
					found = true
					if !b.Cancel || v.Attended {
						out = append(out, v)
					}
				} else {
					out = append(out, v)
				}
			}
			if !found && !b.Cancel {
				out = append(out, Registration{s.UserID, b.EventID, false, time.Now().Format(time.RFC3339)})
			}
			a.db.Registrations = out
		})
		if err != nil {
			fail(w, 500, "Не удалось сохранить запись")
			return
		}
		respond(w, 200, map[string]bool{"ok": true})
	case p == "action" && r.Method == "POST":
		if s.UserID == "" {
			fail(w, 401, "Сначала войдите")
			return
		}
		var b struct {
			Action string `json:"action"`
		}
		if !decode(w, r, &b) {
			return
		}
		if b.Action != "read" && b.Action != "roof" {
			fail(w, 400, "Неизвестное действие")
			return
		}
		if a.mutate(func() {
			u := a.db.Users[s.UserID]
			if u.Actions == nil {
				u.Actions = map[string]bool{}
			}
			u.Actions[b.Action] = true
			a.db.Users[s.UserID] = u
		}) != nil {
			fail(w, 500, "Не удалось сохранить достижение")
			return
		}
		respond(w, 200, map[string]bool{"ok": true})
	case strings.HasPrefix(p, "admin/"):
		if !s.Admin {
			fail(w, 403, "Требуется вход администратора")
			return
		}
		a.admin(w, r, strings.TrimPrefix(p, "admin/"))
	default:
		fail(w, 404, "Не найдено")
	}
}
func validID(id string) bool {
	if len(id) < 1 || len(id) > 80 {
		return false
	}
	for _, c := range id {
		if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '-') {
			return false
		}
	}
	return true
}
func validImage(s string) bool {
	return strings.HasPrefix(s, "/assets/") && !strings.Contains(s, "..") && len(s) < 200
}
func (a *App) admin(w http.ResponseWriter, r *http.Request, p string) {
	switch {
	case p == "data" && r.Method == "GET":
		respond(w, 200, a.db)
	case p == "event" && r.Method == "POST":
		var e Event
		if !decode(w, r, &e) {
			return
		}
		_, err := time.Parse(time.RFC3339, e.Date)
		if !validID(e.ID) || strings.TrimSpace(e.Title) == "" || err != nil || !validImage(e.Image) {
			fail(w, 400, "Нужны ID, название, корректная дата и путь /assets/…")
			return
		}
		if a.mutate(func() {
			for i, v := range a.db.Events {
				if v.ID == e.ID {
					a.db.Events[i] = e
					return
				}
			}
			a.db.Events = append(a.db.Events, e)
		}) != nil {
			fail(w, 500, "Не удалось сохранить событие")
			return
		}
		respond(w, 200, map[string]bool{"ok": true})
	case p == "article" && r.Method == "POST":
		var b Article
		if !decode(w, r, &b) {
			return
		}
		if !validID(b.ID) || strings.TrimSpace(b.Title) == "" || !validImage(b.Image) {
			fail(w, 400, "Нужны ID, название и путь /assets/…")
			return
		}
		if a.mutate(func() {
			for i, v := range a.db.Articles {
				if v.ID == b.ID {
					a.db.Articles[i] = b
					return
				}
			}
			a.db.Articles = append(a.db.Articles, b)
		}) != nil {
			fail(w, 500, "Не удалось сохранить статью")
			return
		}
		respond(w, 200, map[string]bool{"ok": true})
	case p == "attendance" && r.Method == "POST":
		var b struct {
			UserID   string `json:"userId"`
			EventID  string `json:"eventId"`
			Attended bool   `json:"attended"`
		}
		if !decode(w, r, &b) {
			return
		}
		found := false
		for _, v := range a.db.Registrations {
			if v.UserID == b.UserID && v.EventID == b.EventID {
				found = true
			}
		}
		if !found {
			fail(w, 404, "Участник не записан")
			return
		}
		if a.mutate(func() {
			for i, v := range a.db.Registrations {
				if v.UserID == b.UserID && v.EventID == b.EventID {
					a.db.Registrations[i].Attended = b.Attended
				}
			}
		}) != nil {
			fail(w, 500, "Не удалось сохранить отметку")
			return
		}
		respond(w, 200, map[string]bool{"ok": true})
	default:
		fail(w, 404, "Не найдено")
	}
}
func main() {
	a, err := newApp(env("DATA_FILE", "data/dormitory.json"))
	if err != nil {
		log.Fatal(err)
	}
	u, err := url.Parse(a.origin)
	if err != nil || u.Host == "" {
		log.Fatal("BASE_URL must be an absolute URL")
	}
	if !strings.HasPrefix(a.origin, "https://") && u.Hostname() != "localhost" && u.Hostname() != "127.0.0.1" {
		log.Fatal("Use HTTPS for a public BASE_URL")
	}
	if a.demo && u.Hostname() != "localhost" && u.Hostname() != "127.0.0.1" {
		log.Fatal("DEMO_MODE is only allowed on localhost")
	}
	srv := &http.Server{Addr: env("ADDR", "127.0.0.1:8080"), Handler: a.routes(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second}
	log.Printf("EventsDormitory: %s", a.origin)
	log.Fatal(srv.ListenAndServe())
}
