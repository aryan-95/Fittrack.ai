FROM node:20-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4000
# migrate + start; seed is idempotent
CMD ["sh","-c","npx prisma db push --skip-generate && npx tsx prisma/seed.ts && node dist/index.js"]
