package main

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/mail"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf8"
)

// User-entered details survive a subsequent social login.
func preserveProfile(next, old User) User {
	next.Joined = old.Joined
	next.Actions = old.Actions
	next.Avatar = old.Avatar
	next.Course = old.Course
	next.Age = old.Age
	next.Faculty = old.Faculty
	next.About = old.About
	next.ProfileUpdated = old.ProfileUpdated
	if old.ProfileUpdated {
		next.FirstName = old.FirstName
		next.LastName = old.LastName
		next.Name = old.Name
		next.Email = old.Email
	}
	return next
}
func (a *App) updateProfile(w http.ResponseWriter, r *http.Request, id string) {
	var b struct {
		FirstName string `json:"firstName"`
		LastName  string `json:"lastName"`
		Email     string `json:"email"`
		Course    int    `json:"course"`
		Age       int    `json:"age"`
		Faculty   string `json:"faculty"`
		About     string `json:"about"`
	}
	if !decode(w, r, &b) {
		return
	}
	b.FirstName = strings.TrimSpace(b.FirstName)
	b.LastName = strings.TrimSpace(b.LastName)
	b.Email = strings.TrimSpace(b.Email)
	b.Faculty = strings.TrimSpace(b.Faculty)
	b.About = strings.TrimSpace(b.About)
	if b.FirstName == "" || utf8.RuneCountInString(b.FirstName) > 80 || utf8.RuneCountInString(b.LastName) > 80 {
		fail(w, 400, "Укажите имя до 80 символов")
		return
	}
	if b.Course < 0 || b.Course > 6 || b.Age < 0 || b.Age > 120 || utf8.RuneCountInString(b.Faculty) > 120 || utf8.RuneCountInString(b.About) > 1000 {
		fail(w, 400, "Проверьте курс, возраст и длину описания")
		return
	}
	if b.Email != "" {
		address, err := mail.ParseAddress(b.Email)
		if err != nil || address.Address != b.Email || len(b.Email) > 254 {
			fail(w, 400, "Укажите корректную почту")
			return
		}
	}
	if a.mutate(func() {
		u := a.db.Users[id]
		u.FirstName = b.FirstName
		u.LastName = b.LastName
		u.Name = strings.TrimSpace(b.FirstName + " " + b.LastName)
		u.Email = b.Email
		u.Course = b.Course
		u.Age = b.Age
		u.Faculty = b.Faculty
		u.About = b.About
		u.ProfileUpdated = true
		a.db.Users[id] = u
	}) != nil {
		fail(w, 500, "Не удалось сохранить профиль")
		return
	}
	respond(w, 200, map[string]bool{"ok": true})
}
func (a *App) profilePhoto(w http.ResponseWriter, r *http.Request, s Session) {
	if r.Method == "GET" {
		id := r.URL.Query().Get("user")
		if id == "" {
			id = s.UserID
		}
		if id == "" || (!s.Admin && id != s.UserID) {
			fail(w, 403, "Фото доступно только владельцу и организаторам")
			return
		}
		u, ok := a.db.Users[id]
		if !ok || len(u.Avatar) != 64 || strings.Trim(u.Avatar, "0123456789abcdef") != "" {
			fail(w, 404, "Фото ещё не загружено")
			return
		}
		w.Header().Set("Content-Type", "image/jpeg")
		http.ServeFile(w, r, filepath.Join(filepath.Dir(a.file), "photos", u.Avatar+".jpg"))
		return
	}
	if s.UserID == "" {
		fail(w, 401, "Сначала войдите в профиль")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4<<20)
	if err := r.ParseMultipartForm(4 << 20); err != nil {
		fail(w, 400, "Фото должно быть не больше 3 МБ")
		return
	}
	defer r.MultipartForm.RemoveAll()
	f, h, err := r.FormFile("photo")
	if err != nil {
		fail(w, 400, "Выберите фото")
		return
	}
	defer f.Close()
	if h.Size > 3<<20 {
		fail(w, 400, "Фото должно быть не больше 3 МБ")
		return
	}
	raw, err := io.ReadAll(io.LimitReader(f, 3<<20+1))
	if err != nil || len(raw) > 3<<20 {
		fail(w, 400, "Не удалось прочитать фото")
		return
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || (format != "jpeg" && format != "png") || cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 4096 || cfg.Height > 4096 || cfg.Width*cfg.Height > 8_000_000 {
		fail(w, 400, "Подойдёт PNG или JPEG до 4096 px и 8 млн пикселей")
		return
	}
	src, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		fail(w, 400, "Не удалось открыть изображение")
		return
	}
	// Normalize into a small JPEG: user files are never served verbatim.
	side := min(cfg.Width, cfg.Height)
	left := (cfg.Width - side) / 2
	top := (cfg.Height - side) / 2
	dst := image.NewRGBA(image.Rect(0, 0, 384, 384))
	for y := 0; y < 384; y++ {
		for x := 0; x < 384; x++ {
			r, g, b, alpha := src.At(left+x*side/384, top+y*side/384).RGBA()
			dst.SetRGBA(x, y, color.RGBA{uint8((r + 65535 - alpha) >> 8), uint8((g + 65535 - alpha) >> 8), uint8((b + 65535 - alpha) >> 8), 255})
		}
	}
	var out bytes.Buffer
	if jpeg.Encode(&out, dst, &jpeg.Options{Quality: 88}) != nil {
		fail(w, 500, "Не удалось подготовить фото")
		return
	}
	dir := filepath.Join(filepath.Dir(a.file), "photos")
	if os.MkdirAll(dir, 0700) != nil {
		fail(w, 500, "Не удалось сохранить фото")
		return
	}
	name := token()
	path := filepath.Join(dir, name+".jpg")
	if os.WriteFile(path, out.Bytes(), 0600) != nil {
		fail(w, 500, "Не удалось сохранить фото")
		return
	}
	if a.mutate(func() { u := a.db.Users[s.UserID]; u.Avatar = name; a.db.Users[s.UserID] = u }) != nil {
		os.Remove(path)
		fail(w, 500, "Не удалось сохранить профиль")
		return
	}
	respond(w, 200, map[string]bool{"ok": true})
}
