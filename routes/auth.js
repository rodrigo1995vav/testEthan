var jwt = require('jsonwebtoken');
var _ = require('lodash');
const requestIp = require('request-ip');
var authRedis = require('../services/authRedis');

var userModel = require('../models/userModel');

var roles = require('../config/roles');

function auth(req, res, next) {

    if (!req.headers.authorization) {
        return res.status(403).send({ auth: false, message: 'No token provided.' });
    } else {
        var secret, token, type;
        switch (req.headers.authorization.split(' ')[0]) {
            case "Token":
                token = req.headers.authorization.split(' ')[1];
                secret = process.env.SECRET;
                type = 'Token';
                break;
            case "Refresh":
                token = req.headers.authorization.split(' ')[1];
                secret = process.env.REFRESH_SECRET;
                type = 'refreshToken';
                break;
        }

        jwt.verify(token, secret, async function(err, decoded) {
            if (err)
                return res.status(500).send({ auth: false, message: 'Failed to authenticate token' });
            if (decoded.exp <= Date.now() / 1000)
                return res.status(400).send({ auth: false, message: 'Token expired' });

            var result = await authRedis.getToken(type, token);
            if (!_.isNull(result)) {
                result.userInfo = await authRedis.getUser(result.user);
                if (_.isNull(result.userInfo)) {
                    var user = await userModel.findById(result.user).select(['_id', 'id', 'company', 'firstName', 'lastName', 'email', 'active', 'deleted', 'role', 'timezone', 'picture']);
                    authRedis.saveUser(user);
                    result.userInfo = user.toJSON();
                }
                if (result.userInfo.active && !result.userInfo.deleted && requestIp.getClientIp(req) == result.ip) {
                    if (type == "refreshToken") {
                        if (req.originalUrl != "/authentication/refresh") {
                            return res.status(400).send({ auth: false, message: 'Failed to authenticate token' });
                        } else {
                            req.payload = result;
                            next();
                        }
                    } else {
                        if (_.indexOf(roles[req.baseUrl + req.route.path], result.userInfo.role) >= 0) {
                            req.payload = result;
                            next();
                        } else {
                            return res.status(401).json({ errors: { message: "User is unauthorized" } });
                        }
                    }
                } else {
                    return res.status(400).send({ auth: false, message: 'Token expired' });
                }
            } else {
                return res.status(400).send({ auth: false, message: 'Token not valid' });
            }
        });
    }
}


module.exports = auth;