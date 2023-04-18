var express = require('express');
var multer = require('multer');
var path = require('path');

var upload = multer({
    dest: path.join(__dirname, '../public/tmp/'),
    limits: { fileSize: process.env.FILE_MAX_SIZE * 1000 * 1000 },
});

var router = express.Router();
var auth = require("./auth");

var meetingController = require("../controllers/meetingController");

/* Upload a document */
router.post('/upload', auth, upload.single('file'), meetingController.upload);

/* Insert a new meeting */
router.post('/insert', auth, meetingController.insert);

/* View meeting details */
router.get('/view/:id', auth, meetingController.view);

/* Update meeting */
router.put('/update/:id', auth, meetingController.update);

/* Restore meeting */
router.get('/restore/:id', auth, meetingController.restore);

/* Cancel meeting */
router.delete('/cancel/:id', auth, meetingController.cancel);

/* Send meeting invitations */
router.post('/invite/:id/:method', auth, meetingController.invite);

/* Start meeting */
router.get('/start/:id', auth, meetingController.start);

/* Validate meeting code */
router.get('/validate/:code', auth, meetingController.validate);

/* Upcoming meetings + previous meetings */
router.post('', auth, meetingController.index);


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