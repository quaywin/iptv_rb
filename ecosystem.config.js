module.exports = {
    apps: [
        {
            name: "iptv_server",
            script: "./server.js",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            env: {
                NODE_ENV: "production",
                PORT: 4444,
            },
        },
        {
            name: "iptv_worker",
            script: "./worker.js",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "500M",
        },
    ],
};
