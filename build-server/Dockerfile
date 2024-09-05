FROM ubuntu:focal

RUN apt update
RUN apt install -y curl
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt upgrade -y
RUN apt install -y nodejs
RUN apt install git -y

WORKDIR /home/app

COPY package*.json ./
RUN npm install
COPY main.sh main.sh
COPY script.js script.js
COPY kafka.pem kafka.pem
RUN chmod +x main.sh
RUN chmod +x script.js

ENTRYPOINT [ "/home/app/main.sh" ]