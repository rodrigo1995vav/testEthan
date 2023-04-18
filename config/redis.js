var redis = require("redis");

var client = redis.createClient({
    prefix: 'Team-1:',
    port: process.env.REDIS_PORT,
    host: process.env.REDIS_URL
});

client.on('connect', function() {});

client.on('error', function(err) {
    console.log('Redis error:', err);
});


module.exports = client