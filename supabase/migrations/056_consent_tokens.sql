-- Migration 056: Parental consent tokens
-- One-time tokens used by the hosted parent consent page.
-- Spec: docs/superpowers/specs/2026-04-27-challenges-module-design.md §11

CREATE TABLE parental_consent_tokens (
  token         text PRIMARY KEY,
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_email  text NOT NULL,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_consent_tokens_user ON parental_consent_tokens(user_id);
ALTER TABLE parental_consent_tokens ENABLE ROW LEVEL SECURITY;
-- Service-role only; no public policy.
