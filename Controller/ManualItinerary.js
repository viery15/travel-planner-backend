"use strict";

const response = require("./../res");
const FinalData = require("./../models/final_data");
const request2 = require("request-promise");
const {
    exists
} = require("./../models/final_data");
const key = "AIzaSyBAnpBN3XcUxdUV56dXxTfuhHBvEySitlY";

exports.index = async function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS, PUT, PATCH, DELETE"
    );

    var userLocation = {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
    };
    var tanggalMulai = req.body.tanggalMulai;
    var waktuMulai = req.body.waktuMulai;
    var dataTujuan = JSON.parse(req.body.data);
    var itinerary = await setItinerary(dataTujuan, userLocation, tanggalMulai, waktuMulai);

    response.ok(itinerary, res);
}

async function setItinerary(dataTujuan, start, tanggalMulai, waktuMulai) {
    var jamBerangkat = waktuMulai;
    var keterangan = "Perjalanan dari lokasi anda menuju ";
    var jumlahTujuan = 0;
    var nilaiJarak = 0;
    var itinerary = [];
    var tanggalBerkunjung = tanggalMulai;
    var keteranganPerjalanan = {
        start: start.latitude + "," + start.longitude,
        finish: "",
    };

    while (dataTujuan.length != 0) {
        var jarakTerkecil = 999;
        var tujuan = "";
        for (let index = 0; index < dataTujuan.length; index++) {
            var jarak = await getJarak(start, dataTujuan[index].location);
            nilaiJarak = parseFloat(
                jarak.rows[0].elements[0].distance.text.split(" ")[0]
            );

            if (nilaiJarak < jarakTerkecil) {
                jarakTerkecil = nilaiJarak;
                var indexRemove = dataTujuan[index].tempat;
                tujuan = dataTujuan[index];
            }
        }

        // console.log(tujuan.tempat);

        var lamaPerjalanan = jarak;

        dataTujuan = dataTujuan.filter((item) => item.tempat !== indexRemove);

        var jamSampai = await hitungJam(
            jamBerangkat,
            lamaPerjalanan.rows[0].elements[0].duration.text
        );

        var durasi = tujuan.durasi + " mins"

        var waktuBerkunjung =
            jamSampai + " - " + (await hitungJam(jamSampai, durasi));

        var statusBuka = await getStatusBuka(
            tujuan.jam_buka,
            waktuBerkunjung,
            tanggalBerkunjung
        );

        keteranganPerjalanan.finish = tujuan.tempat;

        itinerary.push({
            waktu: jamBerangkat + " - " + jamSampai,
            keterangan: keterangan + tujuan.tempat,
            status: "-",
            rute: await linkMap(keteranganPerjalanan),
        });

        var alamat = await getAddress(
            tujuan.location.latitude,
            tujuan.location.longitude
        );

        itinerary.push({
            _id: tujuan._id,
            nama: tujuan.tempat,
            waktu: waktuBerkunjung,
            jamBuka: tujuan.jam_buka,
            alamat: alamat.results[0].formatted_address,
            keterangan: "Liburan di " + tujuan.tempat,
            kategori: tujuan.kategori,
            location: tujuan.location,
            sentimentScore: tujuan.sentiment_score,
            url: tujuan.url,
            status: statusBuka,
            cuaca: await getCuaca(jamSampai, tujuan.location, tanggalBerkunjung),
        });

        keterangan = "Perjalanan dari " + tujuan.tempat + " menuju ";
        keteranganPerjalanan = {
            start: tujuan.tempat,
            finish: "",
        };
        jamBerangkat = await hitungJam(jamSampai, durasi);
        jumlahTujuan++;
        start = tujuan.location;
        tujuan = "";
    }
    return itinerary;
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

exports.tujuan = async function (req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS, PUT, PATCH, DELETE"
    );

    var userLocation = {
        latitude: req.body.latitude,
        longitude: req.body.longitude,
    };

    var tujuan = await getAll();

    tujuan = await eliminasiJarak(tujuan, userLocation);

    response.ok(tujuan, res);

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

function getAll() {
    return FinalData.find().exec();
}

async function getJarak(start, finish) {
    var options = {
        uri: "https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=" +
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

function linkMap(keterangan) {
    var link =
        "https://www.google.com/maps/dir/?api=1&origin=" +
        keterangan.start +
        "&destination=" +
        keterangan.finish;

    return link;
}

function getAddress(latitude, longitude) {
    var options = {
        uri: "https://maps.googleapis.com/maps/api/geocode/json?latlng=" +
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

async function getCuaca(jamBerkunjung, location, tanggalBerkunjung) {
    //JamBerkunjung -> "08:00" ;
    var key = "81009d732d26d0e2ca070742855c6ad8";

    tanggalBerkunjung = formatDate(tanggalBerkunjung);
    jamBerkunjung = jamBerkunjung.split(":");
    jamBerkunjung[0] = parseInt(jamBerkunjung);

    // http://api.openweathermap.org/data/2.5/forecast?lat=-7.942637178081287&lon=112.70264024097918&appid=81009d732d26d0e2ca070742855c6ad8

    try {
        var options = {
            uri: "http://api.openweathermap.org/data/2.5/forecast?lat=" +
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
            });
        }
    } catch (err) {
        console.log(err.message);
        var cuaca = "-";
    }

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