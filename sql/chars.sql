CREATE TABLE `chars` (
    `charid`   int(16) NOT NULL AUTO_INCREMENT,
    `name`     varchar(64) NOT NULL UNIQUE,
    `email`    varchar(255) DEFAULT NULL,
    `password` varchar(256) NOT NULL COMMENT 'bcrypt hashed',
    `created`  datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated`  datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    `last_login` datetime DEFAULT NULL,
    `zone`     varchar(32) NOT NULL DEFAULT 'Calm_Meadow',
    `home`     varchar(32) NOT NULL DEFAULT 'Calm_Meadow',
    `pos_x`    int(8) NOT NULL DEFAULT 0,
    `pos_y`    int(8) NOT NULL DEFAULT 0,
    `pos_z`    int(8) NOT NULL DEFAULT 0,
    `class`    int(2) NOT NULL DEFAULT 1,
    `gmlv`     int(1) NOT NULL DEFAULT 0,
    `banned`   bool NOT NULL DEFAULT false,
    PRIMARY KEY (`charid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
