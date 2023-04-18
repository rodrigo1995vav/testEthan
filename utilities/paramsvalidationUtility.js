var _ = require('lodash');

exports.validatePageNumber = function(page) {
    return (!_.isUndefined(page) && page.match(/[1-9][0-9]*/)) ? _.toInteger(page) : 1;
}

exports.validateItemPerPage = function(item_per_page) {
    return (!_.isUndefined(item_per_page) && item_per_page.match(/[1-9][0-9]*/)) ? _.toInteger(item_per_page) : _.toInteger(process.env.ITEM_PER_PAGE);
}

exports.validateSortOrder = function(order, default_value) {
    return (!_.isUndefined(order) && order.match(/(asc|desc)/)) ? order : default_value;
}

exports.validateSortField = function(field, fields, default_value) {
    if (_.isUndefined(field))
        return 'created';
    fields = _.split(fields, '|');
    return (fields.indexOf(field) >= 0) ? field : 'created';
}

exports.validateKeyword = function(keyword) {
    return (!_.isUndefined(keyword) && keyword.match(/[A-Za-z0-9@\.\-\_]+/)) ? keyword : "";
}

exports.validatePasswordLength = function(password) {
    if (_.isEmpty(password))
        return false;
    return password.length >= 8;
}

exports.validatePasswordComplexity = function(password) {
    var pattern = /(?=.*[!#$%&()*+\-.\/:;<=>?@_{|}])(?=.*[a-z])(?=.*[A-Z]).{8,32}/;
    return pattern.test(password);
}