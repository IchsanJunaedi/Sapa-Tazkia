// PM2 Ecosystem Configuration
// Usage:
//   Development: pm2 start ecosystem.config.js --env development
//   Production:  pm2 start ecosystem.config.js --env production
//   Save:        pm2 save && pm2 startup

module.exports = {
    apps: [
        {
            name: 'sapa-tazkia',
            script: 'src/app.js',
            cwd: './',

            // Node.js optimization flags
            node_args: '--max-old-space-size=512',

            // Graceful restart on code changes
            watch: false,
            ignore_watch: ['node_modules', 'logs', '.git', 'prisma/migrations'],

            // Auto-restart if app crashes
            autorestart: true,
            max_restarts: 10,
            restart_delay: 4000,
            exp_backoff_restart_delay: 100,

            // Cluster mode for multi-core (1 = single instance, 'max' = all cores)
            instances: 1,
            exec_mode: 'fork',

            // Memory limit — restart if exceeds 500MB
            max_memory_restart: '500M',

            // Graceful shutdown
            kill_timeout: 10000,     // 10s to shutdown gracefully
            listen_timeout: 8000,
            shutdown_with_message: true,

            // Health
            min_uptime: '10s',

            // Log configuration
            out_file: './logs/pm2-out.log',
            error_file: './logs/pm2-err.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            merge_logs: true,
            log_type: 'json',

            // Environment: development
            env: {
                NODE_ENV: 'development',
                PORT: 5000
            },

            // Environment: production (use with --env production)
            env_production: {
                NODE_ENV: 'production',
                PORT: 5000
            }
        }
    ]
};
