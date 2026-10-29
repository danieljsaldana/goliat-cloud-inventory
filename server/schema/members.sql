CREATE TABLE IF NOT EXISTS application_administrators (
  tenant_id UUID NOT NULL,
  object_id UUID NOT NULL,
  granted_by UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, object_id)
);

CREATE TABLE IF NOT EXISTS application_role_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id UUID NOT NULL,
  object_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  previous_role VARCHAR(20) NOT NULL CHECK (previous_role IN ('member', 'administrator')),
  new_role VARCHAR(20) NOT NULL CHECK (new_role IN ('member', 'administrator')),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

