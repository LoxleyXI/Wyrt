/* Copy this file to ./config and update your settings */
{
   "db": {
        "host":     "localhost",
        "user":     "root",
        "password": "root",
        "database": "wyrt",
    },

    "ports": {
        "web":    4040,
        "socket": 8080,
    },

    "certificates": {
        "cert": "domain.crt",
        "key":  "domain.key",
    },

    "options": {
        "dev":          true,
        "web":          true,
        "nodb":         false,
        "example":      true,
        "ratePoolSize": 30,
    },
}
