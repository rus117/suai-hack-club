package main

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

func TestProposalLifecycleAndPrivateHistory(t *testing.T) {
	a := testApp(t)
	cookie, csrf := loginTest(t, a, false)
	body := map[string]string{"title": "Вечер соседей", "body": "Настолки в общей комнате"}
	if w := call(a, "POST", "proposal", body, nil, "", a.origin); w.Code == 200 {
		t.Fatal("guest can propose")
	}
	if w := call(a, "POST", "proposal", body, cookie, "wrong", a.origin); w.Code != 403 {
		t.Fatal("CSRF not enforced", w.Code)
	}
	if w := call(a, "POST", "proposal", body, cookie, csrf, a.origin); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if len(a.db.Proposals) != 1 || a.db.Proposals[0].UserID != "demo:neighbor" {
		t.Fatal("author not assigned by server")
	}
	p := a.db.Proposals[0]
	if w := call(a, "POST", "admin/proposal", map[string]string{"id": p.ID, "status": "accepted", "eventId": "past"}, cookie, csrf, a.origin); w.Code != 403 {
		t.Fatal("ordinary user can accept proposal", w.Code)
	}
	admin, ac := loginTest(t, a, true)
	for _, event := range []string{"missing", "draft"} {
		if w := call(a, "POST", "admin/proposal", map[string]string{"id": p.ID, "status": "accepted", "eventId": event}, admin, ac, a.origin); w.Code != 400 {
			t.Fatal("invalid event accepted", w.Code)
		}
	}
	if w := call(a, "POST", "admin/proposal", map[string]string{"id": p.ID, "status": "accepted", "eventId": "past"}, admin, ac, a.origin); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	w := call(a, "GET", "me", nil, cookie, "", "")
	var mine struct {
		Proposals []Proposal `json:"proposals"`
		Events    []Event    `json:"proposedEvents"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &mine); err != nil || len(mine.Proposals) != 1 || len(mine.Events) != 1 || mine.Events[0].ID != "past" {
		t.Fatal("author history missing", w.Body.String())
	}
	a.db.Users["other"] = User{ID: "other", Name: "Другой сосед"}
	a.sessions["other-session"] = Session{UserID: "other", Expires: time.Now().Add(time.Hour)}
	other := &http.Cookie{Name: "dorm_session", Value: "other-session"}
	w = call(a, "GET", "me", nil, other, "", "")
	var theirs struct {
		Proposals []Proposal `json:"proposals"`
		Events    []Event    `json:"proposedEvents"`
	}
	json.Unmarshal(w.Body.Bytes(), &theirs)
	if len(theirs.Proposals) != 0 || len(theirs.Events) != 0 {
		t.Fatal("proposal leaked to another user")
	}
	w = call(a, "GET", "public", nil, nil, "", "")
	var public map[string]json.RawMessage
	json.Unmarshal(w.Body.Bytes(), &public)
	if _, exists := public["proposals"]; exists {
		t.Fatal("proposals leaked publicly")
	}
	reloaded, err := newApp(a.file)
	if err != nil || len(reloaded.db.Proposals) != 1 || reloaded.db.Proposals[0].EventID != "past" {
		t.Fatal("proposal not persisted", err)
	}
}

func TestProposalValidationAndPendingLimit(t *testing.T) {
	a := testApp(t)
	cookie, csrf := loginTest(t, a, false)
	if w := call(a, "POST", "proposal", map[string]string{"title": " ", "body": "hi"}, cookie, csrf, a.origin); w.Code != 400 {
		t.Fatal("empty title accepted")
	}
	for i := 0; i < 5; i++ {
		if w := call(a, "POST", "proposal", map[string]string{"title": "Идея", "body": "Описание"}, cookie, csrf, a.origin); w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	if w := call(a, "POST", "proposal", map[string]string{"title": "Идея", "body": "Описание"}, cookie, csrf, a.origin); w.Code != 409 {
		t.Fatal("pending limit missing")
	}
	admin, ac := loginTest(t, a, true)
	if w := call(a, "POST", "admin/proposal", map[string]string{"id": a.db.Proposals[0].ID, "status": "declined"}, admin, ac, a.origin); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w := call(a, "POST", "proposal", map[string]string{"title": "Новая идея", "body": "Описание"}, cookie, csrf, a.origin); w.Code != 200 {
		t.Fatal("resolved proposal did not free slot")
	}
}
