package imaputil

import (
	"fmt"

	"github.com/emersion/go-sasl"
)

type xoauth2Client struct {
	username string
	token    string
}

func newXoauth2Client(username, accessToken string) sasl.Client {
	return &xoauth2Client{username: username, token: accessToken}
}

func (c *xoauth2Client) Start() (mechanism string, ir []byte, err error) {
	authString := fmt.Sprintf("user=%s\x01auth=Bearer %s\x01\x01", c.username, c.token)
	return "XOAUTH2", []byte(authString), nil
}

func (c *xoauth2Client) Next(challenge []byte) (response []byte, err error) {
	return nil, sasl.ErrUnexpectedClientResponse
}
