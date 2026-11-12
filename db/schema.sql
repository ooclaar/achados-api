-- Schema idempotente: a API aplica este arquivo ao iniciar.
CREATE TABLE IF NOT EXISTS achados (
  id           UUID PRIMARY KEY,
  titulo       TEXT NOT NULL,
  descricao    TEXT NOT NULL DEFAULT '',
  severidade   TEXT NOT NULL CHECK (severidade IN ('CRITICA', 'ALTA', 'MEDIA', 'BAIXA')),
  status       TEXT NOT NULL CHECK (status IN ('ABERTO', 'EM_TRATAMENTO', 'RESOLVIDO')),
  responsavel  TEXT,
  criado_em    TIMESTAMPTZ NOT NULL,
  prazo        TIMESTAMPTZ NOT NULL,
  resolvido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_achados_status_criado_em ON achados (status, criado_em DESC);
