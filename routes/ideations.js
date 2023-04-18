var express = require('express');

var router = express.Router();
var auth = require("./auth");

var ideationController = require("../controllers/ideationController");


/* Insert a new ideation */
router.post('/insert', auth, ideationController.insert);

/* View ideation details */
router.get('/view/:id', auth, ideationController.view);

/* Update ideation */
router.put('/update/:id', auth, ideationController.update);

/* Delete ideation */
router.delete('/delete/:id', auth, ideationController.delete);

/* List of ideation */
router.post('', auth, ideationController.index);


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