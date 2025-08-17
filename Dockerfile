# Use the Apify base image for Node.js 20
FROM apify/actor-node:20

# Copy package*.json and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the source code
COPY . ./

# Run the main script
CMD ["npm", "start"]