const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please add a valid email",
      ],
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ["collector", "artist", "professional", "admin"],
      default: "collector",
    },
    country: {
      type: String,
      trim: true,
    },
    telephone: {
      type: String,
      trim: true,
    },
    profileCompleted: {
      type: Boolean,
      default: false,
    },
    firstLogin: {
      type: Date,
      default: Date.now,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true, // utile pour les tris récents
    },
    likedArtworks : [{
      type : mongoose.Schema.Types.ObjectId,
      ref : "Artwork",
      unique: true
    }]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual populate for reviews
userSchema.virtual("artworks", {
  ref: "Artwork",
  localField: "_id",
  foreignField: "ownerId",
  justOne: false,
});

userSchema.virtual("sold", {
  ref: "Transaction",
  localField: "_id",
  foreignField: "sellerId",
  justOne: false,
});

userSchema.virtual("buyed", {
  ref: "Transaction",
  localField: "_id",
  foreignField: "buyerId",
  justOne: false,
});

userSchema.virtual("reviewed", {
  ref: "Review",
  localField: "_id",
  foreignField: "professionalrId",
  justOne: false,
});

// Create indexes for frequently queried fields
userSchema.index({ role: 1 });

module.exports = mongoose.model("User", userSchema);
