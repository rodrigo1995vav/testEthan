var express = require('express');
var router = express.Router();


var companyController = require("../controllers/companyController");


/* Send a message to Team-1.co */
router.post('/message', companyController.message);

/* Register a company along with the main user */
router.post('/register', companyController.register);


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
    }
    return next(err);
});


module.exports = router;