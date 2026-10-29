CREATE TABLE inventory_schema (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  version INTEGER NOT NULL CHECK (version = 1),
  checksum CHAR(64) NOT NULL,
  initialized_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_runs (
  id UUID PRIMARY KEY,
  provider VARCHAR(20) NOT NULL CHECK (provider = 'azure'),
  generated_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_reports (
  run_id UUID NOT NULL REFERENCES inventory_runs(id) ON DELETE CASCADE,
  report_id VARCHAR(128) NOT NULL,
  headers JSONB NOT NULL CHECK (jsonb_typeof(headers) = 'array'),
  PRIMARY KEY (run_id, report_id)
);

CREATE TABLE inventory_rows (
  run_id UUID NOT NULL,
  report_id VARCHAR(128) NOT NULL,
  row_index INTEGER NOT NULL CHECK (row_index >= 0),
  scope_id VARCHAR(128) NOT NULL DEFAULT '',
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'array'),
  PRIMARY KEY (run_id, report_id, row_index),
  FOREIGN KEY (run_id, report_id) REFERENCES inventory_reports(run_id, report_id) ON DELETE CASCADE
);

CREATE INDEX inventory_rows_scope ON inventory_rows (run_id, report_id, scope_id, row_index);

CREATE TABLE inventory_heads (
  provider VARCHAR(20) PRIMARY KEY CHECK (provider = 'azure'),
  run_id UUID NOT NULL REFERENCES inventory_runs(id)
);
