const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const prePlatformRequestSchema = mongoose.Schema(
  {
    // _id: {
    //   type: String,
    //   required: true,
    // },
    platform: {
      type: String,
      required: true,
    },
    // 유저 아이디
    userId: {
      type: String,
      required: true,
    },
  },
  {
    versionKey: false,
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
  },
);

prePlatformRequestSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('prePlatformRequest', prePlatformRequestSchema);
