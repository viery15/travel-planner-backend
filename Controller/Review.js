"use strict";

const response = require("./../res");
const FinalData = require("./../models/final_data");
const request2 = require("request-promise");
const { exists } = require("./../models/final_data");

exports.index = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  var id = req.body.id;

  var data = await getById(id);

  response.ok(data, res);

};

function getById(id){
    return FinalData.find( {_id : id} ).exec();
}
