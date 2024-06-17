import { google } from 'googleapis';
import AWS from 'aws-sdk';
const lambda = new AWS.Lambda();

const clientId = '...';
const clientSecret = '...';
const redirectUrl = 'postmessage';

// 프로젝트 : for-marketing
const oauth2Client = new google.auth.OAuth2(
  clientId, // Google Cloud에서 생성한 OAuth 2.0 클라이언트 ID
  clientSecret, // 클라이언트 시크릿
  redirectUrl // 리디렉트 URI
);

// 프로젝트 : vplate-render
const apiKey = '...';

// video 요청 갯수- 최소 5, 최대 50
const maxResults = 50;

export const handler = async (event) => {
  try {
    
    oauth2Client.setCredentials({
      access_token: event.tokenInfo.access_token,
      refresh_token: event.tokenInfo.refresh_token,
    });
    
    // 채널 ID 설정
    const channelId = event.channelInfo.id;

    const youtube = google.youtube({
      version: 'v3',
      
      // oauth2Client, apiKey 두가지 사용가능
      // auth: apiKey, 
      auth: oauth2Client,
    });
    
    // video id list ( api 사용량 100 )
    const videoList = await youtube.search.list({
      part: 'id',
      channelId: channelId,
      type: 'video',
      maxResults: maxResults,
    });
    const videoIds = videoList.data.items.map(item => item.id.videoId);
    
    let pageToken = videoList.data.nextPageToken;
    
    while(pageToken) {
      const videoList = await youtube.search.list({
        part: 'id',
        channelId: channelId,
        type: 'video',
        maxResults: maxResults,
        pageToken: pageToken
      });
      const resultIds = videoList.data.items.map(item => item.id.videoId);
      videoIds.push(...resultIds);
      pageToken = videoList.data.nextPageToken;
      // break;
    }
    
    // id 정보로 람다 요청 처리
    const invokeArr = [];
    for (let item of videoIds) {
      const data = { 
        media_id: item,
        clientId: clientId,
        clientSecret: clientSecret,
        redirectUrl: redirectUrl,
        apiKey: apiKey,
        tokenInfo: event.tokenInfo,
        userId: event.userId,
        channelId: channelId
      };
      const params = {
        FunctionName:
          'arn:aws:lambda:ap-northeast-2:358527653076:function:dashboard-youtube-request-video',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify(data),
      };
      invokeArr.push(lambda.invoke(params).promise());
    }
    const invokeResults = await Promise.all(invokeArr);
    
    // 오류가 있었던 데이터 제외
    const posts = [];
    for (const item of invokeResults) {
      const temp = JSON.parse(item.Payload);
      // console.log('temp = ', temp);
      if (temp.statusCode === 200) posts.push(temp.body);
    }
    
    const response = {
      statusCode: 200,
      body: posts,
    };
    return response;
    
  } catch (error) {
    
    console.error('error =', error);
    return {
      statusCode: 500,
      body: 'Internal Server Error',
    };
    
  }
};
