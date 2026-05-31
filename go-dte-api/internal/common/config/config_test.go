package config

import "testing"

func TestEffectiveMinIntervalMsFromRateLimit(t *testing.T) {
	cfg := Config{RateLimitPerSec: 10}
	if got := cfg.EffectiveMinIntervalMs(); got != 100 {
		t.Fatalf("got %d, want 100", got)
	}
}

func TestEffectiveMinIntervalMsExplicitOverride(t *testing.T) {
	cfg := Config{RateLimitPerSec: 10, MinIntervalMs: 250}
	if got := cfg.EffectiveMinIntervalMs(); got != 250 {
		t.Fatalf("got %d, want 250", got)
	}
}

func TestEffectiveMinIntervalMsDisabled(t *testing.T) {
	cfg := Config{RateLimitPerSec: 0}
	if got := cfg.EffectiveMinIntervalMs(); got != 0 {
		t.Fatalf("got %d, want 0", got)
	}
}
