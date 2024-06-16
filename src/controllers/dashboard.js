const CONF = require('../../config');

const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: CONF.S3_URL.accessKeyId,
  secretAccessKey: CONF.S3_URL.secretAccessKey,
  region: CONF.S3_URL.region,
});

const User = require('../models/user');
const Dashboard = require('../models/dashboard');

exports.updateTime = async (req, res) => {
  try {
    const { userId } = req.userData;
    console.log('userId =', userId);
    const user = await User.findById({ _id: userId });
    if (!user) {
      return res.json({
        code: 'USER_NOT_FOUND',
        message: 'user not Found',
      });
    }

    const dashboard = await Dashboard.findOne({ userId: userId }).sort({
      updatedAt: -1,
    });

    if (dashboard && dashboard.updatedAt) {
      return res.json({
        code: 'SUCCESS',
        updateTime: dashboard.updatedAt,
      });
    } else {
      return res.json({
        code: 'SUCCESS',
        updateTime: null,
      });
    }
  } catch (error) {
    return res.json({
      code: 'USER_INFO_ERROR',
      error,
    });
  }
};

exports.refreshData = async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await User.findById({ _id: userId });
    if (!user) {
      return res.json({
        code: 'USER_NOT_FOUND',
        message: 'user not Found',
      });
    }

    // 사용자가 연동한 계정정보 확인
    const fb_result = user.snsAccount.facebook.userSelectPage;

    const insta_result = user.snsAccount.instagram.userSelectAccount;
    const insta_page_result = user.snsAccount.instagram.userSelectPage;
    const insta_token_result = user.snsAccount.instagram.tokenInfo;

    const youtube_result = user.snsAccount.youtube.userSelectChannel;
    const youtube_token_result = user.snsAccount.youtube.tokenInfo;

    const tiktok_token_result = user.snsAccount.tiktok.tokenInfo;

    const lambda = new AWS.Lambda();

    // lambda 실행리스트 저장
    const invokeArr = [];

    // 페이스북 릴스 요청
    for (let item of fb_result) {
      item.userId = userId;
      const params = {
        FunctionName:
          'arn:aws:lambda:ap-northeast-2:358527653076:function:dashboard-facebook-request-reels',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(item),
      };
      invokeArr.push(lambda.invoke(params).promise());
    }

    // 페이스북 스토리 요청
    for (let item of fb_result) {
      item.userId = userId;
      const params = {
        FunctionName:
          'arn:aws:lambda:ap-northeast-2:358527653076:function:dashboard-facebook-request-stories',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(item),
      };
      invokeArr.push(lambda.invoke(params).promise());
    }

    // 인스타그램 릴스 요청
    for (let item of insta_result) {
      item.userId = userId;
      const pageSelect = insta_page_result.find((obj) => obj.id === item.id);
      item.pageInfo = pageSelect;
      item.tokenInfo = insta_token_result;
      const params = {
        FunctionName:
          'arn:aws:lambda:ap-northeast-2:358527653076:function:dashboard-instagram-request-reels',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(item),
      };
      invokeArr.push(lambda.invoke(params).promise());
    }

    // 인스타그램 스토리 요청
    for (let item of insta_result) {
      item.userId = userId;
      const pageSelect = insta_page_result.find((obj) => obj.id === item.id);
      item.pageInfo = pageSelect;
      item.tokenInfo = insta_token_result;
      const params = {
        FunctionName:
          'arn:aws:lambda:ap-northeast-2:358527653076:function:dashboard-instagram-request-stories',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(item),
      };
      invokeArr.push(lambda.invoke(params).promise());
    }

    // 틱톡 요청
    if (tiktok_token_result) {
      tiktok_token_result.userId = userId;
      const params = {
        FunctionName:
          'arn:aws:lambda:ap-northeast-2:358527653076:function:dashboard-tiktok-request',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(tiktok_token_result),
      };
      invokeArr.push(lambda.invoke(params).promise());
    }

    // youtube 요청
    for (let item of youtube_result) {
      const data = {};
      data.userId = userId;
      data.tokenInfo = youtube_token_result;
      data.channelInfo = item;
      const params = {
        FunctionName:
          'arn:aws:lambda:ap-northeast-2:358527653076:function:dashboard-youtube-request',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(data),
      };
      invokeArr.push(lambda.invoke(params).promise());
    }

    if (invokeArr.length > 0) {
      const results = await Promise.all(invokeArr);

      // 오류가 있었던 데이터 제외
      const bulkPosts = [];
      for (const item of results) {
        const temp = JSON.parse(item.Payload);
        if (temp.statusCode === 200) bulkPosts.push(...temp.body);
      }

      // bulkWrite 작업을 정의합니다.
      let bulkOps = bulkPosts.map((post) => ({
        updateOne: {
          filter: {
            userId: post.userId,
            postId: post.postId,
            provider: post.provider,
            media_type: post.media_type,
          },
          update: { $set: post },
          upsert: true,
        },
      }));

      const bulkResult = await Dashboard.bulkWrite(bulkOps);
    }

    return res.json({
      code: 'SUCCESS',
      // updateTime: dashboard,
    });
  } catch (error) {
    return res.json({
      code: 'USER_INFO_ERROR',
      error,
    });
  }
};

