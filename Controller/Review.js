"use strict";

const response = require("./../res");
const ReviewData = require("./../models/review_data");
const request2 = require("request-promise");
const { exists } = require("./../models/review_data");

exports.index = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  var data = await getAll();

  response.ok(data, res);
};

function getAll() {
  return ReviewData.distinct("informasi").exec();
}
