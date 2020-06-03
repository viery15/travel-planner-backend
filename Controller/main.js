'use strict';

var response = require('./../res');
const request2 = require("request-promise");
const final_data = require('./../models/final_data');

exports.main = async function(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE'); // If needed

    var key = "AIzaSyBAnpBN3XcUxdUV56dXxTfuhHBvEySitlY";
    var latitude = req.body.latitude;
    var longitude = req.body.longitude;

    var options = {
        uri: "https://maps.googleapis.com/maps/api/geocode/json?latlng="+latitude+","+longitude+"&key="+key,
        method: "GET",
        json: true
    }

    var result = await request2(options);
    var addres = result.results[0].address_components;
    var kota = result.results[0].address_components[addres.length - 4].long_name;

    var kota_jatim = {
        'Surabaya': [' Surabaya City',' Kota SBY', 'Kota SBY', 'Kota Surabaya'],
        'Malang': [' Kota Malang', 'Malang', 'Kota Malang'],
        'Batu': [' Kota Batu', 'Batu']
    };

    for(var key_kota in kota_jatim) {  
        for (let index = 0; index < kota_jatim[key_kota].length; index++) {
            if(kota_jatim[key_kota][index] == kota ){
                kota = key_kota;
            }
            
        }
    }

    var data_destinasi = await ambil(kota);
    response.ok(data_destinasi, res);
}

async function getJarak(latitudeStart, longitudeStart, latitudeFinish, longitudeFinish){
    var key = "AIzaSyBAnpBN3XcUxdUV56dXxTfuhHBvEySitlY";
    var options = {
        uri: "https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins="+latitudeStart+","+longitudeStart+"&destinations="+latitudeFinish+","+longitudeFinish+"&key="+key,
        method: "GET",
        json: true
    }

    return request2(options);

}

exports.mainProccess = async function(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    var data = req.body.data;
    data = JSON.parse(data)
    var latitude = req.body.latitude;
    var tanggal_wisata = req.body.tanggal;
    var longitude = req.body.longitude;
    var latitude_akhir = req.body.latitude_akhir;
    var longitude_akhir = req.body.longitude_akhir;
    var jam_mulai = req.body.jam_mulai+":"+req.body.menit_mulai;
    // console.log(tanggal_wisata);
    var data_asli = "";

    for (let index = 0; index < data.length; index++) {
        data_asli = await getById(data[index]['destinasi']);
        data[index].location = data_asli[0].location;
        data[index].jam_buka = data_asli[0].jam_buka;
        data[index].nama = data_asli[0].tempat;
    }
    
    var jarak = [];
    var rute = [];

    var jarak_max = 9999;
    var jumlah_destinasi = data.length * 2;
    var index_remove;
    var tempat_mulai = "Titik awal";
    var otw = {};

    while(rute.length != jumlah_destinasi) {
        for (let index = 0; index < data.length; index++) {
            var hasil = await getJarak(latitude, longitude, data[index].location.latitude, data[index].location.longitude);
            var jarak_text = parseFloat(hasil.rows[0].elements[0].distance.text.split(" ")[0])
            
            jarak.push({
                id_destinasi: data[index].destinasi,
                start: {
                    latitude: latitude,
                    longitude: longitude
                },
                finish: {
                    latitude: data[index].location.latitude,
                    longitude: data[index].location.longitude
                },
                alamat_start : hasil.origin_addresses[0],
                alamat_finish : hasil.destination_addresses[0],
                jarak: jarak_text
            });
            
            if (jarak_text < jarak_max) {
                otw.tempat_mulai = tempat_mulai;
                otw.jam_mulai = jam_mulai;
                var lama_perjalanan = hasil.rows[0].elements[0].duration.text;
                jarak_max = jarak_text;
                var temp = data[index];
                otw.tempat_finish = tempat_mulai;
                temp.jam_mulai = hitungJam(jam_mulai, lama_perjalanan);
                otw.jam_akhir = temp.jam_mulai;
                otw.waktu = otw.jam_mulai +" - " + otw.jam_akhir;
                otw.nama = tempat_mulai +" - " + temp.nama;
                temp.jam_akhir = hitungJam(temp.jam_mulai, temp.lama_stay);
                temp.waktu = temp.jam_mulai +" - " + temp.jam_akhir;
                index_remove = index;
                var new_latitude = data[index].location.latitude;
                var new_longitude = data[index].location.longitude;

            }
            
        }

        temp.cuaca = await getCuaca(temp.location.latitude, temp.location.longitude, temp.waktu, tanggal_wisata);

        temp.status = cekStatus(temp.jam_buka, temp.waktu);
        rute.push(otw);
        rute.push(temp);
        data.splice(index_remove, 1)
        jarak_max = 9999;
        latitude = new_latitude;
        longitude = new_longitude;
        jam_mulai = temp.jam_akhir;
        tempat_mulai = temp.nama;
        otw = {};
    }

    var jarak_akhir = await getJarak(latitude, longitude, latitude_akhir, longitude_akhir);
    var durasi_akhir =  jarak_akhir.rows[0].elements[0].duration.text;

    rute.push({
        tempat_mulai: tempat_mulai,
        tempat_finish: "Titik akhir",
        jam_mulai: jam_mulai,
        jam_akhir: hitungJam(jam_mulai, durasi_akhir),
        waktu: jam_mulai +" - "+ hitungJam(jam_mulai, durasi_akhir),
        nama: tempat_mulai +" - "+"Titik akhir",
    })
    
    // console.log(temp);
    response.ok(rute, res);
}

