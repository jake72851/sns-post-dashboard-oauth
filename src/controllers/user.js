const CONF = require('../../config');
const qs = require('qs');
const { google } = require('googleapis');
const AWS = require('aws-sdk');
AWS.config.update({
  accessKeyId: CONF.S3_URL.accessKeyId,
  secretAccessKey: CONF.S3_URL.secretAccessKey,
  region: CONF.S3_URL.region,
});
const axios = require('axios');

const User = require('../models/user');
const PrePlatform = require('../models/prePlatform');
const PrePlatformRequest = require('../models/prePlatformRequest');

const TIKTOK_REDIRECT_URL =
  process.env.NODE_ENV == 'production'
    ? CONF.TIKTOK_REDIRECT_URL_PROD
    : CONF.TIKTOK_REDIRECT_URL;

const FACEBOOK_REDIRECT_URL =
  process.env.NODE_ENV == 'production'
    ? CONF.FACEBOOK_REDIRECT_URL_PROD
    : CONF.FACEBOOK_REDIRECT_URL;

//sns 계정연동
async function facebook(code, userId, type) {
  const user = await User.findById({ _id: userId });

  const url = CONF.FACEBOOK_API_URL + 'oauth/access_token';
  const data = {
    client_id: CONF.FACEBOOK_CLIENT_ID,
    client_secret: CONF.FACEBOOK_CLIENT_SECRET,
    code: code,
    redirect_uri: FACEBOOK_REDIRECT_URL,
    // redirect_uri: CONF.FACEBOOK_REDIRECT_URL,
  };
  const headers = {};
  const result = await axios.post(url, data, { headers });

  //페이스북 사용자 장기 엑세스 토큰 요청
  const apiUrl =
    CONF.FACEBOOK_API_URL +
    'oauth/access_token?grant_type=fb_exchange_token' +
    '&client_id=' +
    CONF.FACEBOOK_CLIENT_ID +
    '&client_secret=' +
    CONF.FACEBOOK_CLIENT_SECRET +
    '&fb_exchange_token=' +
    result.data.access_token;
  const tokenResult = await axios.get(apiUrl);

  // 토큰 디버깅 - 재 로그인시 만료일자가 없어서 추가
  const debugUrl =
    CONF.FACEBOOK_API_URL +
    'debug_token?input_token=' +
    tokenResult.data.access_token +
    '&access_token=' +
    CONF.FACEBOOK_APP_TOKEN;
  const debugResult = await axios.get(debugUrl);

  // 권한 부족시 오류 처리
  const resultPermission = debugResult.data.data.scopes;
  if (type === 'facebook') {
    const permissionCheck = CONF.FACEBOOK_PERMISSION.every((item) =>
      resultPermission.includes(item),
    );
    if (!permissionCheck) throw 'FACEBOOK_PERMISSION_NOT_ENOUGH';
  } else {
    const permissionCheck = CONF.INSTAGRAM_PERMISSION.every((item) =>
      resultPermission.includes(item),
    );
    if (!permissionCheck) throw 'INSTAGRAM_PERMISSION_NOT_ENOUGH';
  }

  //사용자 정보 확인
  const userUrl =
    CONF.FACEBOOK_API_URL +
    'me?fields=id,name' +
    '&access_token=' +
    tokenResult.data.access_token;
  const userResult = await axios.get(userUrl);

  // 페이스북 페이지 정보 요청
  const pageUrl =
    CONF.FACEBOOK_API_URL +
    userResult.data.id +
    '/accounts' +
    '?access_token=' +
    tokenResult.data.access_token;
  const pageResult = await axios.get(pageUrl);

  // 인스타그램 정보 요청 - 페이스북 페이지 정보가 있고 인스타그램 권한을 받았을때만 처리
  const checkPermission = debugResult.data.data.scopes.find(
    (item) => item === 'instagram_basic',
  );
  const instagramAccount = [];
  if (
    pageResult.data.data.length > 0 &&
    checkPermission === 'instagram_basic'
  ) {
    for (const item of pageResult.data.data) {
      const url =
        CONF.FACEBOOK_API_URL +
        item.id +
        '?fields=instagram_business_account{id,username}' +
        '&access_token=' +
        tokenResult.data.access_token;
      const result = await axios.get(url);
      if (result.data.instagram_business_account)
        instagramAccount.push(result.data);
    }
  }

  // 페북과 인스타는 동일 엑세스 토큰을 사용하므로 사용자 계정이 같다면 페북 인스타 토큰 정보를 모두 업데이트 한다
  if (type === 'facebook') {
    // 1. 페이스북 시작
    user.snsAccount.facebook.tokenInfo = tokenResult.data;
    user.snsAccount.facebook.tokenDebugInfo = debugResult.data.data;
    user.snsAccount.facebook.userInfo = userResult.data;
    user.snsAccount.facebook.pageInfo = pageResult.data.data;
    user.snsAccount.facebook.userSelectPage = []; // 사용자 선택 페이지 초기화
    // 인스타그램 정보도 확인
    if (
      user.snsAccount.instagram &&
      user.snsAccount.instagram.userInfo &&
      user.snsAccount.instagram.userInfo.id &&
      user.snsAccount.instagram.userInfo.id === userResult.data.id
    ) {
      user.snsAccount.instagram.tokenInfo = tokenResult.data;
      user.snsAccount.instagram.tokenDebugInfo = debugResult.data.data;
      user.snsAccount.instagram.userInfo = userResult.data;
      user.snsAccount.instagram.pageInfo = pageResult.data.data;
      user.snsAccount.instagram.accountInfo = instagramAccount;
      // 사용자 선택 페이지 정보가 있다면 업데이트
      if (user.snsAccount.instagram.userSelectPage.length > 0) {
        const result = user.snsAccount.instagram.pageInfo.filter((pageItem) =>
          user.snsAccount.instagram.userSelectPage.some(
            (item) => item.id === pageItem.id,
          ),
        );
        user.snsAccount.instagram.userSelectPage = result;
      }
    }
  } else {
    // 2. 인스타그램 시작
    user.snsAccount.instagram.tokenInfo = tokenResult.data;
    user.snsAccount.instagram.tokenDebugInfo = debugResult.data.data;
    user.snsAccount.instagram.userInfo = userResult.data;
    user.snsAccount.instagram.pageInfo = pageResult.data.data;
    user.snsAccount.instagram.accountInfo = instagramAccount;
    user.snsAccount.instagram.userSelectPage = []; // 사용자 선택 페이지 초기화
    user.snsAccount.instagram.userSelectAccount = []; // 사용자 선택 계정 초기화
    // 페이스북 정보도 확인
    if (
      user.snsAccount.facebook &&
      user.snsAccount.facebook.userInfo &&
      user.snsAccount.facebook.userInfo.id &&
      user.snsAccount.facebook.userInfo.id === userResult.data.id
    ) {
      user.snsAccount.facebook.tokenInfo = tokenResult.data;
      user.snsAccount.facebook.tokenDebugInfo = debugResult.data.data;
      user.snsAccount.facebook.userInfo = userResult.data;
      user.snsAccount.facebook.pageInfo = pageResult.data.data;
      // 사용자 선택 페이지 정보가 있다면 업데이트
      if (user.snsAccount.facebook.userSelectPage.length > 0) {
        const result = user.snsAccount.facebook.pageInfo.filter((pageItem) =>
          user.snsAccount.facebook.userSelectPage.some(
            (item) => item.id === pageItem.id,
          ),
        );
        user.snsAccount.facebook.userSelectPage = result;
      }
    }
  }

  const saveResult = await user.save();

  const response = [];
  if (type === 'facebook') {
    const idName = pageResult.data.data.map((obj) => {
      return {
        id: obj.id,
        name: obj.name,
      };
    });
    response.push(...idName);
  } else {
    const idName = instagramAccount.map((obj) => {
      return {
        id: obj.instagram_business_account.id,
        name: obj.instagram_business_account.username,
      };
    });
    response.push(...idName);
  }

  return response;
}
async function tiktok(code, userId) {
  const user = await User.findById({ _id: userId });

  // 토큰정보 요청
  const decode = decodeURI(code);
  const tokenEndpoint = CONF.TIKTOK_API_URL + '/oauth/token/';
  const data = qs.stringify({
    client_key: CONF.TIKTOK_CLIENT_KEY,
    client_secret: CONF.TIKTOK_CLIENT_SECRET,
    code: decode,
    grant_type: 'authorization_code',
    redirect_uri: TIKTOK_REDIRECT_URL,
    // redirect_uri: CONF.TIKTOK_REDIRECT_URL,
  });
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Cache-Control': 'no-cache',
  };
  const result = await axios.post(tokenEndpoint, data, { headers });

  // 권한 부족시 오류 처리
  const resultPermission = result.data.scope;
  const permissionArray = resultPermission.split(',');
  const permissionCheck = CONF.TIKTOK_PERMISSION.every((item) =>
    permissionArray.includes(item),
  );
  if (!permissionCheck) throw 'TIKTOK_PERMISSION_NOT_ENOUGH';

  // 토큰 만료 시간 확인을 위한 등록날짜 추가
  result.data.expires_createdAt = new Date();

  // 계정정보 요청
  const axiosConfig = {
    headers: {
      Authorization: `Bearer ${result.data.access_token}`,
      'Content-Type': 'application/json',
    },
  };
  const result2 = await axios.get(
    CONF.TIKTOK_API_URL +
      '/user/info/?fields=open_id,union_id,avatar_url,display_name',
    axiosConfig,
  );

  // 엑세스 토큰 저장
  user.snsAccount.tiktok.tokenInfo = result.data;
  user.snsAccount.tiktok.userInfo = result2.data.data.user;
  await user.save();

  const response = {};
  response.id = user.snsAccount.tiktok.userInfo.open_id;
  response.name = user.snsAccount.tiktok.userInfo.display_name;

  return [response];
}
async function youtube(code, userId) {
  const user = await User.findById({ _id: userId });

  const oauth2Client = new google.auth.OAuth2(
    CONF.YOUTUBE_CLIENT_ID, // Google Cloud에서 생성한 OAuth 2.0 클라이언트 ID
    CONF.YOUTUBE_CLIENT_SECRET, // 클라이언트 시크릿
    CONF.YOUTUBE_REDIRECT_URL, // 리다이렉트 url
  );

  const codeResult = await oauth2Client.getToken(code);

  // 권한 부족시 오류 처리
  const resultPermission = codeResult.tokens.scope;
  const permissionArray = resultPermission.split(' ');
  const permissionCheck = CONF.YOUTUBE_PERMISSION.every((item) =>
    permissionArray.includes(item),
  );
  if (!permissionCheck) throw 'YOUTUBE_PERMISSION_NOT_ENOUGH';

  oauth2Client.setCredentials({
    access_token: codeResult.tokens.access_token,
    refresh_token: codeResult.tokens.refresh_token, // refresh_token은 최초 앱 설치시에만 한번만 확인 가능함
  });

  // 사용자 정보
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const userInfo = await oauth2.userinfo.get();
  const youtube = google.youtube({
    version: 'v3',
    auth: oauth2Client,
  });
  // 사용자의 유튜브 채널 정보를 가져오는 함수
  const channelResult = await youtube.channels.list({
    part: 'snippet,contentDetails,statistics',
    mine: true, // 인증된 사용자의 채널 정보를 요청
  });
  const channelInfo = channelResult.data.items;

  if (channelInfo) {
    // 토큰, 사용자 정보만 우선 저장. 채널은 프론트에서 선택후 저장
    user.snsAccount.youtube.tokenInfo = codeResult.tokens;
    user.snsAccount.youtube.userInfo = userInfo.data;
    user.snsAccount.youtube.channelInfo = channelInfo;
  } else {
    // 토큰, 사용자 정보만 우선 저장. 채널은 프론트에서 선택후 저장
    user.snsAccount.youtube.tokenInfo = codeResult.tokens;
    user.snsAccount.youtube.userInfo = userInfo.data;
  }
  await user.save();

  const response = [];
  if (channelInfo) {
    const idName = channelInfo.map((obj) => {
      return {
        id: obj.id,
        name: obj.snippet.customUrl,
      };
    });
    response.push(...idName);
  }

  return response;
}
exports.snsAccountList = async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await User.findById({ _id: userId });
    if (!user) {
      return res.json({
        code: 'USER_NOT_FOUND',
        message: 'user not Found',
      });
    }

    const response = {};
    if (
      user.snsAccount.facebook.userSelectPage &&
      user.snsAccount.facebook.userSelectPage.length > 0
    ) {
      response.facebook = [];
      const result = user.snsAccount.facebook.userSelectPage.map((obj) => {
        return {
          id: obj.id,
          name: obj.name,
        };
      });
      response.facebook.push(...result);
    }

    if (
      user.snsAccount.instagram.userSelectAccount &&
      user.snsAccount.instagram.userSelectAccount.length > 0
    ) {
      response.instagram = [];
      const result = user.snsAccount.instagram.userSelectAccount.map((obj) => {
        return {
          id: obj.instagram_business_account.id,
          name: obj.instagram_business_account.username,
        };
      });
      response.instagram.push(...result);
    }

    if (
      user.snsAccount.youtube.userSelectChannel &&
      user.snsAccount.youtube.userSelectChannel.length > 0
    ) {
      response.youtube = [];
      const result = user.snsAccount.youtube.userSelectChannel.map((obj) => {
        return {
          id: obj.id,
          name: obj.snippet.customUrl,
        };
      });
      response.youtube.push(...result);
    }

    if (user.snsAccount.tiktok.userInfo) {
      response.tiktok = [];
      const result = {
        id: user.snsAccount.tiktok.userInfo.open_id,
        name: user.snsAccount.tiktok.userInfo.display_name,
      };
      response.tiktok.push(result);
    }

    return res.json({
      code: 'SUCCESS',
      data: response,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      code: 'USER_INFO_ERROR',
      error,
    });
  }
};
exports.snsAccountLink = async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await User.findById({ _id: userId });
    if (!user) {
      return res.json({
        code: 'USER_NOT_FOUND',
        message: 'user not Found',
      });
    }
    // console.error('user =', user)

    const { type, code } = req.body;
    if (!type) throw 'SNS_TYPE_NOT_DEFINED';
    if (!code) throw 'SNS_CODE_NOT_DEFINED';

    let response;
    if (type === 'facebook') response = await facebook(code, userId, type);
    if (type === 'instagram') response = await facebook(code, userId, type);
    if (type === 'youtube') response = await youtube(code, userId);
    if (type === 'tiktok') response = await tiktok(code, userId);

    return res.json({
      code: 'SUCCESS',
      data: response,
    });
  } catch (error) {
    let code = 'USER_INFO_ERROR';
    if (error === 'YOUTUBE_PERMISSION_NOT_ENOUGH') {
      code = 'YOUTUBE_PERMISSION_NOT_ENOUGH';
    } else if (error === 'FACEBOOK_PERMISSION_NOT_ENOUGH') {
      code = 'FACEBOOK_PERMISSION_NOT_ENOUGH';
    } else if (error === 'INSTAGRAM_PERMISSION_NOT_ENOUGH') {
      code = 'INSTAGRAM_PERMISSION_NOT_ENOUGH';
    } else if (error === 'TIKTOK_PERMISSION_NOT_ENOUGH') {
      code = 'TIKTOK_PERMISSION_NOT_ENOUGH';
    }
    return res.json({
      code: code,
      error,
    });
  }
};
exports.snsAccountDelete = async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await User.findById({ _id: userId });
    if (!user) {
      return res.json({
        code: 'USER_NOT_FOUND',
        message: 'user not Found',
      });
    }

    const { type } = req.body;
    if (!type) throw 'SNS_TYPE_NOT_DEFINED';

    if (
      type === 'facebook' &&
      user.snsAccount.facebook.userSelectPage &&
      user.snsAccount.facebook.userSelectPage.length > 0
    ) {
      user.snsAccount.facebook.userSelectPage = [];
    }

    if (
      type === 'instagram' &&
      user.snsAccount.instagram.userSelectAccount &&
      user.snsAccount.instagram.userSelectAccount.length > 0
    ) {
      user.snsAccount.instagram.userSelectAccount = [];
      user.snsAccount.instagram.userSelectPage = [];
    }

    if (
      type === 'youtube' &&
      user.snsAccount.youtube.userSelectChannel &&
      user.snsAccount.youtube.userSelectChannel.length > 0
    ) {
      user.snsAccount.youtube.userSelectChannel = [];
    }

    if (type === 'tiktok' && user.snsAccount.tiktok) {
      // 앱 초기화
      if (
        user.snsAccount.tiktok.tokenInfo &&
        user.snsAccount.tiktok.tokenInfo.access_token
      ) {
        const tokenEndpoint = CONF.TIKTOK_API_URL + '/oauth/revoke/';
        const data = qs.stringify({
          client_key: CONF.TIKTOK_CLIENT_KEY,
          client_secret: CONF.TIKTOK_CLIENT_SECRET,
          token: user.snsAccount.tiktok.tokenInfo.access_token,
        });
        const headers = {
          'Content-Type': 'application/x-www-form-urlencoded',
          // 'Cache-Control': 'no-cache',
        };
        const result = await axios.post(tokenEndpoint, data, { headers });
      }

      // aws cloud watch scheduling delete
      const lambda = new AWS.Lambda();
      const params = {
        FunctionName: 'token-refresh-scheduling',
        Payload: JSON.stringify({
          action: 'delete',
          data: {
            type: 'tiktok',
            userId: userId,
          },
        }),
      };
      const invokeResult = await lambda.invoke(params).promise();

      user.snsAccount.tiktok = {};
    }

    await user.save();

    return res.json({
      code: 'SUCCESS',
    });
  } catch (error) {
    console.error(error);
    return res.json({
      code: 'USER_INFO_ERROR',
      error,
    });
  }
};
exports.snsAccountUser = async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await User.findById({ _id: userId });
    if (!user) {
      return res.json({
        code: 'USER_NOT_FOUND',
        message: 'user not Found',
      });
    }

    const { type, data } = req.body;
    if (!type) throw 'SNS_TYPE_NOT_DEFINED';
    if (!data) throw 'DATA_NOT_DEFINED';

    if (type === 'facebook') {
      const result = user.snsAccount.facebook.pageInfo.filter((pageItem) =>
        data.includes(pageItem.id),
      );
      user.snsAccount.facebook.userSelectPage = result;
    }
    if (type === 'instagram') {
      const result = user.snsAccount.instagram.accountInfo.filter((item) =>
        data.includes(item.instagram_business_account.id),
      );
      user.snsAccount.instagram.userSelectAccount = result;
      const result2 = user.snsAccount.instagram.pageInfo.filter((pageItem) =>
        result.some((item) => item.id === pageItem.id),
      );
      user.snsAccount.instagram.userSelectPage = result2;
    }
    if (type === 'youtube') {
      const result = user.snsAccount.youtube.channelInfo.filter((item) =>
        data.includes(item.id),
      );
      user.snsAccount.youtube.userSelectChannel = result;
    }

    await user.save();

    return res.json({
      code: 'SUCCESS',
    });
  } catch (error) {
    console.error(error);
    return res.json({
      code: 'USER_INFO_ERROR',
      error,
    });
  }
};

