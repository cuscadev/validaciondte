package microsoft

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const defaultTenantID = "common"

var imapScopes = strings.Join([]string{
	"https://outlook.office365.com/IMAP.AccessAsUser.All",
	"offline_access",
	"openid",
	"profile",
	"email",
}, " ")

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	Error        string `json:"error"`
	ErrorDesc    string `json:"error_description"`
}

func tenantID() string {
	if v := strings.TrimSpace(os.Getenv("MICROSOFT_TENANT_ID")); v != "" {
		return v
	}
	return defaultTenantID
}

func clientCredentials() (clientID, clientSecret string, err error) {
	clientID = strings.TrimSpace(os.Getenv("MICROSOFT_CLIENT_ID"))
	clientSecret = strings.TrimSpace(os.Getenv("MICROSOFT_CLIENT_SECRET"))
	if clientID == "" || clientSecret == "" {
		return "", "", fmt.Errorf("Microsoft OAuth no configurado (MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET)")
	}
	return clientID, clientSecret, nil
}

func tokenEndpoint() string {
	return fmt.Sprintf("https://login.microsoftonline.com/%s/oauth2/v2.0/token", tenantID())
}

func RefreshAccessToken(refreshToken string) (accessToken string, err error) {
	clientID, clientSecret, err := clientCredentials()
	if err != nil {
		return "", err
	}

	form := url.Values{
		"client_id":     {clientID},
		"client_secret": {clientSecret},
		"refresh_token": {refreshToken},
		"grant_type":    {"refresh_token"},
		"scope":         {imapScopes},
	}

	req, err := http.NewRequest(http.MethodPost, tokenEndpoint(), strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	client := &http.Client{Timeout: 30 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}

	var parsed tokenResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", err
	}

	if res.StatusCode >= 400 || parsed.AccessToken == "" {
		detail := parsed.ErrorDesc
		if detail == "" {
			detail = parsed.Error
		}
		if detail == "" {
			detail = res.Status
		}
		return "", fmt.Errorf("token Microsoft: %s. Reconecta tu cuenta Microsoft", formatOAuthError(detail))
	}

	return parsed.AccessToken, nil
}

func formatOAuthError(detail string) string {
	lower := strings.ToLower(detail)
	if strings.Contains(lower, "aadsts65001") || strings.Contains(lower, "consent") {
		return "se requiere consentimiento del administrador de Microsoft 365"
	}
	if strings.Contains(lower, "invalid_grant") {
		return "autorizacion expirada o revocada"
	}
	return detail
}
