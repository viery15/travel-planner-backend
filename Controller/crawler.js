"use strict";

var response = require("./../res");
var puppeteer = require("puppeteer");
const request2 = require("request-promise");
var request = require("request");
const fs = require("fs");
const final_data = require("./../models/final_data");
const mongoose = require("mongoose");
var MongoClient = require("mongodb").MongoClient;
var urlMongo =
  "mongodb://viery15:mendol817@cluster0-shard-00-00-aybsr.mongodb.net:27017,cluster0-shard-00-01-aybsr.mongodb.net:27017,cluster0-shard-00-02-aybsr.mongodb.net:27017/travel_planner?ssl=true&replicaSet=Cluster0-shard-0&authSource=admin&retryWrites=true&w=majority";

exports.index = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  ); // If needed

  // var url = "https://www.google.com/maps/place/Wisata+Alam+Sumber+Jenon/@-7.8309555,112.420832,10z/data=!4m8!1m2!2m1!1sWisata+alam+malang!3m4!1s0x2dd62831f7a2d477:0xec7cd4e78c57fa6f!8m2!3d-8.0496699!4d112.7164657";
  var url = req.body.url;
  (async () => {
    const browser = await puppeteer.launch({
      // headless: false,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-extensions",
      ],
    });
    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 0,
    });

    await page.waitForSelector(".widget-pane-link", {
      visible: true,
    });

    const result = await page.evaluate(() => {
      var informasi = document.querySelectorAll("span.widget-pane-link");
      var tempat = document.getElementsByClassName(
        "GLOBAL__gm2-headline-5 section-hero-header-title-title"
      );
      var hari = document.querySelectorAll("th > div:nth-child(1)");
      var jam = document.querySelectorAll("td.lo7U087hsMA__row-data > ul > li");
      var jam_buka = {};
      for (let i = 0; i < 7; i++) {
        jam_buka[hari[i].innerText] = jam[i].innerText;
      }

      var alamatLengkap = document.querySelectorAll(
        "div.ugiz4pqJLAG__primary-text.gm2-body-2"
      )[0].innerText;

      alamat = alamatLengkap.split(",");
      var kota = alamat[alamat.length - 2];

      let data = {
        tempat: tempat[0].innerText,
        alamat: alamatLengkap,
        kota: kota,
        jam_buka: jam_buka,
      };
      return data;
    });

    var kota_jatim = {
      Surabaya: [" Surabaya City", " Kota SBY"],
      Malang: [" Kota Malang", " Malang"],
      Batu: [" Kota Batu", "Batu"],
      Blitar: [" Kota Blitar", " Blitar"],
      Kediri: [" Kota Kediri", " Kediri"],
      Pacitan: [" Kabupaten Pacitan", " Kediri"],
    };

    for (var key_kota in kota_jatim) {
      for (let index = 0; index < kota_jatim[key_kota].length; index++) {
        if (kota_jatim[key_kota][index] == result.kota) {
          result.kota = key_kota;
        }
      }
    }

    var status_tempat = await checkRedundan(result.tempat);

    if (status_tempat == "exist") {
      console.log("Data already exist\nCrawler Stopped");

      response.ok("Data already exist", res);

      await browser.close();
    } else {
      console.log("informasi umum berhasil ditambahkan");
      await page.waitForSelector(
        "#pane > div > div.widget-pane-content.scrollable-y > div > div > div.section-layout.section-layout-justify-space-between.section-layout-vertically-center-content.section-layout-flex-vertical.section-layout-flex-horizontal > div.iRxY3GoUYUY__actionicon > div > button"
      );
      await page.click(
        "#pane > div > div.widget-pane-content.scrollable-y > div > div > div.section-layout.section-layout-justify-space-between.section-layout-vertically-center-content.section-layout-flex-vertical.section-layout-flex-horizontal > div.iRxY3GoUYUY__actionicon > div > button"
      );
      await page.waitFor(5000);

      const scrollable_section = ".section-scrollbox";
      await page.waitForSelector(".section-scrollbox");

      var count2 = 0;
      var count = 0;
      var counts = 0;

      for (let index = 0; index < 11; index++) {
        counts = await page.evaluate(
          ({ count, count2 }) => {
            const scrollableSection = document.querySelector(
              ".section-scrollbox"
            );

            scrollableSection.scrollTop += 5000;
            var count = (scrollableSection.scrollTop += 5000);

            if (count > count2) {
              count2 = count;
            } else {
              count2 = 0;
            }

            return {
              count,
              count2,
            };
          },
          { count, count2 }
        );

        await page.waitFor(10000);

        count = counts.count;
        count2 = counts.count2;
      }

      await page.evaluate(() => {
        let detail_reviews = document.querySelectorAll(
          ".section-expand-review"
        );

        var index = 0;
        while (index < detail_reviews.length) {
          detail_reviews[index].click();
          console.log("index " + index + "clicked");
          index++;
        }
        return {
          detail_reviews,
        };
      });

      const result2 = await page.evaluate(() => {
        var postReview = document.getElementsByClassName("section-review-text");
        var reviews = [];
        for (var i = 0; i < postReview.length; i++) {
          reviews.push(postReview[i].innerText);
        }

        return {
          reviews,
        };
      });

      console.log("Review berhasil didapatkan");

      var coor_loc = await getCoordinat(result.tempat);

      var kategori = [];
      if (Array.isArray(req.body.kategori)) {
        kategori = req.body.kategori;
      } else {
        kategori.push(req.body.kategori);
      }

      var responseData = {
        informasi: result,
        kategori: kategori,
        location: {
          latitude: coor_loc.lat,
          longitude: coor_loc.lng,
        },
        reviews: result2.reviews,
      };

      responseData.reviews = responseData.reviews.filter(function (el) {
        return el != "";
      });

      responseData.reviews.splice(100);
      var reviews = responseData.reviews;

      fs.writeFileSync(
        "./Data Output/" + responseData.informasi.tempat + ".json",
        JSON.stringify(responseData, null, 2)
      );

      // MongoClient.connect(urlMongo, function(err, db) {
      //     if (err) throw err;
      //     db.collection("review_data").insertOne(responseData, function(err, res) {
      //         if (err) throw err;
      //         console.log("review data inserted");
      //         db.close();
      //     });
      // });

      var options = {
        uri: "http://127.0.0.1/sentiment/",
        method: "POST",
        body: {
          reviews: responseData.reviews,
        },
        json: true,
      };

      var score_review = await request2(options);

      var finalData = {
        tempat: responseData.informasi.tempat,
        alamat: responseData.informasi.alamat,
        kota: responseData.informasi.kota,
        jam_buka: responseData.informasi.jam_buka,
        kategori: responseData.kategori,
        location: responseData.location,
        review: score_review.reviews,
        sentiment_score: score_review.total_score,
        url: url,
      };

      MongoClient.connect(urlMongo, function (err, db) {
        if (err) throw err;
        db.collection("final_datas").insertOne(finalData, function (err, res) {
          if (err) throw err;
          console.log(finalData.tempat + " Berhasil ditambahkan");
          db.close();
        });
      });

      // request({
      //     url: "http://127.0.0.1/sentiment/",
      //     method: "POST",
      //     body: JSON.stringify({
      //         reviews: responseData.reviews
      //     }),

      // }, function (error, response, body){
      //     console.log(response.body)
      //     var score_review = response.body

      //     var finalData = new final_data({
      //         _id: new mongoose.Types.ObjectId(),
      //         tempat : responseData.informasi.tempat,
      //         alamat : responseData.informasi.alamat,
      //         kota : responseData.informasi.kota,
      //         jam_buka : responseData.informasi.jam_buka,
      //         kategori : responseData.kategori,
      //         location : responseData.location,
      //         review: reviews,
      //         sentiment_score : score_review,
      //         url : url
      //     });

      //     finalData.save().then(result => {
      //         console.log("Final data inserted");
      //         console.log("Finished")
      //     }).catch(err => console.log(err));

      // });

      response.ok(finalData, res);

      await browser.close();
    }
  })();
};

async function getCoordinat(place) {
  var key = "AIzaSyBAnpBN3XcUxdUV56dXxTfuhHBvEySitlY";
  var options = {
    uri:
      "https://maps.googleapis.com/maps/api/geocode/json?address=" +
      place +
      "&key=" +
      key,
    method: "GET",
    json: true,
  };

  var loc = await request2(options);

  return loc.results[0].geometry.location;
}

function queryCheck(place) {
  return final_data.find({ tempat: place }).exec();
}

async function checkRedundan(place) {
  var place = place;
  var data = await queryCheck(place);
  if (data.length == 0) {
    data = "tidak ada";
  } else {
    data = "exist";
  }

  return data;
}

exports.coba = async function (req, res) {
  var tempat = "Wisata Sumber Ubalan";
  var status = await checkRedundan(tempat);

  console.log(status);
};
