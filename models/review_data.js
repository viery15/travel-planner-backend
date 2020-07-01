const mongoose = require('mongoose');

const review_dataSchema = mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    informasi: Object,
    kategori: String,
    location: Object,
    reviews: Array
}, { collection : 'review_data' });

module.exports = mongoose.model('review_data', review_dataSchema);