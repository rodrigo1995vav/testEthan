var express = require('express');
var router = express.Router();
var auth = require("./auth");

var authenticationController = require("../controllers/authenticationController");

/* Login */
router.post('/login', authenticationController.login);

/* Activate account (company and user) */
router.post('/activate', authenticationController.activate);

/* Check guest activation token */
router.post('/gchecktoken', authenticationController.gCheckToken);

/* Set password used by guest when activating account */
router.post('/gSetPassword', authenticationController.gSetPassword);

/* Forget password */
router.post('/forgetpassword', authenticationController.forgetPassword);

/* Check forget password token */
router.post('/fpchecktoken', authenticationController.fpCheckToken);

/* Reset password using the forget password token */
router.post('/resetpassword', authenticationController.resetPassword);

/* Change password */
router.post('/password', auth, authenticationController.changePassword);

/* Refresh/extend token once the user is connected */
router.get('/refresh', auth, authenticationController.refresh);

/* Check token while user is connected */
router.get('/check', auth, authenticationController.check);

/* Logout */
router.get('/logout', auth, authenticationController.logout);


/* Handling errors */
router.use(function(err, req, res, next) {
    switch (err.name) {
        case 'ValidationError':
            return res.status(422).json({
                errors: Object.keys(err.errors).reduce(function(errors, key) {
                    errors[key] = err.errors[key].message;
                    return errors;
                }, {})
            });
            break;
        case 'UnauthorizedError':
            return res.status(401).json(err.inner);
            break;
    }
    return next(err);
});

module.exports = router;