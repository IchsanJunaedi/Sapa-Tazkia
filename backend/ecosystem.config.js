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

            // Graceful restart on code changes
            watch: false,

            // Auto-restart if app crashes
            autorestart: true,
            max_restarts: 10,
            restart_delay: 3000,

            // Cluster mode for multi-core (1 = single instance, 'max' = all cores)
            instances: 1,
            exec_mode: 'fork',

            // Memory limit — restart if exceeds 512MB
            max_memory_restart: '512M',

            // Log configuration
            out_file: './logs/pm2-out.log',
            error_file: './logs/pm2-err.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,

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
