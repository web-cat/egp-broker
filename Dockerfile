# Use the official Node.js 14 image as the base image
FROM node:14

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install the app dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Copy the wait-for-it script
COPY wait-for-it.sh /usr/src/app/wait-for-it.sh

# Expose the application port
EXPOSE 3000

# Command to run the application
CMD ["./wait-for-it.sh", "db:3306", "--", "node", "index.js"]
