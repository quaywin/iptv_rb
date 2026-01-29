#!/bin/bash

# Start the worker in the background
bun worker.js &

# Start the server in the foreground
bun server.js
