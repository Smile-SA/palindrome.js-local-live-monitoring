# Use the official Ubuntu image as the base image
FROM ubuntu:latest

# Update package lists and install necessary packages
RUN apt-get update && \
    apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    apt-get install -y build-essential && \
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    apt-get update && \
    apt-get install -y yarn

# Set the working directory inside the container
WORKDIR /app/realTimeDataSystem

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install project dependencies using Yarn
RUN yarn install

# Copy the rest of the application code
COPY . .

# Expose the port your app runs on
EXPOSE 9091

# Command to run the application
CMD ["yarn", "run", "start"]
