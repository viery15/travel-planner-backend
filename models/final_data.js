const mongoose = require('mongoose');

const final_dataSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    tempat: String,
    alamat: String,
    kota: String,
    jam_buka: Object,
    kategori: Array,
    location: Object,
    review: Array,
    sentiment_score: String,
    url: String
});

module.exports = mongoose.model('final_data', final_dataSchema);