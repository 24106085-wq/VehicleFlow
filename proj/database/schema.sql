-- VehicleFlow SQLite schema (converted from the MySQL version).
-- Every statement is CREATE ... IF NOT EXISTS, so this file is safe to run on every start. It never drops anything.
-- MySQL -> SQLite notes:
--   AUTO_INCREMENT  -> INTEGER PRIMARY KEY AUTOINCREMENT      ENUM(...)  -> TEXT + CHECK(... IN (...))
--   DATE / DATETIME -> TEXT ('YYYY-MM-DD' / 'YYYY-MM-DD HH:MM:SS', UTC)
--   ON UPDATE CURRENT_TIMESTAMP -> an AFTER UPDATE trigger keeps updated_at current
--   Foreign keys are enforced because db.js runs PRAGMA foreign_keys = ON.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin','mechanic','customer')),
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mechanics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  specialization TEXT,
  availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available','busy','off')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  plate TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color TEXT,
  mileage INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vehicles_customer ON vehicles(customer_id);

CREATE TABLE IF NOT EXISTS service_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  base_price REAL NOT NULL,
  est_hours REAL NOT NULL DEFAULT 1,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1))
);

CREATE TABLE IF NOT EXISTS service_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  vehicle_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  mechanic_id INTEGER NULL,
  scheduled_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','in_progress','completed','delivered','cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  notes TEXT,
  mechanic_notes TEXT,
  estimated_cost REAL NOT NULL DEFAULT 0,
  final_cost REAL NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES service_categories(id),
  FOREIGN KEY (mechanic_id) REFERENCES mechanics(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON service_bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON service_bookings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bookings_mechanic ON service_bookings(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON service_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle ON service_bookings(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_bookings_category ON service_bookings(category_id);

CREATE TABLE IF NOT EXISTS service_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  mechanic_id INTEGER NULL,
  title TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','blocked','done')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES service_bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (mechanic_id) REFERENCES mechanics(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_booking ON service_tasks(booking_id);
CREATE INDEX IF NOT EXISTS idx_tasks_mechanic ON service_tasks(mechanic_id);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- Kanban WIP limits, one row per board column (keyed by booking status). 0 = no limit.
CREATE TABLE IF NOT EXISTS kanban_wip_limits (
  status TEXT PRIMARY KEY,
  wip_limit INTEGER NOT NULL DEFAULT 0 CHECK (wip_limit >= 0)
);

-- SCRUM MODULE
CREATE TABLE IF NOT EXISTS product_backlog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  acceptance_criteria TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  story_points INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_backlog_priority ON product_backlog(priority);

CREATE TABLE IF NOT EXISTS sprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','completed')),
  started_at TEXT NULL,
  completed_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);
-- Only one sprint can be active at a time (the API checks this too; the database now guarantees it).
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_sprint ON sprints(status) WHERE status = 'active';

-- A sprint task is a user story copied into a sprint. assignee_id points at an existing user (admin or mechanic).
CREATE TABLE IF NOT EXISTS sprint_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sprint_id INTEGER NOT NULL,
  backlog_id INTEGER NULL,
  title TEXT NOT NULL,
  story_points INTEGER NOT NULL DEFAULT 1,
  assignee_id INTEGER NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done')),
  blocked INTEGER NOT NULL DEFAULT 0 CHECK (blocked IN (0,1)),
  comment TEXT NULL,
  completed_at TEXT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
  FOREIGN KEY (backlog_id) REFERENCES product_backlog(id) ON DELETE SET NULL,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_stasks_sprint ON sprint_tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_stasks_assignee ON sprint_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_stasks_backlog ON sprint_tasks(backlog_id);
-- A story can only be in a given sprint once (rows with backlog_id NULL are not affected).
CREATE UNIQUE INDEX IF NOT EXISTS uq_stasks_sprint_backlog ON sprint_tasks(sprint_id, backlog_id);

CREATE TABLE IF NOT EXISTS daily_scrum (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  sprint_id INTEGER NULL,
  scrum_date TEXT NOT NULL,
  yesterday TEXT NOT NULL,
  today_plan TEXT NOT NULL,
  blockers TEXT NOT NULL DEFAULT 'None',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_daily_user_date UNIQUE (user_id, scrum_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_daily_sprint ON daily_scrum(sprint_id);

CREATE TABLE IF NOT EXISTS sprint_retrospectives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sprint_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  went_well TEXT NOT NULL,
  not_well TEXT NOT NULL,
  improve TEXT NOT NULL,
  improvement_id INTEGER NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_retro_sprint_user UNIQUE (sprint_id, user_id),
  FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (improvement_id) REFERENCES product_backlog(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_retro_user ON sprint_retrospectives(user_id);

-- Service activity history: who changed what on a booking (shown on the Kanban card).
CREATE TABLE IF NOT EXISTS service_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  user_id INTEGER NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES service_bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_booking ON service_activity(booking_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON service_activity(user_id);

-- updated_at triggers (SQLite has no "ON UPDATE CURRENT_TIMESTAMP"). The WHEN clause stops them from looping.
CREATE TRIGGER IF NOT EXISTS trg_users_updated AFTER UPDATE ON users FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_vehicles_updated AFTER UPDATE ON vehicles FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE vehicles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_bookings_updated AFTER UPDATE ON service_bookings FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE service_bookings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_service_tasks_updated AFTER UPDATE ON service_tasks FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE service_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_backlog_updated AFTER UPDATE ON product_backlog FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE product_backlog SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_sprint_tasks_updated AFTER UPDATE ON sprint_tasks FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE sprint_tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_daily_scrum_updated AFTER UPDATE ON daily_scrum FOR EACH ROW WHEN NEW.updated_at = OLD.updated_at
BEGIN UPDATE daily_scrum SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
