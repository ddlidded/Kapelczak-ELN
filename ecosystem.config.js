module.exports = {
  apps: [{
    name: "kapelczak-notes",
    script: "server/prod.js",
    env: {
      NODE_ENV: "development",
      PORT: 5000
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 5000
    },
    instances: "max",
    exec_mode: "cluster",
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "logs/error.log",
    out_file: "logs/output.log",
    merge_logs: true,
    wait_ready: true,
    listen_timeout: 10000,
    kill_timeout: 5000
  }]
};