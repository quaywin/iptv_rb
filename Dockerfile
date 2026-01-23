FROM node:20-slim

# Install PM2 globally
RUN npm install pm2 -g

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm install --production

# Copy app source
COPY . .

# Expose the port the app runs on
EXPOSE 3030

# Use PM2 to run the application as defined in ecosystem.config.js
# --no-daemon is required for Docker to keep the container running
CMD ["pm2-runtime", "ecosystem.config.js"]
