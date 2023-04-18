var express = require('express');
var multer = require('multer');
var path = require('path');

var upload = multer({
    dest: path.join(__dirname, '../public/tmp/'),
    limits: {
        fileSize: parseInt(process.env.AVATAR_MAX_SIZE) * 1000 * 1000,
        fieldSize: parseInt(process.env.AVATAR_MAX_SIZE) * 1000 * 1000
    },
});

var router = express.Router();
var auth = require("./auth");

var userController = require("../controllers/userController");

/* Insert a new user */
router.post('/insert', auth, userController.insert);

/* View user details */
router.get('/view(/:id)?', auth, userController.view);

/* Put update profile */
router.put('/profile', auth, userController.profile);

/* Post update my picture */
router.post('/picture', auth, upload.single('picture'), userController.picture);

/* Put update user information */
router.put('/update/:id', auth, userController.update);

/* Delete user */
router.delete('/delete/:id', auth, userController.delete);

/* List all the users within the same company that are active and not deleted */
router.get('/colleagues', auth, userController.colleagues);

/* User dashboard */
router.get('/dashboard', auth, userController.dashboard);

/* List all the users within the same company */
router.post('', auth, userController.index);


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