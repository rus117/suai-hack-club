package main

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type Flow struct {
	Provider, Verifier, Browser string
	Expires                     time.Time
}

func equalSecret(a, b string) bool {
	x := sha256.Sum256([]byte(a))
	y := sha256.Sum256([]byte(b))
	return subtle.ConstantTimeCompare(x[:], y[:]) == 1
}
func (a *App) remote(endpoint string, values url.Values, basicID, basicSecret string, out any) error {
	req, err := http.NewRequest("POST", endpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if basicID != "" {
		req.SetBasicAuth(basicID, basicSecret)
	}
	res, err := a.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("provider returned %d", res.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(out)
}
func (a *App) auth(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Method not allowed", 405)
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 2 {
		http.NotFound(w, r)
		return
	}
	p := parts[1]
	if p != "telegram" && p != "vk" {
		http.NotFound(w, r)
		return
	}
	id := os.Getenv("TG_CLIENT_ID")
	secret := os.Getenv("TG_CLIENT_SECRET")
	endpoint := "https://oauth.telegram.org/auth"
	if p == "vk" {
		id = os.Getenv("VK_CLIENT_ID")
		endpoint = "https://id.vk.ru/authorize"
	}
	if id == "" || (p == "telegram" && secret == "") {
		http.Redirect(w, r, "/login?error=not-configured", 303)
		return
	}
	callback := a.origin + "/auth/" + p + "/callback"
	if len(parts) == 2 {
		state := token()
		verifier := token()
		browser := token()
		a.mu.Lock()
		for k, v := range a.flows {
			if time.Now().After(v.Expires) {
				delete(a.flows, k)
			}
		}
		a.flows[state] = Flow{p, verifier, browser, time.Now().Add(10 * time.Minute)}
		a.mu.Unlock()
		http.SetCookie(w, &http.Cookie{Name: "dorm_oauth", Value: browser, Path: "/auth/", HttpOnly: true, Secure: strings.HasPrefix(a.origin, "https://"), SameSite: http.SameSiteLaxMode, MaxAge: 600})
		sum := sha256.Sum256([]byte(verifier))
		q := url.Values{"client_id": {id}, "redirect_uri": {callback}, "response_type": {"code"}, "state": {state}, "code_challenge": {base64.RawURLEncoding.EncodeToString(sum[:])}, "code_challenge_method": {"S256"}}
		if p == "telegram" {
			q.Set("scope", "openid profile")
		} else {
			q.Set("scope", "vkid.personal_info email")
			q.Set("code_challenge_method", "s256")
		}
		http.Redirect(w, r, endpoint+"?"+q.Encode(), 303)
		return
	}
	if len(parts) != 3 || parts[2] != "callback" {
		http.NotFound(w, r)
		return
	}
	state := r.URL.Query().Get("state")
	a.mu.Lock()
	f, ok := a.flows[state]
	delete(a.flows, state)
	a.mu.Unlock()
	cookie, err := r.Cookie("dorm_oauth")
	if !ok || f.Provider != p || time.Now().After(f.Expires) || err != nil || !equalSecret(cookie.Value, f.Browser) || r.URL.Query().Get("code") == "" {
		http.Redirect(w, r, "/login?error=expired", 303)
		return
	}
	values := url.Values{"client_id": {id}, "redirect_uri": {callback}, "grant_type": {"authorization_code"}, "code": {r.URL.Query().Get("code")}, "code_verifier": {f.Verifier}}
	var u User
	if p == "telegram" {
		var result struct {
			IDToken string `json:"id_token"`
		}
		err = a.remote("https://oauth.telegram.org/token", values, id, secret, &result)
		if err == nil {
			u, err = a.telegramUser(result.IDToken, id)
		}
	} else {
		values.Set("device_id", r.URL.Query().Get("device_id"))
		values.Set("state", state)
		var result struct {
			AccessToken string `json:"access_token"`
			State       string `json:"state"`
		}
		err = a.remote("https://id.vk.ru/oauth2/auth", values, "", "", &result)
		if err == nil && (result.AccessToken == "" || result.State != state) {
			err = fmt.Errorf("invalid token response")
		}
		if err == nil {
			var info struct {
				User struct {
					ID    json.Number `json:"user_id"`
					First string      `json:"first_name"`
					Last  string      `json:"last_name"`
					Email string      `json:"email"`
				} `json:"user"`
			}
			err = a.remote("https://id.vk.ru/oauth2/user_info", url.Values{"client_id": {id}, "access_token": {result.AccessToken}}, "", "", &info)
			if info.User.ID == "" {
				err = fmt.Errorf("missing identity")
			}
			u = User{ID: "vk:" + string(info.User.ID), Name: strings.TrimSpace(info.User.First + " " + info.User.Last), Email: info.User.Email, Provider: "vk"}
		}
	}
	if err != nil {
		logAuthError(p, err)
		http.Redirect(w, r, "/login?error=provider", 303)
		return
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	err = a.mutate(func() {
		old, exists := a.db.Users[u.ID]
		if exists {
			u.Joined = old.Joined
			u.Actions = old.Actions
		} else {
			u.Joined = time.Now().Format(time.RFC3339)
			u.Actions = map[string]bool{}
		}
		a.db.Users[u.ID] = u
	})
	if err != nil {
		http.Redirect(w, r, "/login?error=storage", 303)
		return
	}
	a.issue(w, u.ID, false)
	http.Redirect(w, r, "/profile", 303)
}
func logAuthError(p string, err error) {
	fmt.Fprintf(os.Stderr, "%s authorization failed: %v\n", p, err)
}
func (a *App) telegramUser(jwt, clientID string) (User, error) {
	bad := fmt.Errorf("invalid Telegram ID token")
	parts := strings.Split(jwt, ".")
	if len(parts) != 3 {
		return User{}, bad
	}
	decode := base64.RawURLEncoding.DecodeString
	header, err := decode(parts[0])
	if err != nil {
		return User{}, bad
	}
	var h struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if json.Unmarshal(header, &h) != nil || h.Alg != "RS256" || h.Kid == "" {
		return User{}, bad
	}
	res, err := a.client.Get("https://oauth.telegram.org/.well-known/jwks.json")
	if err != nil {
		return User{}, err
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return User{}, bad
	}
	var keys struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&keys) != nil {
		return User{}, bad
	}
	verified := false
	signature, err := decode(parts[2])
	if err != nil {
		return User{}, bad
	}
	sum := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	for _, k := range keys.Keys {
		if k.Kid != h.Kid || k.Kty != "RSA" {
			continue
		}
		n, e1 := decode(k.N)
		e, e2 := decode(k.E)
		if e1 != nil || e2 != nil || len(e) > 4 {
			continue
		}
		exponent := 0
		for _, b := range e {
			exponent = exponent*256 + int(b)
		}
		if exponent < 3 {
			continue
		}
		verified = rsa.VerifyPKCS1v15(&rsa.PublicKey{N: new(big.Int).SetBytes(n), E: exponent}, crypto.SHA256, sum[:], signature) == nil
	}
	if !verified {
		return User{}, bad
	}
	payload, err := decode(parts[1])
	if err != nil {
		return User{}, bad
	}
	var c struct {
		Issuer   string          `json:"iss"`
		Audience json.RawMessage `json:"aud"`
		Sub      string          `json:"sub"`
		Name     string          `json:"name"`
		Username string          `json:"preferred_username"`
		Expires  int64           `json:"exp"`
		Issued   int64           `json:"iat"`
	}
	if json.Unmarshal(payload, &c) != nil {
		return User{}, bad
	}
	var aud string
	json.Unmarshal(c.Audience, &aud)
	if aud == "" {
		var list []string
		json.Unmarshal(c.Audience, &list)
		for _, v := range list {
			if v == clientID {
				aud = v
			}
		}
	}
	if c.Issuer != "https://oauth.telegram.org" || aud != clientID || c.Sub == "" || c.Expires <= time.Now().Unix() || c.Issued > time.Now().Unix()+60 {
		return User{}, bad
	}
	return User{ID: "telegram:" + c.Sub, Name: c.Name, Provider: "telegram", Username: c.Username}, nil
}
