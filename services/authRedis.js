var redis = require('./../config/redis');
var { promisify } = require('util');
var _ = require('lodash');


const redisGetAsync = promisify(redis.get).bind(redis);

exports.login = (token, user) => {
    redis.setex('Token-' + token.token, process.env.TOKEN_LIFE * 60, JSON.stringify(token), function() {});
    redis.setex('refreshToken-' + token.refreshToken, process.env.REFRESH_TOKEN_LIFE * 60, JSON.stringify(token), function() {});
    exports.saveUser(user);
}

exports.logout = (payload) => {
    redis.del('Token-' + payload.token, function(err, reply) {});
    redis.del('refreshToken-' + payload.refreshToken, function(err, reply) {});
}

exports.getToken = async(type, token) => {
    var result = await redisGetAsync(type + '-' + token);
    return _.isNull(result) ? null : JSON.parse(result);
}

exports.refreshToken = (prevToken, token) => {
    redis.del('Token-' + prevToken, function(err, reply) {});
    redis.setex('Token-' + token.token, process.env.TOKEN_LIFE * 60, JSON.stringify(token), function(err, reply) {});
}

exports.getUser = async(id) => {
    var result = await redisGetAsync('User-' + id);
    return _.isNull(result) ? null : JSON.parse(result);
}

exports.saveUser = (user) => {
    redis.setex('User-' + user.id, process.env.TOKEN_LIFE * 60,
        JSON.stringify({
            _id: user.id,
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: user.fullName,
            email: user.email,
            company: user.company,
            active: user.active,
            deleted: user.deleted,
            picture: user.picture,
            timezone: user.timezone,
            role: user.role
        }),
        function() {});
}

exports.updateUser = (user, updatedData) => {
    _.each(updatedData, function(v, k) {
        user[k] = v;
    });
    exports.saveUser(user);
}

exports.deleteUser = (user) => {
    redis.del('User-' + user.id, function() {});
}