FROM node:16

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn --pure-lockfile

RUN mkdir -p ./data

COPY . .

CMD [ "yarn", "start" ]
