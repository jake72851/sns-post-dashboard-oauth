const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const prePlatformSchema = mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    platform: {
      type: String,
      required: true,
    },
    count: {
      type: Number,
      default: 0,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    versionKey: false,
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

prePlatformSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('prePlatform', prePlatformSchema);
