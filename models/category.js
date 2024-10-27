const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    logo: {
        type: String,  // URL or path to the logo
        required: true
    }
});

module.exports = mongoose.model('Category', CategorySchema);
