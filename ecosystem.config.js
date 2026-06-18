// PM2 process definition for the CarCheck backend (BACKLOG B8).
//
// Run from the repo root:  pm2 start ecosystem.config.js
//
// No secrets / env block here on purpose: the app loads backend/.env itself
// via dotenv (index.js + config/database.js call require('dotenv').config()),
// and dotenv resolves .env relative to the process CWD. PM2's only job is to
// pin `cwd` to ./backend so dotenv finds the file. Keep all secrets in
// backend/.env — this file is safe to commit.
module.exports = {
  apps: [{
    name: 'carcheck-api',
    script: 'index.js',
    cwd: './backend',                 // load-bearing: dotenv reads .env from CWD
    exec_mode: 'fork',                // single instance — the login rate limiter
    instances: 1,                     // is an in-memory Map (index.js); cluster mode
                                      // would split it and weaken the 5-attempt limit
    autorestart: true,
    watch: false,                     // never watch files in production

    // Restart policy tuned to the app's fail-fast exits:
    //  - weak/missing JWT_SECRET  -> process.exit(1) immediately (permanent)
    //  - MariaDB unreachable      -> process.exit(1) at boot (often transient)
    //  - uncaughtException        -> process.exit(1)
    // min_uptime + max_restarts stop a thrash loop on the permanent error;
    // exponential backoff rides out a DB-still-booting window after a reboot.
    min_uptime: '10s',
    max_restarts: 10,
    exp_backoff_restart_delay: 200,
    max_memory_restart: '300M',

    // Logs (rotation handled by the pm2-logrotate module — see README).
    error_file: './logs/carcheck-error.log',
    out_file: './logs/carcheck-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    time: true,
  }]
};