function ambil(kota) {
    return final_data.find({kota:kota}).sort({sentiment_score: -1}).exec();
}

function getById(id) {
    return final_data.find({_id:id}).exec();
}

function hitungJam(jam, durasi){
    jam = jam.split(":");
    durasi = durasi.split(" ");
    
    var hasil = {};
    if (durasi.length > 2) {
        var total_menit = (parseInt(durasi[0])*60) + parseInt(durasi[2]);
    }
    else if(durasi.length == 2) {
        if (durasi[1] == "mins") {
            var total_menit = parseInt(durasi[0]);
        }
        else {
            var total_menit = parseInt(durasi[0]) * 60;
        }
    }
    else if(durasi.length < 2) {
        
        var total_menit = parseInt(durasi[0]) * 60;
 
    }

    if (total_menit > 60) {
        var durasi_menit = total_menit % 60;
        var durasi_jam = (total_menit - durasi_menit) / 60;

        hasil.jam = parseInt(jam[0]) + durasi_jam;
        hasil.menit = parseInt(jam[1]) + durasi_menit;
        
        if (hasil.menit > 60) {
            hasil.jam = ((hasil.menit - (hasil.menit % 60)) / 60) + hasil.jam;
            hasil.menit = hasil.menit - 60;
        }

        if (hasil.jam < 10) {
            hasil.jam = "0"+hasil.jam;
        }

        if (hasil.menit < 10) {
            hasil.menit = "0"+hasil.menit;
        }

        hasil.text = hasil.jam+":"+hasil.menit;
    }

    else if(total_menit < 60) {
        hasil.jam = parseInt(jam[0]);
        hasil.menit = parseInt(jam[1]) + total_menit;
        
        if (hasil.menit > 60) {
            hasil.jam = ((hasil.menit - (hasil.menit % 60)) / 60) + hasil.jam;
            hasil.menit = hasil.menit - 60;
            // console.log(hasil);
        }

        if (hasil.jam < 10) {
            hasil.jam = "0"+hasil.jam;
        }

        if (hasil.menit < 10) {
            hasil.menit = "0"+hasil.menit;
        }

        hasil.text = hasil.jam+":"+hasil.menit;
    }

    else if(total_menit == 60) {
        hasil.jam = parseInt(jam[0]);
        hasil.menit = parseInt(jam[1]);
        
        hasil.jam = hasil.jam + 1;
            
        if (hasil.jam < 10) {
            hasil.jam = "0"+hasil.jam;
        }

        if (hasil.menit < 10) {
            hasil.menit = "0"+hasil.menit;
        }

        hasil.text = hasil.jam+":"+hasil.menit;
    }

    return hasil.text;
}

function cekStatus(data, waktu){
    var d = new Date();
    var today_value = d.getDay();
    var days = {
        Senin: 1,
        Selasa: 2,
        Rabu: 3,
        Kamis: 4,
        Jumat: 5,
        Sabtu: 6,
        Minggu: 0
    }

    for(var key in days){
        if (days[key] == today_value ) {
            var today = key;
        }
    }

    for(var hari in data){
        if (hari == today) {
            var jam_buka = data[hari];
        }
    }

    jam_buka = jam_buka.split("–");
    jam_buka[0] = parseInt(jam_buka[0]);
    jam_buka[1] = parseInt(jam_buka[1]);

    waktu = waktu.split(" - ");
    waktu[0] = parseInt(waktu[0]);
    waktu[1] = parseInt(waktu[1]);
    if (waktu[1] >= jam_buka[1] || waktu[0] < jam_buka[0]) {
        var status = "Tutup";
    }
    

    else if (waktu[1] < jam_buka[1] || waktu[0] >= jam_buka[0]) {
        var status = "Buka";
    }

    return status;
}

function getWheaterapi(latitude, longitude){
    var key = "81009d732d26d0e2ca070742855c6ad8";

    var options = {
        uri: "http://api.openweathermap.org/data/2.5/forecast?lat="+latitude+"&lon="+longitude+"&appid="+key,
        method: "GET",
        json: true
    }

    return request2(options);
}

async function getCuaca(latitude, longitude, waktu, tanggal_wisata){
    var cuaca_today = await getWheaterapi(latitude, longitude);
    waktu = waktu.split(" - ");
    waktu[0] = parseInt(waktu[0])
    waktu[1] = parseInt(waktu[1])
    // var datetime = new Date();
    var datetime = tanggal_wisata;
    // console.log(datetime)
    datetime = datetime.split("-");
    var date = datetime[2];
    var cuaca = "-";

    cuaca_today.list.forEach(function (item) {
        
        var x = item.dt_txt.split(" ");
        x[0] = x[0].split("-")
        x[1] = x[1].split(":")
        var tanggal = parseInt(x[0][2]);
        var jam = parseInt(x[1][0]);
        var jam2 = jam + 3;
        if (date == tanggal) {
            if (jam == waktu[0] || jam == waktu[1]) {
                cuaca = item.weather[0].main;
            }
            else if(jam < waktu[0] && jam+4 > waktu[0]){
                cuaca = item.weather[0].main;
            }
        }
    });

    return cuaca;
}