exports.interest = async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await User.findById({ _id: userId });
    if (!user) {
      return res.json({
        code: 'USER_NOT_FOUND',
        message: 'user not Found',
      });
    }

    const { provider, providerOption, term, sort } = req.query;
    if (!term) {
      return res.json({
        code: 'TERM_NOT_FOUND',
        message: 'term not Found',
      });
    }
    if (!sort) {
      return res.json({
        code: 'SORT_NOT_FOUND',
        message: 'sort not Found',
      });
    }

    // 필터링 쿼리 시작
    const query = {
      userId: userId,
    };

    const providerRe = provider.split(',');
    // 매체 필터링 포함
    if (providerRe && providerRe.length > 0) {
      query.provider = { $in: providerRe };
      query.$and = [{ $or: [] }];
    } else {
      return res.json({
        code: 'PROVIDER_NOT_FOUND',
        message: 'provider not Found',
      });
    }

    // facebook만 페이지 필터링 필요
    const facebookCheck = providerRe.includes('facebook');
    if (facebookCheck) {
      const providerOptionRe = providerOption.split(',');
      query.$and[0].$or.push({
        provider: 'facebook',
        facebookPageId: { $in: providerOptionRe },
      });
    }

    // 인스타그램
    const instagramCheck = providerRe.includes('instagram');
    if (instagramCheck) {
      let id;
      if (
        user.snsAccount &&
        user.snsAccount.instagram &&
        user.snsAccount.instagram.userSelectAccount &&
        user.snsAccount.instagram.userSelectAccount.length > 0 &&
        user.snsAccount.instagram.userSelectAccount[0]
          .instagram_business_account &&
        user.snsAccount.instagram.userSelectAccount[0]
          .instagram_business_account.id
      ) {
        id =
          user.snsAccount.instagram.userSelectAccount[0]
            .instagram_business_account.id;
      } else {
        id = '';
      }
      query.$and[0].$or.push({
        provider: 'instagram',
        instagramAccountId: { $in: id },
      });
    }

    // 유튜브
    const youtubeCheck = providerRe.includes('youtube');
    if (youtubeCheck) {
      let id;
      if (
        user.snsAccount &&
        user.snsAccount.youtube &&
        user.snsAccount.youtube.userSelectChannel &&
        user.snsAccount.youtube.userSelectChannel.length > 0 &&
        user.snsAccount.youtube.userSelectChannel[0].id
      ) {
        id = user.snsAccount.youtube.userSelectChannel[0].id;
      } else {
        id = '';
      }
      query.$and[0].$or.push({
        provider: 'youtube',
        youtubeChannelId: { $in: id },
      });
    }

    // 틱톡
    const tiktokCheck = providerRe.includes('tiktok');
    if (tiktokCheck) {
      let id;
      if (
        user.snsAccount &&
        user.snsAccount.tiktok &&
        user.snsAccount.tiktok.userInfo &&
        user.snsAccount.tiktok.userInfo.open_id
      ) {
        id = user.snsAccount.tiktok.userInfo.open_id;
      } else {
        id = '';
      }
      query.$and[0].$or.push({
        provider: 'tiktok',
        youtubeChannelId: { $in: id },
      });
    }

    // 해시태그 정렬 - 일단 전체 포스트에서 추출하여 정렬하기
    const tempArr = await Dashboard.find(query).select('hashtag');

    const countMap = {};
    tempArr.forEach((obj) => {
      // 각 객체의 hashtag 배열을 순회합니다.
      obj.hashtag.forEach((tag) => {
        // 해당 태그가 countMap에 이미 존재하는 경우 카운트를 증가시키고, 그렇지 않은 경우 새로운 항목을 추가합니다.
        if (countMap[tag]) {
          countMap[tag]++;
        } else {
          countMap[tag] = 1;
        }
      });
    });
    // countMap을 원하는 형태의 배열로 변환합니다.
    const hashResult = Object.keys(countMap).map((tag) => {
      return { tag: tag, count: countMap[tag] };
    });
    // 결과 배열을 카운트가 높은 순으로 정렬합니다.
    hashResult.sort((a, b) => b.count - a.count);
    // 상위 20개의 항목만 저장합니다.
    const hashRes = hashResult.slice(0, 20);

    // 인기있는 게시물 추출
    // 필터링 쿼리 시작
    const query1 = {
      userId: userId,
    };

    // 매체 필터링 포함
    if (providerRe && providerRe.length > 0) {
      query1.provider = { $in: providerRe };
      query1.$and = [{ $or: [] }];
    }

    // facebook만 페이지 필터링 필요
    if (facebookCheck) {
      const providerOptionRe = providerOption.split(',');
      query1.$and[0].$or.push({
        provider: 'facebook',
        facebookPageId: { $in: providerOptionRe },
      });
    }

    // 인스타그램
    if (instagramCheck) {
      let id;
      if (
        user.snsAccount &&
        user.snsAccount.instagram &&
        user.snsAccount.instagram.userSelectAccount &&
        user.snsAccount.instagram.userSelectAccount.length > 0 &&
        user.snsAccount.instagram.userSelectAccount[0]
          .instagram_business_account &&
        user.snsAccount.instagram.userSelectAccount[0]
          .instagram_business_account.id
      ) {
        id =
          user.snsAccount.instagram.userSelectAccount[0]
            .instagram_business_account.id;
      } else {
        id = '';
      }
      query1.$and[0].$or.push({
        provider: 'instagram',
        instagramAccountId: { $in: id },
      });
    }

    // 유튜브
    if (youtubeCheck) {
      let id;
      if (
        user.snsAccount &&
        user.snsAccount.youtube &&
        user.snsAccount.youtube.userSelectChannel &&
        user.snsAccount.youtube.userSelectChannel.length > 0 &&
        user.snsAccount.youtube.userSelectChannel[0].id
      ) {
        id = user.snsAccount.youtube.userSelectChannel[0].id;
      } else {
        id = '';
      }
      query1.$and[0].$or.push({
        provider: 'youtube',
        youtubeChannelId: { $in: id },
      });
    }

    // 틱톡
    if (tiktokCheck) {
      let id;
      if (
        user.snsAccount &&
        user.snsAccount.tiktok &&
        user.snsAccount.tiktok.userInfo &&
        user.snsAccount.tiktok.userInfo.open_id
      ) {
        id = user.snsAccount.tiktok.userInfo.open_id;
      } else {
        id = '';
      }
      query1.$and[0].$or.push({
        provider: 'tiktok',
        youtubeChannelId: { $in: id },
      });
    }

    // 기간 필터링 포함
    let now = new Date();
    now.setDate(now.getDate() - 30); // 30일 전 날짜를 구합니다.
    if (term === 'recent') query1.uploadDate = { $gte: now };

    // sort 처리
    const sortData = {};
    sortData[sort] = -1;
    const tempArr1 = await Dashboard.find(query1).sort(sortData).limit(10);

    // 필요한 필드만
    const postResult = tempArr1.map((obj) => {
      const newObj = {};
      newObj._id = obj.id;
      newObj.provider = obj.provider;
      newObj.title = obj.title;
      newObj.thumbnailUrl = obj.thumbnailUrl;
      newObj.view = obj.view;
      newObj.like = obj.like;
      newObj.comment = obj.comment;
      newObj.share = obj.share;
      newObj.shortcutUrl = obj.shortcutUrl;
      newObj.playTime = obj.playTime;
      return newObj;
    });

    return res.json({
      code: 'SUCCESS',
      post: postResult,
      hashtag: hashRes,
    });
  } catch (error) {
    return res.json({
      code: 'USER_INFO_ERROR',
      error,
    });
  }
};

