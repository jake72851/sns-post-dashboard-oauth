const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const dashboardSchema = mongoose.Schema(
  {
    // 게시물 아이디
    postId: {
      type: String,
      required: true,
    },
    // 유저 아이디
    userId: {
      type: String,
      required: true,
    },

    // 매체별 계정 정보
    facebookPageId: {
      type: String,
    },
    instagramAccountId: {
      type: String,
    },
    youtubeChannelId: {
      type: String,
    },
    tiktokAccountId: {
      // tokenInfo open_id
      type: String,
    },

    thumbnailUrl: {
      type: String,
    },
    title: {
      type: String,
    },
    shortcutUrl: {
      type: String,
    },
    provider: {
      type: String,
    },
    media_type: {
      type: String,
    },
    reach: {
      type: Number,
    },
    view: {
      type: Number,
    },
    like: {
      type: Number,
    },
    hate: {
      type: Number,
    },
    comment: {
      type: Number,
    },
    share: {
      type: Number,
    },
    saved: {
      type: Number,
    },
    averageViewTime: {
      type: Number,
    },
    totalViewTime: {
      type: Number,
    },
    playTime: {
      type: Number,
    },
    uploadDate: {
      type: Date,
    },
    hashtag: {
      type: Array,
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

dashboardSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('dashboard', dashboardSchema);
