"use strict";

const response = require("./../res");
const FinalData = require("./../models/final_data");
const request2 = require("request-promise");
const { exists } = require("./../models/final_data");
const key = "AIzaSyBAnpBN3XcUxdUV56dXxTfuhHBvEySitlY";

exports.index = async function (req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE"
  ); // If needed

  var tanggalWisata = {
    mulai: req.body.tanggalMulai,
    akhir: req.body.tanggalAkhir, //"6/9/2020"
  };

  // var userLocation = {
  //   latitude: "-7.942637178081287",
  //   longitude: "112.70264024097918",
  // };
  var userLocation = {
    latitude: req.body.latitude,
    longitude: req.body.longitude,
  };

  var userKategori = req.body.kategori;

  if (!Array.isArray(userKategori)) {
    userKategori = [];
    userKategori.push(req.body.kategori);
  }

  let tujuanWisata = await getTujuanWisata(
    userKategori,
    userLocation,
    tanggalWisata
  );

  tujuanWisata = await sortSentiment(tujuanWisata);

  var itinerary = [];
  for (let index = 0; index < tujuanWisata.length; index++) {
    var result = await setItinerary(
      tujuanWisata[index],
      userLocation,
      tanggalWisata.mulai
    );
    itinerary.push(result);
  }

  response.ok(itinerary, res);
};

async function getTujuanWisata(kategori, userLocation, tanggalWisata) {
  var tujuan = await getByKategori(kategori);
  tujuan = await eliminasiJarak(tujuan, userLocation);
  tujuan = await bagiHari(tujuan, tanggalWisata);

  return tujuan;
}