exports.allposts = async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await User.findById({ _id: userId });
    if (!user) {
      return res.json({
        code: 'USER_NOT_FOUND',
        message: 'user not Found',
      });
    }

    let { page, limit, provider, providerOption, sortField, sort } = req.query;
    // field 가 없는 경우 기본값 처리
    if (!page) page = 1;
    if (!limit) limit = 20;
    if (!sortField) sortField = 'uploadDate';
    if (!sort) sort = 'desc';

    // 몽고db page 처리 설정
    const myCustomLabels = {
      totalDocs: 'resultTotalCount',
      docs: 'result',
      limit: 'NumberPerPage',
      page: 'currentPage',
      nextPage: 'next',
      prevPage: 'prev',
      totalPages: 'pageCount',
      hasPrevPage: 'hasPrev',
      hasNextPage: 'hasNext',
      pagingCounter: 'pageCounter',
    };

    // 정렬처리
    const sortObject = {};
    if (sort === 'asc') {
      sortObject[sortField] = 1;
    } else {
      sortObject[sortField] = -1;
    }

    const options = {
      page: page && !isNaN(page) ? parseInt(page) : 1,
      limit: limit && !isNaN(limit) ? parseInt(limit) : 20,
      sort: sortObject,
      customLabels: myCustomLabels,
    };

    // 필터링 쿼리 시작
    const query = {
      userId: userId,
    };

    const providerRe = provider.split(',');
    // 매체 필터링 포함
    if (providerRe && providerRe.length > 0) {
      query.provider = { $in: providerRe };
      query.$and = [{ $or: [] }];
    } else {
      return res.json({
        code: 'PROVIDER_NOT_FOUND',
        message: 'provider not Found',
      });
    }

    // facebook만 페이지 필터링 필요
    const facebookCheck = providerRe.includes('facebook');
    if (facebookCheck) {
      const providerOptionRe = providerOption.split(',');
      query.$and[0].$or.push({
        provider: 'facebook',
        facebookPageId: { $in: providerOptionRe },
      });
    }

    // 인스타그램
    const instagramCheck = providerRe.includes('instagram');
    if (instagramCheck) {
      let id;
      if (
        user.snsAccount &&
        user.snsAccount.instagram &&
        user.snsAccount.instagram.userSelectAccount &&
        user.snsAccount.instagram.userSelectAccount.length > 0 &&
        user.snsAccount.instagram.userSelectAccount[0]
          .instagram_business_account &&
        user.snsAccount.instagram.userSelectAccount[0]
          .instagram_business_account.id
      ) {
        id =
          user.snsAccount.instagram.userSelectAccount[0]
            .instagram_business_account.id;
      } else {
        id = '';
      }
      query.$and[0].$or.push({
        provider: 'instagram',
        instagramAccountId: { $in: id },
      });
    }

    // 유튜브
    const youtubeCheck = providerRe.includes('youtube');
    if (youtubeCheck) {
      let id;
      if (
        user.snsAccount &&
        user.snsAccount.youtube &&
        user.snsAccount.youtube.userSelectChannel &&
        user.snsAccount.youtube.userSelectChannel.length > 0 &&
        user.snsAccount.youtube.userSelectChannel[0].id
      ) {
        id = user.snsAccount.youtube.userSelectChannel[0].id;
      } else {
        id = '';
      }
      query.$and[0].$or.push({
        provider: 'youtube',
        youtubeChannelId: { $in: id },
      });
    }

    // 틱톡
    const tiktokCheck = providerRe.includes('tiktok');
    if (tiktokCheck) {
      let id;
      if (
        user.snsAccount &&
        user.snsAccount.tiktok &&
        user.snsAccount.tiktok.userInfo &&
        user.snsAccount.tiktok.userInfo.open_id
      ) {
        id = user.snsAccount.tiktok.userInfo.open_id;
      } else {
        id = '';
      }
      query.$and[0].$or.push({
        provider: 'tiktok',
        youtubeChannelId: { $in: id },
      });
    }
    console.log('allposts > query =', query);

    await Dashboard.paginate(query, options, (err, data) => {
      if (err) {
        throw { errMsg: 'FOLDER_PAGING_QUERY_ERROR', code: 500 };
      }
      // 필요한 필드만
      const dataResult = data.result.map((obj) => {
        // console.log('allposts > obj =', obj);
        const newObj = {};
        newObj._id = obj.id;
        newObj.thumbnailUrl = obj.thumbnailUrl;
        newObj.title = obj.title;
        newObj.shortcutUrl = obj.shortcutUrl;
        newObj.provider = obj.provider;
        newObj.reach = obj.reach;
        newObj.view = obj.view;
        newObj.like = obj.like;
        newObj.hate = obj.hate;
        newObj.comment = obj.comment;
        newObj.share = obj.share;
        newObj.saved = obj.saved;
        newObj.averageViewTime = obj.averageViewTime;
        newObj.totalViewTime = obj.totalViewTime;
        newObj.playTime = obj.playTime;
        newObj.uploadDate = obj.uploadDate;
        return newObj;
      });
      return res.json({
        code: 'SUCCESS',
        result: dataResult,
        resultTotalCount: data.resultTotalCount,
        NumberPerPage: data.NumberPerPage,
        currentPage: data.currentPage,
        pageCount: data.pageCount,
        pageCounter: data.pageCounter,
        hasPrev: data.hasPrev,
        hasNext: data.hasNext,
        prev: data.prev,
        next: data.next,
      });
    });
  } catch (error) {
    console.error(error);
    return res.json({
      code: 'USER_INFO_ERROR',
      error,
    });
  }
};
