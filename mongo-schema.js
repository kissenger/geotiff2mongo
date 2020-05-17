
const mongoose = require('mongoose');

const elevationsSchema = mongoose.Schema({

  // creationDate: {type: Date, default: Date.now},
  elevation: {type: Number, required: true},
  position: {
    type: {type: String},
    coordinates: {type: [Number]}
  }

})

const ElevationsModel = mongoose.model('elevations', elevationsSchema);

module.exports = {
  ElevationsModel
}