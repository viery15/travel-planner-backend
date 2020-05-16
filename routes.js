'use strict';

module.exports = function(app) {
    var main = require('./controller/main');
    var crawler = require('./controller/crawler');

    app.route('/')
        .post(main.main);

    app.route('/main')
        .post(main.mainProccess);

    app.route('/crawler')
        .post(crawler.index);

    app.route('/coba')
        .post(crawler.coba);

};