FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create videos directory
RUN mkdir -p videos

# Expose port
EXPOSE 3000

# Start command
CMD ["npm", "start"] 