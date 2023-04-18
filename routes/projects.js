var express = require('express');

var router = express.Router();
var auth = require("./auth");

var projectController = require("../controllers/projectController");

/* Insert a new project */
router.post('/insert', auth, projectController.insert);

/* View project details */
router.get('/view/:id', auth, projectController.view);

/* Put update project */
router.put('/update/:id', auth, projectController.update);

/* Delete project */
router.delete('/delete/:id', auth, projectController.delete);

/* List all the projects where I am a member */
router.post('/member', auth, projectController.member);

/* List all the projects within my company */
router.post('', auth, projectController.index);


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