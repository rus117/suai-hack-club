package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"
)

func testApp(t *testing.T) *App {
	t.Helper()
	t.Setenv("BASE_URL", "http://localhost:8080")
	a, err := newApp(filepath.Join(t.TempDir(), "state.json"))
	if err != nil {
		t.Fatal(err)
	}
	a.demo = true
	a.adminToken = "test-admin-key-long-enough"
	a.db.Events = []Event{{ID: "future", Title: "Future", Date: time.Now().Add(time.Hour).Format(time.RFC3339), Image: "/assets/ml.webp"}, {ID: "past", Title: "Past", Date: time.Now().Add(-time.Hour).Format(time.RFC3339), Image: "/assets/ml.webp"}, {ID: "draft", Title: "Draft", Date: time.Now().Add(time.Hour).Format(time.RFC3339), Image: "/assets/ml.webp", Draft: true}}
	return a
}
func call(a *App, method, path string, body any, cookie *http.Cookie, csrf, origin string) *httptest.ResponseRecorder {
	b, _ := json.Marshal(body)
	r := httptest.NewRequest(method, "http://localhost:8080/api/"+path, bytes.NewReader(b))
	r.Header.Set("Origin", origin)
	r.Header.Set("X-CSRF-Token", csrf)
	if cookie != nil {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	return w
}
func loginTest(t *testing.T, a *App, admin bool) (*http.Cookie, string) {
	t.Helper()
	path := "demo/login"
	var body any = map[string]string{}
	if admin {
		path = "admin/login"
		body = map[string]string{"token": a.adminToken}
	}
	w := call(a, "POST", path, body, nil, "", a.origin)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	c := w.Result().Cookies()[0]
	return c, a.sessions[c.Value].CSRF
}
func TestRegistrationLifecycleAndPersistence(t *testing.T) {
	a := testApp(t)
	c, csrf := loginTest(t, a, false)
	b := map[string]any{"eventId": "future", "cancel": false}
	for i := 0; i < 2; i++ {
		w := call(a, "POST", "register", b, c, csrf, a.origin)
		if w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	if len(a.db.Registrations) != 1 {
		t.Fatal("duplicate registration")
	}
	reloaded, err := newApp(a.file)
	if err != nil || len(reloaded.db.Registrations) != 1 {
		t.Fatal("not durable", err)
	}
	admin, ac := loginTest(t, a, true)
	w := call(a, "POST", "admin/attendance", map[string]any{"eventId": "future", "userId": "demo:neighbor", "attended": true}, admin, ac, a.origin)
	if w.Code != 200 || !a.db.Registrations[0].Attended {
		t.Fatal("attendance not saved")
	}
	if w := call(a, "POST", "register", map[string]any{"eventId": "future", "cancel": true}, c, csrf, a.origin); w.Code != 409 {
		t.Fatal("confirmed attendance cancellation reported success")
	}
	w = call(a, "POST", "admin/attendance", map[string]any{"eventId": "future", "userId": "demo:neighbor", "attended": false}, admin, ac, a.origin)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	b["cancel"] = true
	w = call(a, "POST", "register", b, c, csrf, a.origin)
	if w.Code != 200 || len(a.db.Registrations) != 0 {
		t.Fatal("cancel failed")
	}
	b["eventId"] = "past"
	b["cancel"] = false
	if w := call(a, "POST", "register", b, c, csrf, a.origin); w.Code != 400 {
		t.Fatal("past event accepts registrations")
	}
	b["eventId"] = "draft"
	if w := call(a, "POST", "register", b, c, csrf, a.origin); w.Code != 400 {
		t.Fatal("draft accepts registrations")
	}
}
func TestAccessAndCSRF(t *testing.T) {
	a := testApp(t)
	c, csrf := loginTest(t, a, false)
	if w := call(a, "GET", "admin/data", nil, c, "", a.origin); w.Code != 403 {
		t.Fatal("participant sees admin data")
	}
	for _, v := range []struct{ csrf, origin string }{{"", a.origin}, {csrf, "https://attacker.invalid"}} {
		if w := call(a, "POST", "action", map[string]string{"action": "roof"}, c, v.csrf, v.origin); w.Code != 403 {
			t.Fatal("CSRF accepted")
		}
	}
	w := call(a, "GET", "public", nil, nil, "", "")
	var out struct {
		Events []Event `json:"events"`
	}
	json.Unmarshal(w.Body.Bytes(), &out)
	for _, e := range out.Events {
		if e.Draft {
			t.Fatal("draft exposed")
		}
	}
	w = call(a, "GET", "me", nil, nil, "", "")
	if bytes.Contains(w.Body.Bytes(), []byte("neighbor")) {
		t.Fatal("profile exposed")
	}
	a.demo = false
	if w = call(a, "POST", "demo/login", map[string]string{}, nil, "", a.origin); w.Code != 404 {
		t.Fatal("demo bypass")
	}
}
func TestAdminEditAndFailedSaveRollback(t *testing.T) {
	a := testApp(t)
	c, csrf := loginTest(t, a, true)
	e := Event{ID: "new-event", Title: "New", Date: time.Now().Add(time.Hour).Format(time.RFC3339), Image: "/assets/ml.webp", Draft: true}
	w := call(a, "POST", "admin/event", e, c, csrf, a.origin)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	e.Title = "Changed"
	w = call(a, "POST", "admin/event", e, c, csrf, a.origin)
	if w.Code != 200 || len(a.db.Events) != 4 || a.db.Events[3].Title != "Changed" {
		t.Fatal("editing created duplicate")
	}
	old := a.db.Events[3].Title
	a.file = filepath.Join(a.file, "impossible-child.json")
	e.Title = "Unsaved"
	w = call(a, "POST", "admin/event", e, c, csrf, a.origin)
	if w.Code != 500 || a.db.Events[3].Title != old {
		t.Fatal("failed write was exposed")
	}
}
func TestForgedTelegramTokenAndOAuthState(t *testing.T) {
	a := testApp(t)
	if _, err := a.telegramUser("e30.e30.fake", "123"); err == nil {
		t.Fatal("forged token accepted")
	}
	t.Setenv("TG_CLIENT_ID", "123")
	t.Setenv("TG_CLIENT_SECRET", "test")
	r := httptest.NewRequest("GET", "http://localhost:8080/auth/telegram/callback?code=fake&state=unknown", nil)
	w := httptest.NewRecorder()
	a.routes().ServeHTTP(w, r)
	if w.Code != 303 || w.Header().Get("Location") != "/login?error=expired" {
		t.Fatal("invalid OAuth state accepted")
	}
}
