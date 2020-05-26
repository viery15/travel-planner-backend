'use strict';

module.exports = function(app) {
    var main = require('./controller/main');
    var crawler = require('./controller/crawler');
    var MainFeature = require('./controller/MainFeature');

    app.route('/')
        .post(main.main);

    app.route('/main')
        .post(main.mainProccess);

    app.route('/crawler')
        .post(crawler.index);

    app.route('/MainFeature')
        .post(MainFeature.index);

};