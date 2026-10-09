package main

import (
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
)

// Proposals are private: only their author and organizers can read them.
type Proposal struct {
	ID      string `json:"id"`
	UserID  string `json:"userId"`
	Title   string `json:"title"`
	Body    string `json:"body"`
	Created string `json:"created"`
	Status  string `json:"status"`
	EventID string `json:"eventId,omitempty"`
}

func (a *App) createProposal(w http.ResponseWriter, r *http.Request, s Session) {
	if s.UserID == "" {
		fail(w, 401, "Войдите, чтобы предложить встречу")
		return
	}
	var b struct {
		Title string `json:"title"`
		Body  string `json:"body"`
	}
	if !decode(w, r, &b) {
		return
	}
	b.Title, b.Body = strings.TrimSpace(b.Title), strings.TrimSpace(b.Body)
	if b.Title == "" || b.Body == "" || utf8.RuneCountInString(b.Title) > 120 || utf8.RuneCountInString(b.Body) > 2000 {
		fail(w, 400, "Нужны название до 120 символов и описание до 2000 символов")
		return
	}
	pending := 0
	for _, p := range a.db.Proposals {
		if p.UserID == s.UserID && p.Status == "pending" {
			pending++
		}
	}
	if pending >= 5 {
		fail(w, 409, "У вас уже пять идей на рассмотрении. Дождитесь ответа организаторов.")
		return
	}
	p := Proposal{ID: token(), UserID: s.UserID, Title: b.Title, Body: b.Body, Created: time.Now().Format(time.RFC3339), Status: "pending"}
	if a.mutate(func() { a.db.Proposals = append(a.db.Proposals, p) }) != nil {
		fail(w, 500, "Не удалось сохранить идею")
		return
	}
	respond(w, 200, map[string]any{"ok": true, "id": p.ID})
}

func (a *App) reviewProposal(w http.ResponseWriter, r *http.Request) {
	var b struct {
		ID      string `json:"id"`
		EventID string `json:"eventId"`
		Status  string `json:"status"`
	}
	if !decode(w, r, &b) {
		return
	}
	if b.Status != "accepted" && b.Status != "declined" && b.Status != "pending" {
		fail(w, 400, "Неизвестный статус")
		return
	}
	if b.Status == "accepted" {
		found := false
		for _, event := range a.db.Events {
			if event.ID == b.EventID && !event.Draft {
				found = true
			}
		}
		if !found {
			fail(w, 400, "Выберите опубликованное мероприятие")
			return
		}
	} else {
		b.EventID = ""
	}
	index := -1
	for i, p := range a.db.Proposals {
		if p.ID == b.ID {
			index = i
			break
		}
	}
	if index < 0 {
		fail(w, 404, "Идея не найдена")
		return
	}
	if a.mutate(func() { a.db.Proposals[index].Status = b.Status; a.db.Proposals[index].EventID = b.EventID }) != nil {
		fail(w, 500, "Не удалось сохранить ответ")
		return
	}
	respond(w, 200, map[string]bool{"ok": true})
}
