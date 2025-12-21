module.exports = {
    apps: [
        {
            name: "iptv_rb",
            script: "./server.js",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            env: {
                NODE_ENV: "production",
                PORT: 4444,
            },
            env_development: {
                NODE_ENV: "development",
                PORT: 4444,
            },
        },
    ],
};
