"use strict";

const response = require("./../res");
const FinalData = require("./../models/final_data");
const request2 = require("request-promise");
const axios = require('axios');
const {
  exists
} = require("./../models/final_data");

exports.index = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  var data = await getAll();

  response.ok(data, res);

};

exports.refresh = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  req.setTimeout(0)

  var data = await getByKota("Pacitan");

  for (let index = 0; index < data.length; index++) {
    // console.log("Start --> " + data[index].tempat);

    await deleteByUrl(data[index].url);

    // await axios.post('http://127.0.0.1:3000/crawler/', {
    //   kategori: data[index].kategori,
    //   url: data[index].url
    // });

    // console.log("Finish --> " + data[index].tempat);



    // var options = {
    //   uri: "http://127.0.0.1:3000/crawler/",
    //   method: "POST",
    //   body: {
    //     kategori: data[index].kategori,
    //     url: data[index].url
    //   },
    //   json: true,
    // };

    // var response = await request2(options);

  }

  await axios.post('http://127.0.0.1:3000/crawler/', {
      data: data
    });

  response.ok("sukses", res);

};

function getAll() {
  return FinalData.find().exec();
}

function getByKota(kota) {
  return FinalData.find({
    kota: kota
  }).exec();
}

function deleteByUrl(url) {
  return FinalData.remove({
    url: url
  });
}