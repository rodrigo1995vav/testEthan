var express = require('express');
var multer = require('multer');
var path = require('path');

var upload = multer({
    dest: path.join(__dirname, '../public/tmp/'),
    limits: { fileSize: process.env.FILE_MAX_SIZE * 1000 * 1000 },
});

var router = express.Router();
var auth = require("./auth");

var taskController = require("../controllers/taskController");

/* Upload a document */
router.post('/upload', auth, upload.single('file'), taskController.upload);

/* Insert a new task */
router.post('/insert/:project', auth, taskController.insert);

/* View task details */
router.get('/view/:id', auth, taskController.view);

/* Put update task information */
router.put('/update/:project/:id', auth, taskController.update);

/* Delete task */
router.delete('/delete/:project/:id', auth, taskController.delete);

/* List all the tasks within a project */
router.post('/:project', auth, taskController.index);


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