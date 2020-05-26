"use strict";

const response = require("./../res");
const FinalData = require("./../models/final_data");
const request2 = require("request-promise");
const key = "AIzaSyBAnpBN3XcUxdUV56dXxTfuhHBvEySitlY";

exports.index = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  );

  var tanggalWisata = {
    mulai: "5/21/2020",
    akhir: "05/22/2020",
  };

  var userLocation = {
    latitude: "-7.942637178081287",
    longitude: "112.70264024097918",
  };

  var userKategori = ["Museum", "Rekreasi Air", "Taman Hiburan"];
  var tujuanWisata = await getTujuanWisata(
    userKategori,
    userLocation,
    tanggalWisata
  );
  var itinerary = await setPriority(tujuanWisata);

  response.ok(tujuanWisata, res);
};

async function getTujuanWisata(kategori, userLocation, tanggalWisata) {
  var tujuan = await getByKategori(kategori);
  tujuan = await eliminasiJarak(tujuan, userLocation);
  tujuan = await bagiKategori(tujuan);
  tujuan = await bagiHari(tujuan, tanggalWisata);

  return tujuan;
}

async function setPriority(tujuan) {
  for (let index = 0; index < tujuan.length; index++) {
    for (var key in tujuan[index]) {
      for (let i = 0; i < tujuan[index][key].length; i++) {
        var maxScore = 0;
        if (tujuan[index][key][i].sentiment_score > maxScore) {
          maxScore = tujuan[index][key][i].sentiment_score
        }
      }
    }
  }
}

function getByKategori(kategori) {
  var parameter = [];

  for (let index = 0; index < kategori.length; index++) {
    parameter.push({
      kategori: kategori[index],
    });
  }

  return FinalData.find({
    $or: parameter,
  });
}

async function eliminasiJarak(tujuan, userLocation) {
  var tujuanBaru = [];
  for (let index = 0; index < tujuan.length; index++) {
    var dataJarak = await getJarak(userLocation, tujuan[index].location);
    var jarak = await convertMilKilo(
      dataJarak.rows[0].elements[0].distance.text
    );
    if (jarak < 40) {
      tujuanBaru.push({
        _id: tujuan[index]._id,
        kategori: tujuan[index].kategori,
        tempat: tujuan[index].tempat,
        alamat: tujuan[index].alamat,
        kota: tujuan[index].kota,
        jam_buka: tujuan[index].jam_buka,
        location: tujuan[index].location,
        sentiment_score: tujuan[index].sentiment_score,
        jarak: jarak,
        url: tujuan[index].url,
      });
    }
  }

  return tujuanBaru;
}

async function getJarak(start, finish) {
  var options = {
    uri:
      "https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=" +
      start.latitude +
      "," +
      start.longitude +
      "&destinations=" +
      finish.latitude +
      "," +
      finish.longitude +
      "&key=" +
      key,
    method: "GET",
    json: true,
  };

  return request2(options);
}

async function convertMilKilo(mil) {
  var kilo = parseFloat(mil.split(" ")[0]) * 1.60934;

  return kilo;
}

async function bagiKategori(tujuan) {
  var rangeJarak = {
    dekat: [0, 10],
    menengah: [11, 20],
    jauh: [21, 100],
  };

  var tujuanBaru = {
    dekat: [],
    menengah: [],
    jauh: [],
  };

  for (let index = 0; index < tujuan.length; index++) {
    for (var key in rangeJarak) {
      if (
        tujuan[index].jarak >= rangeJarak[key][0] &&
        tujuan[index].jarak <= rangeJarak[key][1]
      ) {
        tujuanBaru[key].push(tujuan[index]);
      }
    }
  }

  return tujuanBaru;
}

async function bagiHari(tujuan, tanggalWisata) {
  var jumlahHari = await getJumlahHari(tanggalWisata);
  var i = 0;
  var tujuanBaru = [];

  for (var key in tujuan) {
    for (let index = 0; index < tujuan[key].length; index++) {
      if (tujuanBaru[i] == null) {
        tujuanBaru[i] = {
          dekat: [],
          menengah: [],
          jauh: [],
        };
      }

      tujuanBaru[i][key].push(tujuan[key][index]);
      if (i == jumlahHari - 1) {
        i = 0;
      } else {
        i++;
      }
    }
  }

  return tujuanBaru;
}

function getJumlahHari(tanggalWisata) {
  let firstDate = new Date(tanggalWisata.mulai),
    secondDate = new Date(tanggalWisata.akhir),
    timeDifference = Math.abs(secondDate.getTime() - firstDate.getTime());
  let differentDays = Math.ceil(timeDifference / (1000 * 3600 * 24));

  return differentDays + 1;
}
