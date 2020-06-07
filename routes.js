'use strict';

module.exports = function(app) {
    var main = require('./Controller/main');
    var crawler = require('./Controller/crawler');
    var MainFeature = require('./Controller/MainFeature');

    app.route('/')
        .post(main.main);

    app.route('/main')
        .post(main.mainProccess);

    app.route('/crawler')
        .post(crawler.index);

    app.route('/MainFeature')
        .post(MainFeature.index);

};