FROM node:20-alpine

WORKDIR /app

# نصب dependencies
COPY package*.json ./
RUN npm install --production

# کپی کد
COPY . .

# ساخت پوشه های لازم
RUN mkdir -p data public/uploads logs

# Seed اولیه (اختیاری - در اولین اجرا)
# RUN npm run seed

EXPOSE 3000

CMD ["node", "src/server.js"]
