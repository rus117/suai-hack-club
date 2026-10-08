package main

import (
	"bytes"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"mime/multipart"
	"net/http/httptest"
	"testing"
	"time"
)

func TestProfileUpdatePersistenceAndValidation(t *testing.T) {
	a := testApp(t)
	c, csrf := loginTest(t, a, false)
	profile := map[string]any{"firstName": "Рустам", "lastName": "Соседов", "email": "neighbor@example.org", "course": 2, "age": 20, "faculty": "Институт №1", "about": "Баскетбол и ML"}
	if w := call(a, "POST", "profile", profile, c, csrf, a.origin); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	saved, err := newApp(a.file)
	if err != nil {
		t.Fatal(err)
	}
	u := saved.db.Users["demo:neighbor"]
	if u.Name != "Рустам Соседов" || u.Course != 2 || u.Age != 20 || u.About != "Баскетбол и ML" {
		t.Fatal("profile not persisted", u)
	}
	next := preserveProfile(User{ID: u.ID, Name: "Social Name", Email: "social@example.org"}, u)
	if next.Name != u.Name || next.Email != u.Email || next.Course != 2 {
		t.Fatal("social login erased edited profile")
	}
	for _, invalid := range []map[string]any{{"firstName": "X", "email": "bad address"}, {"firstName": "X", "course": 7}, {"firstName": "X", "age": 121}, {"firstName": "X", "id": "other"}} {
		if w := call(a, "POST", "profile", invalid, c, csrf, a.origin); w.Code != 400 {
			t.Fatal("invalid profile accepted", invalid, w.Code)
		}
	}
	if w := call(a, "POST", "profile", profile, c, "", a.origin); w.Code != 403 {
		t.Fatal("profile CSRF accepted")
	}
	if a.db.Users[u.ID].Name != u.Name {
		t.Fatal("rejected update changed profile")
	}
}

func TestVisitedArchiveIsPrivate(t *testing.T) {
	a := testApp(t)
	c, csrf := loginTest(t, a, false)
	call(a, "POST", "register", map[string]any{"eventId": "future", "cancel": false}, c, csrf, a.origin)
	a.db.Registrations[0].Attended = true
	a.db.Events[0].Date = time.Now().Add(-time.Hour).Format(time.RFC3339)
	w := call(a, "GET", "public", nil, nil, "", "")
	var public struct {
		Events []Event `json:"events"`
	}
	json.Unmarshal(w.Body.Bytes(), &public)
	if len(public.Events) != 0 {
		t.Fatal("public API exposes past events")
	}
	w = call(a, "GET", "me", nil, c, "", "")
	var personal struct {
		History []Event `json:"history"`
	}
	json.Unmarshal(w.Body.Bytes(), &personal)
	if len(personal.History) != 1 || personal.History[0].ID != "future" {
		t.Fatal("visited event missing")
	}
	a.db.Registrations[0].Attended = false
	w = call(a, "GET", "me", nil, c, "", "")
	json.Unmarshal(w.Body.Bytes(), &personal)
	if len(personal.History) != 0 {
		t.Fatal("unconfirmed event in visited archive")
	}
	w = call(a, "GET", "me", nil, nil, "", "")
	if bytes.Contains(w.Body.Bytes(), []byte("future")) {
		t.Fatal("private archive exposed anonymously")
	}
	r := httptest.NewRequest("GET", "http://localhost:8080/archive", nil)
	rec := httptest.NewRecorder()
	a.routes().ServeHTTP(rec, r)
	if rec.Code != 303 || rec.Header().Get("Location") != "/profile#visited" {
		t.Fatal("legacy public archive not redirected")
	}
}

func TestPhotoUploadNormalizationAndAccess(t *testing.T) {
	a := testApp(t)
	c, csrf := loginTest(t, a, false)
	img := image.NewRGBA(image.Rect(0, 0, 10, 20))
	img.Set(0, 0, color.RGBA{R: 255, A: 255})
	var original bytes.Buffer
	png.Encode(&original, img)
	upload := func(data []byte, csrf string) *httptest.ResponseRecorder {
		var body bytes.Buffer
		m := multipart.NewWriter(&body)
		f, _ := m.CreateFormFile("photo", "photo.png")
		f.Write(data)
		m.Close()
		r := httptest.NewRequest("POST", "http://localhost:8080/api/profile/photo", &body)
		r.AddCookie(c)
		r.Header.Set("Origin", a.origin)
		r.Header.Set("X-CSRF-Token", csrf)
		r.Header.Set("Content-Type", m.FormDataContentType())
		w := httptest.NewRecorder()
		a.routes().ServeHTTP(w, r)
		return w
	}
	if w := upload(original.Bytes(), ""); w.Code != 403 {
		t.Fatal("upload CSRF accepted")
	}
	if w := upload([]byte("<svg onload='alert(1)'/>"), csrf); w.Code != 400 {
		t.Fatal("non-raster image accepted")
	}
	if w := upload(original.Bytes(), csrf); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w := call(a, "GET", "profile/photo", nil, c, "", "")
	cfg, err := jpeg.DecodeConfig(bytes.NewReader(w.Body.Bytes()))
	if w.Code != 200 || err != nil || cfg.Width != 384 || cfg.Height != 384 {
		t.Fatal("photo not normalized", w.Code, err, cfg)
	}
	if w = call(a, "GET", "profile/photo?user=demo:neighbor", nil, nil, "", ""); w.Code != 403 {
		t.Fatal("anonymous photo access")
	}
	if w = call(a, "GET", "profile/photo?user=other", nil, c, "", ""); w.Code != 403 {
		t.Fatal("other user's photo access")
	}
	saved, err := newApp(a.file)
	if err != nil || saved.db.Users["demo:neighbor"].Avatar == "" {
		t.Fatal("photo reference not persisted", err)
	}
}