// 사용자 플랫폼 요청 현황
exports.prePlatformList = async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await User.findById({ _id: userId });
    if (!user) {
      return res.json({
        code: 'USER_NOT_FOUND',
        message: 'user not Found',
      });
    }

    const platformResult = await PrePlatform.find({ status: true });

    const result = platformResult.map((item) => {
      const check = user.prePlatform.find((id) => id === item._id);
      if (check) {
        return {
          id: item._id,
          name: item.platform,
          status: true,
        };
      } else {
        return {
          id: item._id,
          name: item.platform,
          status: false,
        };
      }
    });

    return res.json({
      code: 'SUCCESS',
      data: result,
    });
  } catch (error) {
    console.error(error);
    return res.json({
      code: 'USER_INFO_ERROR',
      error,
    });
  }
};
exports.prePlatformPost = async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await User.findById({ _id: userId });
    if (!user) {
      return res.json({
        code: 'USER_NOT_FOUND',
        message: 'user not Found',
      });
    }

    const { data } = req.body;
    if (!data) throw 'DATA_NOT_DEFINED';

    const prePlatformRequest = new PrePlatformRequest({
      platform: data,
      userId: userId,
    });
    await prePlatformRequest.save();

    return res.json({
      code: 'SUCCESS',
    });
  } catch (error) {
    console.error(error);
    return res.json({
      code: 'USER_INFO_ERROR',
      error,
    });
  }
};
exports.prePlatformPatch = async (req, res) => {
  try {
    const { userId } = req.userData;
    const user = await User.findById({ _id: userId });
    if (!user) {
      return res.json({
        code: 'USER_NOT_FOUND',
        message: 'user not Found',
      });
    }

    const { id } = req.body;
    if (!id) throw 'PLATFORM_ID_NOT_DEFINED';

    const platformResult = await PrePlatform.findById({ _id: id });
    platformResult.count += 1;
    await platformResult.save();

    user.prePlatform.push(id);
    await user.save();

    return res.json({
      code: 'SUCCESS',
    });
  } catch (error) {
    console.error(error);
    return res.json({
      code: 'USER_INFO_ERROR',
      error,
    });
  }
};
