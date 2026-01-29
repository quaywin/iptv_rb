FROM oven/bun:slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package.json bun.lock ./

# Install app dependencies
RUN bun install --production

# Copy app source
COPY . .

# Expose the port the app runs on
EXPOSE 3030

# Use a shell script to run both worker and server
CMD ["./entrypoint.sh"]
