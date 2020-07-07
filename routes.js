"use strict";

module.exports = function (app) {
  var main = require("./Controller/main");
  var crawler = require("./Controller/crawler");
  var MainFeature = require("./Controller/MainFeature");
  var Wisata = require("./Controller/Wisata");
  var Review = require("./Controller/Review");
  var ManualItinerary = require("./Controller/ManualItinerary");

  app.route("/").post(main.main);

  app.route("/main").post(main.mainProccess);

  app.route("/crawler").post(crawler.index);

  app.route("/MainFeature").post(MainFeature.index);

  app.route("/Wisata").get(Wisata.index);

  app.route("/Wisata/refresh").post(Wisata.refresh);

  app.route("/Review").post(Review.index);

  app.route("/ManualItinerary").post(ManualItinerary.index);
  app.route("/ManualItinerary/tujuan").post(ManualItinerary.tujuan);

};
