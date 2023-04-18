#!/bin/sh
#Mongo DB
brew services start mongodb-community@4.2
#Redis Server
redis-server /usr/local/etc/redis.conf
