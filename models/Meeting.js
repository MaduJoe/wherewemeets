const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    location: {
      address: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    preferences: {
      categories: [String],
      maxDistance: Number,
      transportMode: String
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'declined'],
      default: 'pending'
    }
  }],
  suggestedLocations: [{
    name: String,
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    category: String,
    rating: Number,
    priceLevel: Number,
    travelTimes: [{
      participantId: mongoose.Schema.Types.ObjectId,
      duration: Number, // minutes
      distance: Number, // meters
      mode: String
    }],
    score: Number, // 추천 점수
    googlePlaceId: String
  }],
  selectedLocation: {
    name: String,
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    googlePlaceId: String
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['planning', 'confirmed', 'completed', 'cancelled'],
    default: 'planning'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Meeting', MeetingSchema); 