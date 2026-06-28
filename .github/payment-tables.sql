-- create these tables if you are going to use the payments system
CREATE TABLE IF NOT EXISTS orders (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id     VARCHAR(100) NOT NULL,
  order_id      VARCHAR(255) NOT NULL,
  payment_id    INT          NULL,
  status        VARCHAR(50)  NOT NULL DEFAULT 'pending',
  amount        INT          NOT NULL DEFAULT 0,
  currency      CHAR(3)      NOT NULL DEFAULT 'ZAR',
  metadata      JSON         NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_order (tenant_id, order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_webhook (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id      VARCHAR(100) NULL,
  event          VARCHAR(100)  NULL,
  message        TEXT          NOT NULL,
  created_at     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;