async function sortSentiment(tujuan) {
  for (let index = 0; index < tujuan.length; index++) {
    tujuan[index] = tujuan[index].sort(compare);
  }

  return tujuan;
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

async function bagiHari(tujuan, tanggalWisata) {
  var jumlahHari = await getJumlahHari(tanggalWisata);
  var i = 0;
  var tujuanBaru = [];

  for (let index = 0; index < tujuan.length; index++) {
    if (tujuanBaru[i] == null) {
      tujuanBaru[i] = [];
    }

    tujuanBaru[i].push(tujuan[index]);
    if (i == jumlahHari - 1) {
      i = 0;
    } else {
      i++;
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

function compare(a, b) {
  if (a.sentiment_score < b.sentiment_score) {
    return 1;
  }
  if (a.sentiment_score > b.sentiment_score) {
    return -1;
  }
  return 0;
}

async function setItinerary(dataTujuan, start, tanggalBerkunjung) {
  var jamBerangkat = "08:00";
  var keterangan = "Perjalanan dari lokasi anda menuju ";
  var itinerary = [];
  var jumlahTujuan = 1;
  var nilaiJarak = 0;

  var memenuhi = true
  while (jumlahTujuan != 7 && dataTujuan.length != 0 && memenuhi) {
    var jarakTerkecil = 999;
    var jmlTutup = 0;
    for (let index = 0; index < dataTujuan.length; index++) {
      if (jmlTutup == dataTujuan.length) {
        console.log("mandek");
        break;
      }
      var jarak = await getJarak(start, dataTujuan[index].location);
      nilaiJarak = parseFloat(
        jarak.rows[0].elements[0].distance.text.split(" ")[0]
      );

      if (nilaiJarak < jarakTerkecil) {
        var lamaPerjalanan = await getJarak(start, dataTujuan[index].location);

        var jamSampai = await hitungJam(
          jamBerangkat,
          lamaPerjalanan.rows[0].elements[0].duration.text
        );

        var waktuBerkunjung =
          jamSampai + " - " + (await hitungJam(jamSampai, "90 mins"));

        var statusBuka = await getStatusBuka(
          dataTujuan[index].jam_buka,
          waktuBerkunjung,
          tanggalBerkunjung
        );

        if (statusBuka == "Tutup") {
          // console.log("tutup woy");
          jmlTutup++;
          continue;
        }
        jarakTerkecil = nilaiJarak;
        var indexRemove = dataTujuan[index].tempat;
        var tujuan = dataTujuan[index];
      }
    }

    if (tujuan != undefined) {
      dataTujuan = dataTujuan.filter((item) => item.tempat !== indexRemove);
      // console.log("ini tujuan " + tujuan.tempat);
      var lamaPerjalanan = await getJarak(start, tujuan.location);
      //jamSampai = jam mulai berwisata
      var jamSampai = await hitungJam(
        jamBerangkat,
        lamaPerjalanan.rows[0].elements[0].duration.text
      );

      var waktuBerkunjung =
        jamSampai + " - " + (await hitungJam(jamSampai, "90 mins"));

      var statusBuka = await getStatusBuka(
        tujuan.jam_buka,
        waktuBerkunjung,
        tanggalBerkunjung
      );

      itinerary.push({
        waktu: jamBerangkat + " - " + jamSampai,
        keterangan: keterangan + tujuan.tempat,
        status: "-",
      });

      var alamat = await getAddress(
        tujuan.location.latitude,
        tujuan.location.longitude
      );

      itinerary.push({
        nama: tujuan.tempat,
        waktu: waktuBerkunjung,
        jamBuka: tujuan.jam_buka,
        alamat: alamat.results[0].formatted_address,
        keterangan: "Liburan di " + tujuan.tempat,
        kategori: tujuan.kategori,
        location: tujuan.location,
        sentimentScore: tujuan.sentiment_score,
        status: statusBuka,
        cuaca: await getCuaca(jamSampai, tujuan.location, tanggalBerkunjung),
      });

      keterangan = "Perjalanan dari " + tujuan.tempat + " menuju ";
      jamBerangkat = await hitungJam(jamSampai, "90 mins");
      jumlahTujuan++;
      start = tujuan.location;
      tujuan = "";
    }

    else {
      memenuhi = false
    }
  }

  return itinerary;
}

async function cekStatus(tujuan, waktuBerkunjung, tanggalBerkunjung) {
  var status = {
    buka: await getStatusBuka(
      tujuan.jam_buka,
      waktuBerkunjung,
      tanggalBerkunjung
    ),
    cuaca: await getCuaca(waktuBerkunjung, tujuan.location, tanggalBerkunjung),
  };
}

function hitungJam(jam, durasi) {
  //jam => 08:00
  //durasi -> 40 mins, 1 hour 5 mins
  jam = jam.split(":");
  durasi = durasi.split(" ");

  var hasil = {};
  if (durasi.length > 2) {
    var total_menit = parseInt(durasi[0]) * 60 + parseInt(durasi[2]);
  } else if (durasi.length == 2) {
    if (durasi[1] == "mins") {
      var total_menit = parseInt(durasi[0]);
    } else {
      var total_menit = parseInt(durasi[0]) * 60;
    }
  } else if (durasi.length < 2) {
    var total_menit = parseInt(durasi[0]) * 60;
  }

  if (total_menit > 60) {
    var durasi_menit = total_menit % 60;
    var durasi_jam = (total_menit - durasi_menit) / 60;

    hasil.jam = parseInt(jam[0]) + durasi_jam;
    hasil.menit = parseInt(jam[1]) + durasi_menit;

    if (hasil.menit > 60) {
      hasil.jam = (hasil.menit - (hasil.menit % 60)) / 60 + hasil.jam;
      hasil.menit = hasil.menit - 60;
    }

    if (hasil.jam < 10) {
      hasil.jam = "0" + hasil.jam;
    }

    if (hasil.menit < 10) {
      hasil.menit = "0" + hasil.menit;
    }

    hasil.text = hasil.jam + ":" + hasil.menit;
  } else if (total_menit < 60) {
    hasil.jam = parseInt(jam[0]);
    hasil.menit = parseInt(jam[1]) + total_menit;

    if (hasil.menit > 60) {
      hasil.jam = (hasil.menit - (hasil.menit % 60)) / 60 + hasil.jam;
      hasil.menit = hasil.menit - 60;
    }

    if (hasil.jam < 10) {
      hasil.jam = "0" + hasil.jam;
    }

    if (hasil.menit < 10) {
      hasil.menit = "0" + hasil.menit;
    }

    hasil.text = hasil.jam + ":" + hasil.menit;
  } else if (total_menit == 60) {
    hasil.jam = parseInt(jam[0]);
    hasil.menit = parseInt(jam[1]);

    hasil.jam = hasil.jam + 1;

    if (hasil.jam < 10) {
      hasil.jam = "0" + hasil.jam;
    }

    if (hasil.menit < 10) {
      hasil.menit = "0" + hasil.menit;
    }

    hasil.text = hasil.jam + ":" + hasil.menit;
  }

  return hasil.text;
}

function getStatusBuka(data, waktuBerkunjung, tanggalBerkunjung) {
  //format waktu berkunjung --> "15:00 - 18:30"
  // data --> data jam_buka

  var d = new Date(tanggalBerkunjung);
  var day = d.getDay();

  var days = {
    Senin: 1,
    Selasa: 2,
    Rabu: 3,
    Kamis: 4,
    Jumat: 5,
    Sabtu: 6,
    Minggu: 0,
  };

  for (var key in days) {
    if (days[key] == day) {
      day = key;
    }
  }

  for (var hari in data) {
    if (hari == day) {
      if (data[hari] == "Buka 24 jam") {
        var jam_buka = "00:00 - 23:59";
      } else {
        var jam_buka = data[hari];
      }
    }
  }

  jam_buka = jam_buka.split("–");
  jam_buka[0] = parseInt(jam_buka[0]);
  jam_buka[1] = parseInt(jam_buka[1]);

  waktuBerkunjung = waktuBerkunjung.split(" - ");
  waktuBerkunjung[0] = parseInt(waktuBerkunjung[0]);
  waktuBerkunjung[1] = parseInt(waktuBerkunjung[1]);
  if (waktuBerkunjung[1] >= jam_buka[1] || waktuBerkunjung[0] < jam_buka[0]) {
    var status = "Tutup";
  } else if (
    waktuBerkunjung[1] < jam_buka[1] ||
    waktuBerkunjung[0] >= jam_buka[0]
  ) {
    var status = "Buka";
  }
  return status;
}

async function getCuaca(jamBerkunjung, location, tanggalBerkunjung) {
  //JamBerkunjung -> "08:00" ;
  var key = "81009d732d26d0e2ca070742855c6ad8";

  tanggalBerkunjung = formatDate(tanggalBerkunjung);
  jamBerkunjung = jamBerkunjung.split(":");
  jamBerkunjung[0] = parseInt(jamBerkunjung);

  var options = {
    uri:
      "http://api.openweathermap.org/data/2.5/forecast?lat=" +
      location.latitude +
      "&lon=" +
      location.longitude +
      "&appid=" +
      key,
    method: "GET",
    json: true,
  };

  var dataCuaca = await request2(options);

  var cuaca = "-";
  if (dataCuaca.list != undefined) {
    dataCuaca.list.forEach(function (item) {
      var x = item.dt_txt.split(" ");
      x[1] = x[1].split(":");
      var tanggal = x[0];
      var jam = parseInt(x[1][0]);
      var jam2 = jam + 3;
      if (tanggalBerkunjung == tanggal) {
        if (jam == jamBerkunjung[0]) {
          cuaca = item.weather[0].main;
        } else if (jam < jamBerkunjung[0] && jam + 4 > jamBerkunjung[0]) {
          cuaca = item.weather[0].main;
        }
      }
      // console.log(tanggalBerkunjung + " & " + tanggal);
      // console.log(jamBerkunjung[0] + " & " + jam);
    });
  }

  // console.log(cuaca);

  return cuaca;
}

function formatDate(date) {
  var d = new Date(date),
    month = "" + (d.getMonth() + 1),
    day = "" + d.getDate(),
    year = d.getFullYear();

  if (month.length < 2) month = "0" + month;
  if (day.length < 2) day = "0" + day;

  return [year, month, day].join("-");
}

function getAddress(latitude, longitude) {
  var options = {
    uri:
      "https://maps.googleapis.com/maps/api/geocode/json?latlng=" +
      latitude +
      "," +
      longitude +
      "&key=" +
      key,
    method: "GET",
    json: true,
  };

  return request2(options);
}
