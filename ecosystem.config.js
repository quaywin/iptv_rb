module.exports = {
    apps: [
        {
            name: "iptv_server",
            script: "./server.js",
            instances: "max", // Tận dụng tối đa số nhân CPU để xử lý nhiều kết nối hơn
            exec_mode: "cluster", // Chạy chế độ Cluster
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            env: {
                NODE_ENV: "production",
                // PORT will be read from .env if present, otherwise defaults in config.js
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
