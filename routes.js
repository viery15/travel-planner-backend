"use strict";

module.exports = function (app) {
  var main = require("./Controller/main");
  var crawler = require("./Controller/crawler");
  var MainFeature = require("./Controller/MainFeature");
  var Wisata = require("./Controller/Wisata");
  var Review = require("./Controller/Review");

  app.route("/").post(main.main);

  app.route("/main").post(main.mainProccess);

  app.route("/crawler").post(crawler.index);

  app.route("/MainFeature").post(MainFeature.index);

  app.route("/Wisata").get(Wisata.index);

  app.route("/Review").post(Review.index);
};
